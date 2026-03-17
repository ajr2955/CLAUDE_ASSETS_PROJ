import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

// GET /api/lifecycle-stages/:id — returns stage detail including outgoing transitions
export async function GET(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const stage = await prisma.lifecycleStage.findUnique({
    where: { id },
    include: {
      transitionsFrom: {
        where: { isActive: true },
        include: {
          toStage: { select: { id: true, name: true, displayOrder: true } },
          appliesToFamily: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!stage) return err("Lifecycle stage not found", 404);

  return ok(stage);
}
