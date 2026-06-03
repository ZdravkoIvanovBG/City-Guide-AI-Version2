import { logger } from "./logger";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_MODEL = "gemini-3.5-flash";
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
  lat: number;
  lng: number;
  tripSummary: string;
  packingList: PackingListRaw;
  budgetEstimate: BudgetEstimateRaw;
  tripChecklist: TripChecklistRaw;
  days: Array<{
    dayNumber: number;
    date: string;
    destinations: Array<{
      name: string;
      category: string;
      summary: string;
      insiderTips: string[];
      entryCost: string;
      howToGetThere: Record<string, {
        available: boolean;
        duration?: string;
        from?: string;
        line?: string;
        stop?: string;
        cost?: string;
        instructions?: string;
      }>;
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

interface PackingItemRaw {
  label: string;
  essential: boolean;
  note: string | null;
}

interface PackingCategoryRaw {
  name: string;
  items: PackingItemRaw[];
}

interface PackingListRaw {
  categories: PackingCategoryRaw[];
}

interface BudgetLineRaw {
  category: string;
  description: string;
  estimatedCost: number;
  notes: string | null;
}

interface BudgetDayRaw {
  day: number;
  date: string;
  items: BudgetLineRaw[];
  dayTotal: number;
}

interface FixedCostRaw {
  category: string;
  description: string;
  estimatedCostPerNight: number;
  totalEstimated: number;
  notes: string | null;
}

interface BudgetEstimateRaw {
  currency: string;
  currencySymbol: string;
  budgetTier: string;
  dailyBreakdown: BudgetDayRaw[];
  fixedCosts: FixedCostRaw[];
  tripTotal: { low: number; mid: number; high: number };
  localTips: string[];
}

interface ChecklistItemRaw {
  label: string;
  essential: boolean;
  link: string | null;
  linkLabel: string | null;
  detail: string | null;
}

interface ChecklistCategoryRaw {
  name: string;
  items: ChecklistItemRaw[];
}

interface TripChecklistRaw {
  categories: ChecklistCategoryRaw[];
}

interface RouteOptionRaw {
  mode: string;
  available: boolean;
  summary: string;
  duration?: string | null;
  frequency?: string | null;
  priceRange?: { low: number; high: number; currency: string; note?: string | null } | null;
  operators?: string[];
  route?: string | null;
  stops?: string | null;
  tips?: string[];
  bookingLinks?: { platform: string; url: string; label: string }[];
}

export async function generateRouteOptions(
  originCity: string,
  originCountry: string,
  destinationCity: string,
  destinationCountry: string,
  startDate: string,
  endDate: string,
): Promise<RouteOptionRaw[]> {
  const prompt = `The user wants to travel from ${originCity}, ${originCountry} to ${destinationCity}, ${destinationCountry}. Their travel dates are ${startDate} to ${endDate}.

Return a JSON array of all realistic transport options between these two cities. For each option include:
{
  "mode": "flight" | "train" | "bus" | "ferry" | "drive",
  "available": true | false,
  "summary": "Direct flight, ~2h 10min",
  "duration": "2h 10min",
  "frequency": "Multiple daily departures",
  "priceRange": {
    "low": 89,
    "high": 320,
    "currency": "EUR",
    "note": "Prices vary by airline and booking time"
  },
  "operators": ["Ryanair", "Vueling", "EasyJet"],
  "route": "JFK / EWR → BCN",
  "stops": "Direct or 1 stop via Madrid",
  "tips": [
    "Book 6–8 weeks in advance for best prices",
    "Check both JFK and Newark airports for cheaper options"
  ],
  "bookingLinks": [
    {
      "platform": "Google Flights",
      "url": "https://www.google.com/travel/flights?q=flights+from+${encodeURIComponent(originCity)}+to+${encodeURIComponent(destinationCity)}",
      "label": "Search on Google Flights"
    }
  ]
}

Rules:
- Only include modes where available: true if the route is genuinely possible. Do not invent unrealistic options (e.g. no ferry between New York and Barcelona).
- IMPORTANT — handle cities without direct transport hubs: If the origin city does not have its own airport, train station, or bus terminal that serves the required route, automatically factor in the journey to the nearest relevant hub city. The summary and route fields must reflect the full journey including the first leg.
- For flights: always include if any airport serves either city or is within reasonable reach (under ~3 hours travel).
- For trains: include if a direct or connecting rail route exists between the two cities or countries.
- For buses: include only if long-distance coach services realistically operate this route.
- For ferry: include only if a genuine ferry route exists.
- For drive: include if the cities are on the same landmass and within roughly 1500km.
- Price ranges should reflect realistic market rates.
- operators should list real airlines / train operators / bus companies that serve this route.
- Always include a Google Flights or Rome2rio booking link. For trains include Omio or Trainline.
- Return ONLY the JSON array. No markdown, no preamble.`;

  try {
    const raw = await callGemini(prompt);
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]) as RouteOptionRaw[];
  } catch {
    return [];
  }
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
  "lat": <decimal latitude of ${city}>,
  "lng": <decimal longitude of ${city}>,
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
          "howToGetThere": {
            "walking": { "available": true, "duration": "18 min", "from": "city centre", "instructions": "Head north along [street]. Flat route." },
            "bus": { "available": true, "duration": "9 min", "from": "[Bus Station, Stop 4]", "line": "Bus 22 direction [terminus]", "stop": "Exit at [stop name]", "cost": "[local currency] single fare", "instructions": "Buses run every 8 minutes." },
            "subway": { "available": false },
            "tram": { "available": false },
            "taxi": { "available": true, "duration": "7 min", "cost": "approx. [local cost]", "instructions": "Available via Uber, Bolt, or local taxis." },
            "bicycle": { "available": false }
          },
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
  ],
  "packingList": {
    "categories": [
      {
        "name": "Documents",
        "items": [
          { "label": "Passport", "essential": true, "note": "Must be valid 6+ months beyond return date" },
          { "label": "Travel insurance documents", "essential": true, "note": null }
        ]
      },
      { "name": "Clothing", "items": [ { "label": "string", "essential": false, "note": null } ] },
      { "name": "Toiletries", "items": [ { "label": "string", "essential": false, "note": null } ] },
      { "name": "Electronics", "items": [ { "label": "string", "essential": false, "note": null } ] },
      { "name": "Health & Safety", "items": [ { "label": "string", "essential": false, "note": null } ] },
      { "name": "City-specific", "items": [ { "label": "string", "essential": false, "note": "Why this item matters in ${city}" } ] }
    ]
  },
  "budgetEstimate": {
    "currency": "local currency name",
    "currencySymbol": "local currency symbol",
    "budgetTier": "${budget ?? "mid-range"}",
    "dailyBreakdown": [
      {
        "day": 1,
        "date": "${startDate}",
        "items": [
          { "category": "Entry fees", "description": "string", "estimatedCost": 0, "notes": null },
          { "category": "Transport", "description": "string", "estimatedCost": 0, "notes": null },
          { "category": "Lunch", "description": "string", "estimatedCost": 0, "notes": null },
          { "category": "Dinner", "description": "string", "estimatedCost": 0, "notes": null },
          { "category": "Snacks & drinks", "description": "string", "estimatedCost": 0, "notes": null }
        ],
        "dayTotal": 0
      }
    ],
    "fixedCosts": [
      { "category": "Accommodation", "description": "string", "estimatedCostPerNight": 0, "totalEstimated": 0, "notes": null }
    ],
    "tripTotal": { "low": 0, "mid": 0, "high": 0 },
    "localTips": ["string"]
  },
  "tripChecklist": {
    "categories": [
      {
        "name": "Before you book",
        "items": [
          { "label": "Check visa requirements for ${country}", "essential": true, "link": "https://www.iatatravelcentre.com", "linkLabel": "Check requirements", "detail": "Specific visa rules for ${country}" },
          { "label": "Check passport expiry", "essential": true, "link": null, "linkLabel": null, "detail": "Must be valid 6+ months beyond return date" }
        ]
      },
      { "name": "Accommodation & flights", "items": [ { "label": "string", "essential": false, "link": null, "linkLabel": null, "detail": null } ] },
      { "name": "Health & safety", "items": [ { "label": "string", "essential": false, "link": null, "linkLabel": null, "detail": "Emergency numbers, tap water, vaccinations relevant to ${country}" } ] },
      { "name": "Money & payments", "items": [ { "label": "string", "essential": false, "link": null, "linkLabel": null, "detail": "Card acceptance, cash needs, ATM availability, tipping culture in ${city}" } ] },
      { "name": "Useful apps for ${city}", "items": [ { "label": "string", "essential": false, "link": null, "linkLabel": null, "detail": "Real apps locals use in ${city} for transit, taxis, food" } ] },
      { "name": "On arrival", "items": [ { "label": "string", "essential": false, "link": null, "linkLabel": null, "detail": null } ] }
    ]
  }
}

Rules:
- Include 3-4 destinations per day
- Include 2-3 hotels per tier (budget/midRange/luxury)
- Include 8-10 restaurants
- Include 5-8 misc events/experiences
- photoSearchQuery should be specific enough to get a good Google Places photo
- howToGetThere rules:
  * Always include all six keys: walking, bus, subway, tram, taxi, bicycle
  * Set available: false for modes that don't practically exist in ${city} (e.g. no subway in many smaller cities, no tram in most US cities)
  * When available: false, include ONLY the "available" key — no other fields
  * Duration is travel time from city centre or from the previous destination in the day
  * Use real street names, station names, bus line numbers, and stop names for ${city} where you know them
  * Cost must be in the local currency of ${city} (e.g. JPY for Tokyo, GBP for London, USD for New York)
  * line field (bus/tram): include the line number/name and direction terminus
  * stop field (bus/subway/tram): the stop or exit name where the traveller should alight
  * instructions: 1-2 practical sentences — frequency, any useful tips, app names for rideshare
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
