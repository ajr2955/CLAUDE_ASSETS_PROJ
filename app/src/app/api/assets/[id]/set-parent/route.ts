import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAnyRole } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

// POST /api/assets/:id/set-parent — set or change the parent of an asset
export async function POST(req: NextRequest, { params }: Params) {
  const auth = requireAnyRole(req, ["asset_manager", "admin"]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const asset = await prisma.asset.findUnique({ where: { id }, select: { id: true, assetCode: true } });
  if (!asset) return err("Asset not found", 404);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  const { parent_asset_id } = body;

  // Allow clearing the parent by passing null
  if (parent_asset_id === null || parent_asset_id === undefined) {
    const updated = await prisma.asset.update({
      where: { id },
      data: { parentAssetId: null },
      select: { id: true, assetCode: true, assetName: true, parentAssetId: true },
    });
    return ok(updated);
  }

  if (typeof parent_asset_id !== "string") {
    return err("parent_asset_id must be a string UUID or null", 422);
  }

  // Cannot set asset as its own parent
  if (parent_asset_id === id) {
    return err("An asset cannot be its own parent", 422);
  }

  // Verify parent exists
  const parent = await prisma.asset.findUnique({
    where: { id: parent_asset_id },
    select: { id: true, assetCode: true },
  });
  if (!parent) return err("parent_asset_id references an asset that does not exist", 422);

  // Circular reference check: walk up from proposed parent to see if current asset appears
  let checkId: string | null = parent_asset_id;
  let safety = 0;
  while (checkId && safety < 20) {
    if (checkId === id) {
      return err(
        "Setting this parent would create a circular reference in the asset hierarchy",
        422
      );
    }
    const ancestor: { parentAssetId: string | null } | null = await prisma.asset.findUnique({
      where: { id: checkId },
      select: { parentAssetId: true },
    });
    checkId = ancestor?.parentAssetId ?? null;
    safety++;
  }

  const updated = await prisma.asset.update({
    where: { id },
    data: { parentAssetId: parent_asset_id },
    select: { id: true, assetCode: true, assetName: true, parentAssetId: true },
  });

  return ok(updated);
}
