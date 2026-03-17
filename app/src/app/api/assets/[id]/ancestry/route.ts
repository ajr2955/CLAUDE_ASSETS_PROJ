import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

// GET /api/assets/:id/ancestry — returns the full ancestor chain (root first, current asset last)
export async function GET(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const start = await prisma.asset.findUnique({
    where: { id },
    select: { id: true, parentAssetId: true, assetCode: true, assetName: true },
  });
  if (!start) return err("Asset not found", 404);

  // Walk up the tree
  const ancestors: Array<{ id: string; assetCode: string; assetName: string }> = [];
  let currentId: string | null = start.parentAssetId;

  // Safety limit to prevent infinite loops (max 20 levels)
  let safety = 0;
  while (currentId && safety < 20) {
    const ancestor = await prisma.asset.findUnique({
      where: { id: currentId },
      select: { id: true, parentAssetId: true, assetCode: true, assetName: true },
    });
    if (!ancestor) break;
    ancestors.unshift({ id: ancestor.id, assetCode: ancestor.assetCode, assetName: ancestor.assetName });
    currentId = ancestor.parentAssetId;
    safety++;
  }

  return ok(ancestors);
}
