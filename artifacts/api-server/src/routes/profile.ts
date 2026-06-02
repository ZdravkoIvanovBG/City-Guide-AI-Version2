import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import bcrypt from "bcrypt";
import { db, usersTable, plansTable } from "@workspace/db";
import { UpdateProfileBody, UploadAvatarBody } from "@workspace/api-zod";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

const CONTINENT_MAP: Record<string, string> = {
  AF: "Africa", AS: "Asia", EU: "Europe", NA: "North America",
  SA: "South America", OC: "Oceania", AN: "Antarctica",
};

const COUNTRY_TO_CONTINENT: Record<string, string> = {
  "France": "EU", "Germany": "EU", "Spain": "EU", "Italy": "EU", "United Kingdom": "EU",
  "Portugal": "EU", "Netherlands": "EU", "Greece": "EU", "Turkey": "EU",
  "Japan": "AS", "China": "AS", "India": "AS", "Thailand": "AS", "Indonesia": "AS",
  "Vietnam": "AS", "Singapore": "AS", "South Korea": "AS", "UAE": "AS",
  "United States": "NA", "Canada": "NA", "Mexico": "NA",
  "Brazil": "SA", "Argentina": "SA", "Colombia": "SA", "Peru": "SA",
  "Australia": "OC", "New Zealand": "OC",
  "Morocco": "AF", "Egypt": "AF", "South Africa": "AF", "Kenya": "AF",
};

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  Paris: { lat: 48.8566, lng: 2.3522 },
  Tokyo: { lat: 35.6762, lng: 139.6503 },
  "New York": { lat: 40.7128, lng: -74.006 },
  Barcelona: { lat: 41.3851, lng: 2.1734 },
  Istanbul: { lat: 41.0082, lng: 28.9784 },
  Bali: { lat: -8.3405, lng: 115.092 },
  London: { lat: 51.5074, lng: -0.1278 },
  Rome: { lat: 41.9028, lng: 12.4964 },
  Amsterdam: { lat: 52.3676, lng: 4.9041 },
  Berlin: { lat: 52.52, lng: 13.405 },
  Bangkok: { lat: 13.7563, lng: 100.5018 },
  Dubai: { lat: 25.2048, lng: 55.2708 },
  Sydney: { lat: -33.8688, lng: 151.2093 },
  Singapore: { lat: 1.3521, lng: 103.8198 },
};

router.get("/profile", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
    bio: user.bio ?? null,
    createdAt: user.createdAt.toISOString(),
  });
});

router.patch("/profile", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, bio, password } = parsed.data;
  const updates: Partial<typeof usersTable.$inferInsert> = {};

  if (name != null) updates.name = name;
  if (email != null) updates.email = email;
  if (bio !== undefined) updates.bio = bio ?? undefined;
  if (password != null) updates.passwordHash = await bcrypt.hash(password, 12);

  if (Object.keys(updates).length === 0) {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.userId!))
      .limit(1);
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl ?? null,
      bio: user.bio ?? null,
      createdAt: user.createdAt.toISOString(),
    });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.userId!))
    .returning();

  res.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    avatarUrl: updated.avatarUrl ?? null,
    bio: updated.bio ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.post("/profile/avatar", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = UploadAvatarBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid avatar data" });
    return;
  }

  const { avatarData } = parsed.data;
  if (!avatarData.startsWith("data:image/")) {
    res.status(400).json({ error: "Avatar must be a base64 data URI" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ avatarUrl: avatarData })
    .where(eq(usersTable.id, req.userId!))
    .returning();

  res.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    avatarUrl: updated.avatarUrl ?? null,
    bio: updated.bio ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
});

router.get("/profile/stats", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const plans = await db
    .select({
      city: plansTable.city,
      country: plansTable.country,
      startDate: plansTable.startDate,
      endDate: plansTable.endDate,
    })
    .from(plansTable)
    .where(eq(plansTable.userId, req.userId!))
    .orderBy(desc(plansTable.createdAt));

  const cities = new Set<string>();
  const countries = new Set<string>();
  const continentCounts: Record<string, number> = {};
  let totalDays = 0;

  for (const p of plans) {
    cities.add(p.city);
    countries.add(p.country);

    const start = new Date(p.startDate);
    const end = new Date(p.endDate);
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    totalDays += days;

    const continentCode = COUNTRY_TO_CONTINENT[p.country];
    if (continentCode) {
      continentCounts[continentCode] = (continentCounts[continentCode] ?? 0) + 1;
    }
  }

  const favouriteContinentCode = Object.entries(continentCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const favouriteContinent = favouriteContinentCode ? (CONTINENT_MAP[favouriteContinentCode] ?? null) : null;

  const visitedCities = [...cities].map((city) => {
    const plan = plans.find((p) => p.city === city);
    const coords = CITY_COORDS[city] ?? { lat: 0, lng: 0 };
    return {
      city,
      country: plan?.country ?? "",
      lat: coords.lat,
      lng: coords.lng,
    };
  });

  res.json({
    totalCities: cities.size,
    totalCountries: countries.size,
    totalDays,
    favouriteContinent,
    visitedCities,
  });
});

export default router;
