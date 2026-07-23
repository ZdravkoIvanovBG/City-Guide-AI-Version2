import { db, photoCacheTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";

const GRADIENT_PLACEHOLDER = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwMCIgaGVpZ2h0PSI4MDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJnIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMDgwQzEwIi8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjMUIyNDMyIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNnKSIvPjwvc3ZnPg==";

/**
 * Resolve a Google Places v1 photo name into a final image URL by following
 * the redirect server-side, so we store a public googleusercontent.com URL
 * that browsers can load without the API key or referrer restrictions.
 */
async function resolvePhotoUrl(photoName: string): Promise<string> {
  const redirectUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1200&skipHttpRedirect=false&key=${GOOGLE_MAPS_API_KEY}`;

  // Follow the redirect server-side
  const res = await fetch(redirectUrl, { redirect: "follow" });

  if (!res.ok) {
    logger.warn({ status: res.status, photoName }, "Photo redirect resolution failed");
    return GRADIENT_PLACEHOLDER;
  }

  // The final URL after redirect is a public googleusercontent.com URL
  return res.url || GRADIENT_PLACEHOLDER;
}

export async function getPlacePhoto(searchQuery: string): Promise<string> {
  if (!GOOGLE_MAPS_API_KEY) {
    return GRADIENT_PLACEHOLDER;
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Check cache first — but skip cached entries that still have the old
  // broken Places photo redirect URL format
  try {
    const cached = await db
      .select()
      .from(photoCacheTable)
      .where(eq(photoCacheTable.searchQuery, normalizedQuery))
      .limit(1);

    if (cached[0]) {
      const url = cached[0].photoUrl;
      // If the cached URL is a googleusercontent.com or lh3 URL (resolved), use it
      // If it's still the old/broken redirect URL, skip it and re-fetch
      if (
        !url.includes("maps.googleapis.com/maps/api/place/photo") &&
        !url.includes("places.googleapis.com")
      ) {
        return url;
      }
      // Stale entry — delete it so we re-fetch
      await db.delete(photoCacheTable).where(eq(photoCacheTable.searchQuery, normalizedQuery));
    }
  } catch (err) {
    logger.warn({ err }, "Photo cache lookup failed");
  }

  try {
    // New Places API v1 — text search
    const searchRes = await fetch(
      `https://places.googleapis.com/v1/places:searchText`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
          "X-Goog-FieldMask": "places.photos",
        },
        body: JSON.stringify({ textQuery: searchQuery, pageSize: 1 }),
      }
    );

    if (!searchRes.ok) {
      logger.warn({ status: searchRes.status, searchQuery }, "Places text search failed");
      return GRADIENT_PLACEHOLDER;
    }

    const searchData = await searchRes.json() as {
      places?: Array<{ photos?: Array<{ name?: string }> }>;
    };

    const photoName = searchData.places?.[0]?.photos?.[0]?.name;
    if (!photoName) {
      logger.warn({ searchQuery }, "No photo found for query");
      return GRADIENT_PLACEHOLDER;
    }

    // Resolve the redirect server-side to get a stable googleusercontent.com URL
    const photoUrl = await resolvePhotoUrl(photoName);

    if (photoUrl && photoUrl !== GRADIENT_PLACEHOLDER) {
      try {
        await db.insert(photoCacheTable).values({
          searchQuery: normalizedQuery,
          photoUrl,
        }).onConflictDoNothing();
      } catch (err) {
        logger.warn({ err }, "Photo cache insert failed");
      }
    }

    return photoUrl;
  } catch (err) {
    logger.warn({ err, searchQuery }, "Place photo fetch failed");
    return GRADIENT_PLACEHOLDER;
  }
}
