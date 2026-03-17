import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";
import { requireAnyRole } from "@/lib/rbac";

// GET /api/work-order-categories — list all active work order categories
export async function GET(req: NextRequest) {
  const auth = requireAnyRole(req, [
    "contractor",
    "department_user",
    "operations_manager",
    "planner",
    "asset_manager",
    "admin",
  ]);
  if (auth instanceof NextResponse) return auth;

  const categories = await prisma.workOrderCategory.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return ok(categories);
}
