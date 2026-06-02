import { db, photoCacheTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";

const GRADIENT_PLACEHOLDER = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI4MDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJnIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMDgwQzEwIi8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjMUIyNDMyIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNnKSIvPjwvc3ZnPg==";

export async function getPlacePhoto(searchQuery: string): Promise<string> {
  if (!GOOGLE_MAPS_API_KEY) {
    return GRADIENT_PLACEHOLDER;
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();

  try {
    const cached = await db
      .select()
      .from(photoCacheTable)
      .where(eq(photoCacheTable.searchQuery, normalizedQuery))
      .limit(1);

    if (cached[0]) {
      return cached[0].photoUrl;
    }
  } catch (err) {
    logger.warn({ err }, "Photo cache lookup failed");
  }

  try {
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${GOOGLE_MAPS_API_KEY}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json() as {
      results?: Array<{ place_id?: string }>;
      status?: string;
    };

    if (!searchData.results?.[0]?.place_id) {
      return GRADIENT_PLACEHOLDER;
    }

    const placeId = searchData.results[0].place_id;
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_MAPS_API_KEY}`;
    const detailsRes = await fetch(detailsUrl);
    const detailsData = await detailsRes.json() as {
      result?: { photos?: Array<{ photo_reference?: string }> };
    };

    const photoRef = detailsData.result?.photos?.[0]?.photo_reference;
    if (!photoRef) {
      return GRADIENT_PLACEHOLDER;
    }

    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${photoRef}&key=${GOOGLE_MAPS_API_KEY}`;

    try {
      await db.insert(photoCacheTable).values({
        searchQuery: normalizedQuery,
        photoUrl,
      }).onConflictDoNothing();
    } catch (err) {
      logger.warn({ err }, "Photo cache insert failed");
    }

    return photoUrl;
  } catch (err) {
    logger.warn({ err, searchQuery }, "Place photo fetch failed");
    return GRADIENT_PLACEHOLDER;
  }
}
