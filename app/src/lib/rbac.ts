import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "./auth";
import { JwtPayload } from "./jwt";
import { err } from "./api-response";

export type Role =
  | "public"
  | "contractor"
  | "department_user"
  | "operations_manager"
  | "planner"
  | "asset_manager"
  | "admin";

// Role weight for hierarchical checks (higher = more access)
const ROLE_WEIGHT: Record<Role, number> = {
  public: 0,
  contractor: 10,
  department_user: 20,
  operations_manager: 30,
  planner: 30, // parallel with operations_manager
  asset_manager: 40,
  admin: 100,
};

export function hasMinRole(userRole: string, minRole: Role): boolean {
  const weight = ROLE_WEIGHT[userRole as Role] ?? -1;
  return weight >= ROLE_WEIGHT[minRole];
}

export function hasAnyRole(userRole: string, roles: Role[]): boolean {
  return roles.includes(userRole as Role);
}

/**
 * Checks that the request has a valid JWT and that the user's role meets
 * the minimum required role. Returns the caller payload on success or a
 * NextResponse error on failure.
 *
 * Usage:
 *   const result = requireAuth(req, "department_user");
 *   if (result instanceof NextResponse) return result;
 *   const caller = result; // JwtPayload
 */
export function requireAuth(
  req: NextRequest,
  minRole: Role = "department_user"
): JwtPayload | NextResponse {
  const caller = getUserFromRequest(req);
  if (!caller) {
    return err("Unauthorized: valid Bearer token required", 401) as NextResponse;
  }
  if (!hasMinRole(caller.role, minRole)) {
    return err(
      `Forbidden: requires at least '${minRole}' role (caller has '${caller.role}')`,
      403
    ) as NextResponse;
  }
  return caller;
}

/**
 * Checks that the request has a valid JWT and that the user's role is one of
 * the explicitly allowed roles (no hierarchy — exact match).
 */
export function requireAnyRole(
  req: NextRequest,
  roles: Role[]
): JwtPayload | NextResponse {
  const caller = getUserFromRequest(req);
  if (!caller) {
    return err("Unauthorized: valid Bearer token required", 401) as NextResponse;
  }
  if (!hasAnyRole(caller.role, roles)) {
    return err(
      `Forbidden: requires one of [${roles.join(", ")}] roles (caller has '${caller.role}')`,
      403
    ) as NextResponse;
  }
  return caller;
}
