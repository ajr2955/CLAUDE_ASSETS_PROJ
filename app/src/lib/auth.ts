import { NextRequest } from "next/server";
import { JwtPayload } from "./jwt";

export type { JwtPayload };

// Auth is disabled — all requests run as admin.
const ADMIN_PAYLOAD: JwtPayload = {
  sub: "system-admin",
  email: "admin@assets.local",
  role: "admin",
  type: "access",
};

export function getTokenFromRequest(_req: NextRequest): string | null {
  return null;
}

export function getUserFromRequest(_req: NextRequest): JwtPayload {
  return ADMIN_PAYLOAD;
}
