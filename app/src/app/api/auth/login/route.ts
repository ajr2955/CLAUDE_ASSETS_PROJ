import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { signAccessToken, signRefreshToken } from "@/lib/jwt";

// POST /api/auth/login
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  const { email, password } = body;
  if (!email || typeof email !== "string") return err("email is required", 422);
  if (!password || typeof password !== "string") return err("password is required", 422);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    return err("Invalid credentials", 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return err("Invalid credentials", 401);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const tokenPayload = { sub: user.id, email: user.email, role: user.role };
  const access_token = signAccessToken(tokenPayload);
  const refresh_token = signRefreshToken(tokenPayload);

  return ok({
    access_token,
    refresh_token,
    token_type: "Bearer",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
}
