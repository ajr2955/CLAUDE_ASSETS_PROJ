import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

// GET /api/lifecycle-stages — returns all stages ordered by display_order
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const stages = await prisma.lifecycleStage.findMany({
    orderBy: { displayOrder: "asc" },
  });
  return ok(stages);
}
