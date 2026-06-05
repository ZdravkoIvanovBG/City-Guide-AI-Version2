import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";
import { db, plansTable, destinationNotesTable } from "@workspace/db";
import { generateTravelPlan } from "../lib/gemini";
import { getPlacePhoto } from "../lib/placePhoto";
import {
  GeneratePlanBody,
  GetPlanParams,
  DeletePlanParams,
  RegeneratePlanParams,
  GetPublicPlanParams,
} from "@workspace/api-zod";
import { requireAuth, optionalAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

const FEATURED_CITIES = [
  { city: "Paris", country: "France", tagline: "The city that rewrites you" },
  { city: "Tokyo", country: "Japan", tagline: "Controlled chaos, perfect order" },
  { city: "New York", country: "United States", tagline: "Eight million stories, one island" },
  { city: "Barcelona", country: "Spain", tagline: "Architecture as living art" },
  { city: "Istanbul", country: "Turkey", tagline: "Where two worlds blur into one" },
  { city: "Bali", country: "Indonesia", tagline: "The island that keeps its secrets" },
];

router.get("/plans/featured", async (req, res): Promise<void> => {
  try {
    const featured = await Promise.all(
      FEATURED_CITIES.map(async (c) => ({
        ...c,
        photoUrl: await getPlacePhoto(`${c.city} city skyline`),
      }))
    );
    res.json(featured);
  } catch (err) {
    req.log.error({ err }, "Featured cities fetch failed");
    res.status(500).json({ error: "Failed to load featured cities" });
  }
});

router.get("/plans/share/:shareCode", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.shareCode)
    ? req.params.shareCode[0]
    : req.params.shareCode;
  const parsed = GetPublicPlanParams.safeParse({ shareCode: raw });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid share code" });
    return;
  }

  const [plan] = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.shareCode, parsed.data.shareCode))
    .limit(1);

  if (!plan) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }

  res.json(formatPlan(plan));
});

router.get("/plans", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const plans = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.userId, req.userId!))
    .orderBy(desc(plansTable.createdAt));

  res.json(
    plans.map((p) => ({
      id: p.id,
      shareCode: p.shareCode,
      city: p.city,
      country: p.country,
      startDate: p.startDate,
      endDate: p.endDate,
      travellerType: p.travellerType,
      budget: p.budget ?? null,
      createdAt: p.createdAt.toISOString(),
      photoUrl: p.photoUrl,
      customName: p.customName ?? null,
      status: p.status ?? "planning",
    }))
  );
});

router.post("/plans", optionalAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = GeneratePlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { city, country, countryCode, startDate, endDate, budget, preferences, travellerType } = parsed.data;

  try {
    const [planData, cityPhotoUrl] = await Promise.all([
      generateTravelPlan({ city, country, startDate, endDate, budget, preferences, travellerType }),
      getPlacePhoto(`${city} ${country} city`),
    ]);

    const hotelPhotoPromises = async (hotels: Array<{ name: string }>) =>
      Promise.all(
        hotels.map(async (h) => ({
          ...h,
          photoUrl: await getPlacePhoto(`${h.name} ${city} hotel`),
          mapsUrl: `https://maps.google.com/?q=${encodeURIComponent(h.name + " " + city)}`,
          bookingUrl: `https://www.booking.com/search.html?ss=${encodeURIComponent(h.name + " " + city)}`,
          airbnbUrl: `https://www.airbnb.com/s/${encodeURIComponent(city)}/homes`,
        }))
      );

    const [budgetHotels, midRangeHotels, luxuryHotels] = await Promise.all([
      hotelPhotoPromises(planData.hotels.budget),
      hotelPhotoPromises(planData.hotels.midRange),
      hotelPhotoPromises(planData.hotels.luxury),
    ]);

    const restaurantsWithPhotos = await Promise.all(
      planData.restaurants.map(async (r) => ({
        ...r,
        photoUrl: await getPlacePhoto(`${r.name} ${city} restaurant`),
        mapsUrl: `https://maps.google.com/?q=${encodeURIComponent(r.name + " " + city)}`,
      }))
    );

    const daysWithPhotos = await Promise.all(
      planData.days.map(async (day) => ({
        ...day,
        destinations: await Promise.all(
          day.destinations.map(async (dest) => ({
            ...dest,
            photoUrl: await getPlacePhoto(dest.photoSearchQuery),
          }))
        ),
      }))
    );

    const enrichedPlanData = {
      ...planData,
      countryCode,
      days: daysWithPhotos,
      hotels: {
        budget: budgetHotels,
        midRange: midRangeHotels,
        luxury: luxuryHotels,
      },
      restaurants: restaurantsWithPhotos,
    };

    const shareCode = crypto.randomBytes(6).toString("hex");

    const [plan] = await db
      .insert(plansTable)
      .values({
        shareCode,
        userId: req.userId ?? null,
        city,
        country,
        lat: typeof planData.lat === "number" ? planData.lat : null,
        lng: typeof planData.lng === "number" ? planData.lng : null,
        startDate,
        endDate,
        budget: budget ?? null,
        preferences: preferences ?? null,
        travellerType,
        tripSummary: planData.tripSummary,
        photoUrl: cityPhotoUrl,
        planData: enrichedPlanData,
      })
      .returning();

    res.status(201).json(formatPlan(plan));
  } catch (err) {
    req.log.error({ err }, "Plan generation failed");
    res.status(500).json({ error: (err as Error).message ?? "Plan generation failed" });
  }
});

router.get("/plans/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = GetPlanParams.safeParse({ id: raw });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid plan ID" });
    return;
  }

  const [plan] = await db
    .select()
    .from(plansTable)
    .where(and(eq(plansTable.id, parsed.data.id), eq(plansTable.userId, req.userId!)))
    .limit(1);

  if (!plan) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }

  res.json(formatPlan(plan));
});

router.delete("/plans/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = DeletePlanParams.safeParse({ id: raw });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid plan ID" });
    return;
  }

  const [deleted] = await db
    .delete(plansTable)
    .where(and(eq(plansTable.id, parsed.data.id), eq(plansTable.userId, req.userId!)))
    .returning({ id: plansTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }

  res.sendStatus(204);
});

router.post("/plans/:id/regenerate", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = RegeneratePlanParams.safeParse({ id: raw });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid plan ID" });
    return;
  }

  const [existing] = await db
    .select()
    .from(plansTable)
    .where(and(eq(plansTable.id, parsed.data.id), eq(plansTable.userId, req.userId!)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }

  try {
    const planData = await generateTravelPlan({
      city: existing.city,
      country: existing.country,
      startDate: existing.startDate,
      endDate: existing.endDate,
      budget: existing.budget,
      preferences: existing.preferences,
      travellerType: existing.travellerType,
    });

    const daysWithPhotos = await Promise.all(
      planData.days.map(async (day) => ({
        ...day,
        destinations: await Promise.all(
          day.destinations.map(async (dest) => ({
            ...dest,
            photoUrl: await getPlacePhoto(dest.photoSearchQuery),
          }))
        ),
      }))
    );

    const enrichedPlanData = { ...planData, days: daysWithPhotos };

    const [updated] = await db
      .update(plansTable)
      .set({
        tripSummary: planData.tripSummary,
        planData: enrichedPlanData,
      })
      .where(eq(plansTable.id, existing.id))
      .returning();

    res.json(formatPlan(updated));
  } catch (err) {
    req.log.error({ err }, "Plan regeneration failed");
    res.status(500).json({ error: "Regeneration failed. Please try again." });
  }
});

// ── Edit endpoints ────────────────────────────────────────────────────────────

function parsePlanId(req: AuthRequest, res: Parameters<Parameters<typeof router.patch>[1]>[1]): number | null {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw ?? "0", 10);
  if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid plan ID" }); return null; }
  return id;
}

async function requirePlanOwner(planId: number, userId: number, res: Parameters<Parameters<typeof router.patch>[1]>[1]): Promise<typeof plansTable.$inferSelect | null> {
  const [plan] = await db.select().from(plansTable).where(and(eq(plansTable.id, planId), eq(plansTable.userId, userId))).limit(1);
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return null; }
  return plan;
}

router.patch("/plans/:id/rename", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const planId = parsePlanId(req, res); if (!planId) return;
  const plan = await requirePlanOwner(planId, req.userId!, res); if (!plan) return;
  const { customName } = req.body as { customName?: string | null };
  const name = typeof customName === "string" && customName.trim() ? customName.trim().slice(0, 60) : null;
  const [updated] = await db.update(plansTable).set({ customName: name ?? undefined }).where(eq(plansTable.id, planId)).returning();
  res.json(formatPlan(updated));
});

router.patch("/plans/:id/notes", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const planId = parsePlanId(req, res); if (!planId) return;
  const plan = await requirePlanOwner(planId, req.userId!, res); if (!plan) return;
  const { tripNotes } = req.body as { tripNotes?: string | null };
  const [updated] = await db.update(plansTable).set({ tripNotes: tripNotes ?? null }).where(eq(plansTable.id, planId)).returning();
  res.json(formatPlan(updated));
});

router.patch("/plans/:id/status", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const planId = parsePlanId(req, res); if (!planId) return;
  const plan = await requirePlanOwner(planId, req.userId!, res); if (!plan) return;
  const { status } = req.body as { status?: string };
  const valid = ["planning", "booked", "ongoing", "completed", "wishlist"];
  const s = typeof status === "string" && valid.includes(status) ? status : "planning";
  const [updated] = await db.update(plansTable).set({ status: s }).where(eq(plansTable.id, planId)).returning();
  res.json(formatPlan(updated));
});

router.patch("/plans/:id/reorder-days", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const planId = parsePlanId(req, res); if (!planId) return;
  const plan = await requirePlanOwner(planId, req.userId!, res); if (!plan) return;
  const { dayOrder } = req.body as { dayOrder?: number[] };
  if (!Array.isArray(dayOrder)) { res.status(400).json({ error: "dayOrder must be an array" }); return; }
  const [updated] = await db.update(plansTable).set({ dayOrder }).where(eq(plansTable.id, planId)).returning();
  res.json(formatPlan(updated));
});

router.patch("/plans/:id/reorder-destinations", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const planId = parsePlanId(req, res); if (!planId) return;
  const plan = await requirePlanOwner(planId, req.userId!, res); if (!plan) return;
  const { dayIndex, destOrder } = req.body as { dayIndex?: number; destOrder?: number[] };
  if (typeof dayIndex !== "number" || !Array.isArray(destOrder)) { res.status(400).json({ error: "Invalid body" }); return; }
  const data = plan.planData as Record<string, unknown>;
  const days = [...((data.days ?? []) as Record<string, unknown>[])];
  if (!days[dayIndex]) { res.status(400).json({ error: "Invalid dayIndex" }); return; }
  const origDests = (days[dayIndex].destinations ?? []) as unknown[];
  const reordered = destOrder.map(i => origDests[i]).filter(Boolean);
  days[dayIndex] = { ...days[dayIndex], destinations: reordered };
  const [updated] = await db.update(plansTable).set({ planData: { ...data, days } }).where(eq(plansTable.id, planId)).returning();
  res.json(formatPlan(updated));
});

router.patch("/plans/:id/remove-destination", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const planId = parsePlanId(req, res); if (!planId) return;
  const plan = await requirePlanOwner(planId, req.userId!, res); if (!plan) return;
  const { dayIndex, destIndex } = req.body as { dayIndex?: number; destIndex?: number };
  if (typeof dayIndex !== "number" || typeof destIndex !== "number") { res.status(400).json({ error: "Invalid body" }); return; }
  const data = plan.planData as Record<string, unknown>;
  const days = [...((data.days ?? []) as Record<string, unknown>[])];
  if (!days[dayIndex]) { res.status(400).json({ error: "Invalid dayIndex" }); return; }
  const dests = [...((days[dayIndex].destinations ?? []) as unknown[])];
  dests.splice(destIndex, 1);
  days[dayIndex] = { ...days[dayIndex], destinations: dests };
  const [updated] = await db.update(plansTable).set({ planData: { ...data, days } }).where(eq(plansTable.id, planId)).returning();
  res.json(formatPlan(updated));
});

router.get("/plans/:id/destination-notes", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const planId = parsePlanId(req, res); if (!planId) return;
  await requirePlanOwner(planId, req.userId!, res);
  const notes = await db.select().from(destinationNotesTable).where(eq(destinationNotesTable.planId, planId));
  res.json(notes.map(n => ({ planId: n.planId, dayIndex: n.dayIndex, destIndex: n.destIndex, note: n.note, updatedAt: n.updatedAt.toISOString() })));
});

router.get("/plans/:id/destination-notes/:dayIndex/:destIndex", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const planId = parsePlanId(req, res); if (!planId) return;
  await requirePlanOwner(planId, req.userId!, res);
  const dayParam = Array.isArray(req.params.dayIndex) ? req.params.dayIndex[0] : req.params.dayIndex;
  const destParam = Array.isArray(req.params.destIndex) ? req.params.destIndex[0] : req.params.destIndex;
  const di = parseInt(dayParam ?? "0", 10);
  const xi = parseInt(destParam ?? "0", 10);
  const [note] = await db.select().from(destinationNotesTable).where(and(eq(destinationNotesTable.planId, planId), eq(destinationNotesTable.dayIndex, di), eq(destinationNotesTable.destIndex, xi))).limit(1);
  res.json({ planId, dayIndex: di, destIndex: xi, note: note?.note ?? "", updatedAt: note?.updatedAt.toISOString() ?? new Date().toISOString() });
});

router.patch("/plans/:id/destination-notes/:dayIndex/:destIndex", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const planId = parsePlanId(req, res); if (!planId) return;
  await requirePlanOwner(planId, req.userId!, res);
  const dayParam2 = Array.isArray(req.params.dayIndex) ? req.params.dayIndex[0] : req.params.dayIndex;
  const destParam2 = Array.isArray(req.params.destIndex) ? req.params.destIndex[0] : req.params.destIndex;
  const di = parseInt(dayParam2 ?? "0", 10);
  const xi = parseInt(destParam2 ?? "0", 10);
  const { note } = req.body as { note?: string };
  if (typeof note !== "string") { res.status(400).json({ error: "note must be a string" }); return; }
  const [saved] = await db.insert(destinationNotesTable).values({ planId, dayIndex: di, destIndex: xi, note, updatedAt: new Date() })
    .onConflictDoUpdate({ target: [destinationNotesTable.planId, destinationNotesTable.dayIndex, destinationNotesTable.destIndex], set: { note, updatedAt: new Date() } })
    .returning();
  res.json({ planId: saved.planId, dayIndex: saved.dayIndex, destIndex: saved.destIndex, note: saved.note, updatedAt: saved.updatedAt.toISOString() });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatPlan(plan: typeof plansTable.$inferSelect) {
  const data = plan.planData as Record<string, unknown>;
  return {
    id: plan.id,
    userId: plan.userId,
    shareCode: plan.shareCode,
    city: plan.city,
    country: plan.country,
    countryCode: (plan.planData as Record<string, unknown>)?.countryCode as string ?? "",
    startDate: plan.startDate,
    endDate: plan.endDate,
    travellerType: plan.travellerType,
    budget: plan.budget ?? null,
    preferences: plan.preferences ?? null,
    tripSummary: plan.tripSummary,
    photoUrl: plan.photoUrl,
    createdAt: plan.createdAt.toISOString(),
    customName: plan.customName ?? null,
    tripNotes: plan.tripNotes ?? null,
    dayOrder: (plan.dayOrder as number[] | null) ?? null,
    status: plan.status ?? "planning",
    days: (data.days ?? []) as unknown[],
    hotels: (data.hotels ?? { budget: [], midRange: [], luxury: [] }) as unknown,
    restaurants: (data.restaurants ?? []) as unknown[],
    misc: (data.misc ?? []) as unknown[],
    packingList: (data.packingList ?? null) as unknown,
    budgetEstimate: (data.budgetEstimate ?? null) as unknown,
    tripChecklist: (data.tripChecklist ?? null) as unknown,
  };
}

export default router;
