import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

// GET /api/assets/:id/children — returns direct children in the hierarchy
export async function GET(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const parent = await prisma.asset.findUnique({ where: { id }, select: { id: true } });
  if (!parent) return err("Asset not found", 404);

  const children = await prisma.asset.findMany({
    where: { parentAssetId: id },
    include: {
      assetFamily: { select: { id: true, name: true } },
      assetType: { select: { id: true, name: true } },
      currentLifecycleStage: { select: { id: true, name: true, displayOrder: true } },
    },
    orderBy: { assetCode: "asc" },
  });

  return ok(children);
}
