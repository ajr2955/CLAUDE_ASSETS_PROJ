import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

// GET /api/assets/:id/descendants — returns all descendants recursively, up to 5 levels deep
export async function GET(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const root = await prisma.asset.findUnique({ where: { id }, select: { id: true } });
  if (!root) return err("Asset not found", 404);

  const MAX_DEPTH = 5;
  const allDescendants: Array<{
    id: string;
    assetCode: string;
    assetName: string;
    parentAssetId: string | null;
    depth: number;
    assetFamily: { id: string; name: string };
    assetType: { id: string; name: string };
    currentLifecycleStage: { id: string; name: string; displayOrder: number };
  }> = [];

  // BFS level by level up to MAX_DEPTH
  let currentLevelIds = [id];

  for (let depth = 1; depth <= MAX_DEPTH && currentLevelIds.length > 0; depth++) {
    const children = await prisma.asset.findMany({
      where: { parentAssetId: { in: currentLevelIds } },
      select: {
        id: true,
        assetCode: true,
        assetName: true,
        parentAssetId: true,
        assetFamily: { select: { id: true, name: true } },
        assetType: { select: { id: true, name: true } },
        currentLifecycleStage: { select: { id: true, name: true, displayOrder: true } },
      },
      orderBy: { assetCode: "asc" },
    });

    for (const child of children) {
      allDescendants.push({ ...child, depth });
    }

    currentLevelIds = children.map((c) => c.id);
  }

  return ok(allDescendants);
}
