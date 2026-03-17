import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { verifyToken, signAccessToken, signRefreshToken } from "@/lib/jwt";

// POST /api/auth/refresh
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  const { refresh_token } = body;
  if (!refresh_token || typeof refresh_token !== "string") {
    return err("refresh_token is required", 422);
  }

  let payload;
  try {
    payload = verifyToken(refresh_token);
  } catch {
    return err("Invalid or expired refresh token", 401);
  }

  if (payload.type !== "refresh") {
    return err("Provided token is not a refresh token", 401);
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) {
    return err("User not found or inactive", 401);
  }

  const tokenPayload = { sub: user.id, email: user.email, role: user.role };
  const access_token = signAccessToken(tokenPayload);
  const new_refresh_token = signRefreshToken(tokenPayload);

  return ok({ access_token, refresh_token: new_refresh_token, token_type: "Bearer" });
}
