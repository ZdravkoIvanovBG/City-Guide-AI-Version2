import { logger } from "./logger";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

export async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const response = await fetch(`${GEMINI_BASE}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 65536,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    logger.error({ status: response.status, errText }, "Gemini API error");
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json() as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return text;
}

export async function getCityAutocomplete(query: string): Promise<Array<{ city: string; country: string; countryCode: string }>> {
  const prompt = `The user is searching for a city to visit. Their partial input is: '${query}'.
Return a JSON array of exactly 6 matching cities from anywhere in the world, including small or lesser-known ones. Each object: { city, country, countryCode }.
Order by most likely travel destination first. Return ONLY the JSON array, no markdown, no preamble.`;

  const raw = await callGemini(prompt);
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");

  try {
    return JSON.parse(cleaned);
  } catch {
    logger.warn({ raw }, "City autocomplete JSON parse failed");
    return [];
  }
}

interface PlanData {
  city: string;
  tripSummary: string;
  days: Array<{
    dayNumber: number;
    date: string;
    destinations: Array<{
      name: string;
      category: string;
      summary: string;
      insiderTips: string[];
      entryCost: string;
      howToGetThere: Record<string, string>;
      bestTimeToVisit: string;
      photoSearchQuery: string;
    }>;
  }>;
  hotels: {
    budget: HotelRaw[];
    midRange: HotelRaw[];
    luxury: HotelRaw[];
  };
  restaurants: RestaurantRaw[];
  misc: MiscRaw[];
}

interface HotelRaw {
  name: string;
  neighbourhood: string;
  description: string;
  priceRange: string;
  type: string;
}

interface RestaurantRaw {
  name: string;
  cuisine: string;
  mustTryDish: string;
  neighbourhood: string;
  priceRange: string;
  description: string;
}

interface MiscRaw {
  name: string;
  dateOrFrequency: string;
  description: string;
  location: string;
  isFree: boolean;
}

export async function generateTravelPlan(params: {
  city: string;
  country: string;
  startDate: string;
  endDate: string;
  budget?: string | null;
  preferences?: string | null;
  travellerType: string;
}): Promise<PlanData> {
  const { city, country, startDate, endDate, budget, preferences, travellerType } = params;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  const prompt = `You are a world-class travel expert. Generate a detailed ${days}-day travel plan for ${city}, ${country}.

Trip details:
- Dates: ${startDate} to ${endDate} (${days} days)
- Budget: ${budget ?? "No preference"}
- Traveller type: ${travellerType}
- Interests: ${preferences ?? "General sightseeing and local culture"}

Return ONLY valid JSON (no markdown, no preamble, no code blocks) matching this exact structure:

{
  "city": "${city}",
  "tripSummary": "2-3 sentence evocative summary of this trip",
  "days": [
    {
      "dayNumber": 1,
      "date": "${startDate}",
      "destinations": [
        {
          "name": "string",
          "category": "Museum|Market|Park|Landmark|Neighbourhood|Beach|Temple|Gallery|Restaurant District|Viewpoint",
          "summary": "2-3 engaging sentences about this place",
          "insiderTips": ["tip1", "tip2", "tip3"],
          "entryCost": "Free OR €12 adults OR Pay-what-you-wish",
          "howToGetThere": { "walking": "string", "subway": "string" },
          "bestTimeToVisit": "string",
          "photoSearchQuery": "clean search string like 'Eiffel Tower Paris'"
        }
      ]
    }
  ],
  "hotels": {
    "budget": [
      { "name": "string", "neighbourhood": "string", "description": "1-2 sentences", "priceRange": "€30-60/night", "type": "Hostel|Budget Hotel|Guesthouse" }
    ],
    "midRange": [
      { "name": "string", "neighbourhood": "string", "description": "1-2 sentences", "priceRange": "€80-150/night", "type": "Boutique|Hotel" }
    ],
    "luxury": [
      { "name": "string", "neighbourhood": "string", "description": "1-2 sentences", "priceRange": "€250+/night", "type": "5-Star|Luxury Hotel" }
    ]
  },
  "restaurants": [
    { "name": "string", "cuisine": "string", "mustTryDish": "string", "neighbourhood": "string", "priceRange": "€|€€|€€€", "description": "1-2 sentences" }
  ],
  "misc": [
    { "name": "string", "dateOrFrequency": "string", "description": "string", "location": "string", "isFree": true }
  ]
}

Rules:
- Include 3-4 destinations per day
- Include 2-3 hotels per tier (budget/midRange/luxury)
- Include 8-10 restaurants
- Include 5-8 misc events/experiences
- Only include transport modes that realistically exist in ${city}
- photoSearchQuery should be specific enough to get a good Google Places photo
- Return ONLY the JSON object, nothing else`;

  const raw = await callGemini(prompt);
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    logger.error({ err, raw: raw.substring(0, 500) }, "Travel plan JSON parse failed");
    throw new Error("Failed to parse AI-generated plan. Please try again.");
  }
}
