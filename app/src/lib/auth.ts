import { NextRequest } from "next/server";
import { verifyToken, JwtPayload } from "./jwt";

export type { JwtPayload };

export function getTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}

export function getUserFromRequest(req: NextRequest): JwtPayload | null {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  try {
    const payload = verifyToken(token);
    if (payload.type !== "access") return null;
    return payload;
  } catch {
    return null;
  }
}
