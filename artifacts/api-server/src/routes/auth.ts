import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { db, usersTable, refreshTokensTable } from "@workspace/db";
import {
  RegisterBody,
  LoginBody,
} from "@workspace/api-zod";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  REFRESH_TOKEN_EXPIRY_MS,
} from "../lib/jwt";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: REFRESH_TOKEN_EXPIRY_MS,
  path: "/api/auth",
};

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, password } = parsed.data;

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (existing[0]) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(usersTable)
    .values({ name, email, passwordHash })
    .returning();

  const payload = { userId: user.id, email: user.email };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await db.insert(refreshTokensTable).values({
    userId: user.id,
    token: refreshToken,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
  });

  res.cookie("refreshToken", refreshToken, COOKIE_OPTS);
  res.status(201).json({
    accessToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl ?? null,
      bio: user.bio ?? null,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const payload = { userId: user.id, email: user.email };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await db.insert(refreshTokensTable).values({
    userId: user.id,
    token: refreshToken,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
  });

  res.cookie("refreshToken", refreshToken, COOKIE_OPTS);
  res.json({
    accessToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl ?? null,
      bio: user.bio ?? null,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.post("/auth/refresh", async (req, res): Promise<void> => {
  const token = req.cookies?.refreshToken as string | undefined;
  if (!token) {
    res.status(401).json({ error: "No refresh token" });
    return;
  }

  let payload: { userId: number; email: string };
  try {
    payload = verifyRefreshToken(token);
  } catch {
    res.status(401).json({ error: "Invalid or expired refresh token" });
    return;
  }

  const [stored] = await db
    .select()
    .from(refreshTokensTable)
    .where(eq(refreshTokensTable.token, token))
    .limit(1);

  if (!stored) {
    res.status(401).json({ error: "Refresh token revoked" });
    return;
  }

  await db
    .delete(refreshTokensTable)
    .where(eq(refreshTokensTable.token, token));

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, payload.userId))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  const newPayload = { userId: user.id, email: user.email };
  const newAccess = signAccessToken(newPayload);
  const newRefresh = signRefreshToken(newPayload);

  await db.insert(refreshTokensTable).values({
    userId: user.id,
    token: newRefresh,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
  });

  res.cookie("refreshToken", newRefresh, COOKIE_OPTS);
  res.json({
    accessToken: newAccess,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl ?? null,
      bio: user.bio ?? null,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.post("/auth/logout", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const token = req.cookies?.refreshToken as string | undefined;
  if (token) {
    await db
      .delete(refreshTokensTable)
      .where(eq(refreshTokensTable.token, token));
    res.clearCookie("refreshToken", { path: "/api/auth" });
  }
  res.sendStatus(204);
});

export default router;
