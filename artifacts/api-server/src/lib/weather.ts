import { db } from "@workspace/db";
import { weatherCacheTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { callGemini } from "./gemini";
import { logger } from "./logger";

const OWM_KEY = process.env.OPENWEATHERMAP_API_KEY ?? "";
const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours

export interface DayWeather {
  date: string;
  tempMin: number;
  tempMax: number;
  condition: string;
  icon: string;
  humidity: number;
  chanceOfRain: number;
  windSpeed: number;
  isHistorical?: boolean;
}

function isFahrenheit(countryCode: string): boolean {
  return ["US", "LR", "MM"].includes(countryCode.toUpperCase());
}

function celsiusToFahrenheit(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

function eachDay(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cur = new Date(startDate);
  const end = new Date(endDate);
  while (cur <= end) {
    dates.push(cur.toISOString().split("T")[0]!);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

async function fetchFromOwm(
  city: string,
  country: string,
  countryCode: string,
  dates: string[],
): Promise<DayWeather[]> {
  const useFahrenheit = isFahrenheit(countryCode);
  const units = useFahrenheit ? "imperial" : "metric";
  const unitLabel = useFahrenheit ? "°F" : "°C";

  const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)},${encodeURIComponent(country)}&appid=${OWM_KEY}&units=${units}&cnt=40`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`OWM API error: ${res.status}`);
  }

  const json = await res.json() as {
    list: Array<{
      dt_txt: string;
      main: { temp_min: number; temp_max: number; humidity: number };
      weather: Array<{ description: string; icon: string }>;
      pop: number;
      wind: { speed: number };
    }>;
  };

  // Group by date, prefer the 12:00 slot
  const byDate = new Map<string, typeof json.list[0][]>();
  for (const item of json.list) {
    const d = item.dt_txt.split(" ")[0]!;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(item);
  }

  const results: DayWeather[] = [];
  for (const date of dates) {
    const slots = byDate.get(date);
    if (!slots || slots.length === 0) continue;
    const midday = slots.find((s) => s.dt_txt.includes("12:00")) ?? slots[Math.floor(slots.length / 2)]!;
    const temps = slots.map((s) => s.main.temp_min).concat(slots.map((s) => s.main.temp_max));
    results.push({
      date,
      tempMin: Math.round(Math.min(...temps)),
      tempMax: Math.round(Math.max(...temps)),
      condition: midday.weather[0]?.description ?? "Clear",
      icon: midday.weather[0]?.icon ?? "01d",
      humidity: Math.round(midday.main.humidity),
      chanceOfRain: Math.round((midday.pop ?? 0) * 100),
      windSpeed: Math.round(midday.wind.speed * (useFahrenheit ? 2.237 : 3.6)), // m/s → mph or km/h
    });
  }
  return results;
}

async function fetchHistoricalFallback(
  city: string,
  country: string,
  countryCode: string,
  dates: string[],
): Promise<DayWeather[]> {
  const month = new Date(dates[0]!).toLocaleString("en-US", { month: "long" });
  const useFahrenheit = isFahrenheit(countryCode);
  const unitHint = useFahrenheit ? "Fahrenheit" : "Celsius";

  const prompt = `What is the typical weather in ${city}, ${country} during ${month}?
Return ONLY valid JSON (no markdown): { "avgTempMin": number, "avgTempMax": number, "condition": "short description", "humidity": number, "windSpeed": number, "chanceOfRain": number }
Temperatures in ${unitHint}. windSpeed in ${useFahrenheit ? "mph" : "km/h"}.`;

  const raw = await callGemini(prompt);
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");
  const avg = JSON.parse(cleaned) as {
    avgTempMin: number;
    avgTempMax: number;
    condition: string;
    humidity: number;
    windSpeed: number;
    chanceOfRain: number;
  };

  return dates.map((date) => ({
    date,
    tempMin: Math.round(avg.avgTempMin),
    tempMax: Math.round(avg.avgTempMax),
    condition: avg.condition,
    icon: "01d",
    humidity: Math.round(avg.humidity ?? 50),
    chanceOfRain: Math.round(avg.chanceOfRain ?? 10),
    windSpeed: Math.round(avg.windSpeed ?? 10),
    isHistorical: true,
  }));
}

export async function getWeatherForecast(params: {
  city: string;
  country: string;
  countryCode: string;
  startDate: string;
  endDate: string;
}): Promise<DayWeather[]> {
  const { city, country, countryCode, startDate, endDate } = params;
  const cacheKey = `${city}::${country}::${startDate}::${endDate}`;

  // Check cache
  const [cached] = await db
    .select()
    .from(weatherCacheTable)
    .where(eq(weatherCacheTable.cacheKey, cacheKey))
    .limit(1);

  if (cached) {
    const age = Date.now() - cached.fetchedAt.getTime();
    if (age < CACHE_TTL_MS) {
      return cached.data as DayWeather[];
    }
  }

  const dates = eachDay(startDate, endDate);

  // If start is more than 5 days from now, skip OWM and go straight to Gemini fallback
  const daysUntilStart = Math.ceil(
    (new Date(startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  let data: DayWeather[];
  if (!OWM_KEY || daysUntilStart > 5) {
    data = await fetchHistoricalFallback(city, country, countryCode, dates);
  } else {
    try {
      const owmData = await fetchFromOwm(city, country, countryCode, dates);
      // Fill any missing days (OWM may not cover all dates) with Gemini fallback
      if (owmData.length < dates.length) {
        const covered = new Set(owmData.map((d) => d.date));
        const missing = dates.filter((d) => !covered.has(d));
        if (missing.length > 0) {
          const fallback = await fetchHistoricalFallback(city, country, countryCode, missing);
          owmData.push(...fallback);
          owmData.sort((a, b) => a.date.localeCompare(b.date));
        }
      }
      data = owmData;
    } catch (err) {
      logger.warn({ err }, "OWM fetch failed, using Gemini fallback");
      data = await fetchHistoricalFallback(city, country, countryCode, dates);
    }
  }

  // Upsert cache
  try {
    if (cached) {
      await db
        .update(weatherCacheTable)
        .set({ data, fetchedAt: new Date() })
        .where(eq(weatherCacheTable.cacheKey, cacheKey));
    } else {
      await db.insert(weatherCacheTable).values({ cacheKey, data });
    }
  } catch (cacheErr) {
    logger.warn({ cacheErr }, "Weather cache write failed");
  }

  return data;
}
