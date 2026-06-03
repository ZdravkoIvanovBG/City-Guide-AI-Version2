import { Router, type IRouter } from "express";
import { eq, and, gt } from "drizzle-orm";
import { db, routeCacheTable } from "@workspace/db";
import { generateRouteOptions } from "../lib/gemini";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

router.post("/routes/search", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { originCity, originCountry, destinationCity, destinationCountry, startDate, endDate } = req.body as Record<string, unknown>;

  if (
    !isNonEmptyString(originCity) ||
    !isNonEmptyString(originCountry) ||
    !isNonEmptyString(destinationCity) ||
    !isNonEmptyString(destinationCountry) ||
    !isNonEmptyString(startDate) ||
    !isNonEmptyString(endDate)
  ) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const cacheKey = `${originCity.toLowerCase()}:${destinationCity.toLowerCase()}:${startDate}`.replace(/\s+/g, "_");
  const ttl = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [cached] = await db
    .select()
    .from(routeCacheTable)
    .where(and(eq(routeCacheTable.cacheKey, cacheKey), gt(routeCacheTable.fetchedAt, ttl)))
    .limit(1);

  if (cached) {
    res.json({ options: cached.data as unknown[] });
    return;
  }

  try {
    const options = await generateRouteOptions(
      originCity,
      originCountry,
      destinationCity,
      destinationCountry,
      startDate,
      endDate,
    );

    await db
      .insert(routeCacheTable)
      .values({ cacheKey, data: options })
      .onConflictDoUpdate({
        target: routeCacheTable.cacheKey,
        set: { data: options, fetchedAt: new Date() },
      });

    res.json({ options });
  } catch (err) {
    req.log.error({ err }, "Route search failed");
    res.status(500).json({ error: "Failed to fetch route options. Please try again." });
  }
});

export default router;
