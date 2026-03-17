import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

// GET /api/contract-types — list all active contract types
export async function GET(req: NextRequest) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const types = await prisma.contractType.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return ok(types);
}
