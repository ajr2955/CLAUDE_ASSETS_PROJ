import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

type AssetNode = {
  id: string;
  assetCode: string;
  assetName: string;
  parentAssetId: string | null;
  assetFamily: { id: string; name: string };
  assetType: { id: string; name: string };
  currentLifecycleStage: { id: string; name: string; displayOrder: number };
  children: AssetNode[];
};

type FlatAsset = Omit<AssetNode, "children">;

const INCLUDE = {
  assetFamily: { select: { id: true, name: true } },
  assetType: { select: { id: true, name: true } },
  currentLifecycleStage: { select: { id: true, name: true, displayOrder: true } },
} as const;

const SELECT = {
  id: true,
  assetCode: true,
  assetName: true,
  parentAssetId: true,
  assetFamily: { select: { id: true, name: true } },
  assetType: { select: { id: true, name: true } },
  currentLifecycleStage: { select: { id: true, name: true, displayOrder: true } },
} as const;

void INCLUDE; // suppress unused warning

// GET /api/assets/tree — returns a nested tree structure
// Query params: root_asset_id (start from a specific asset), family_id (all roots in a family)
export async function GET(req: NextRequest) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const rootAssetId = searchParams.get("root_asset_id");
  const familyId = searchParams.get("family_id");

  if (!rootAssetId && !familyId) {
    return err("Either root_asset_id or family_id query parameter is required", 422);
  }

  if (rootAssetId) {
    const root = await prisma.asset.findUnique({ where: { id: rootAssetId }, select: SELECT });
    if (!root) return err("Root asset not found", 404);

    const tree = await buildSubtree(root as FlatAsset, 0, 5);
    return ok(tree);
  }

  // family_id mode: return forest of root-level assets in the family
  const roots = await prisma.asset.findMany({
    where: { assetFamilyId: familyId!, parentAssetId: null },
    select: SELECT,
    orderBy: { assetCode: "asc" },
  });

  const forest: AssetNode[] = [];
  for (const root of roots) {
    const subtree = await buildSubtree(root as FlatAsset, 0, 5);
    forest.push(subtree);
  }

  return ok(forest);
}

async function buildSubtree(asset: FlatAsset, depth: number, maxDepth: number): Promise<AssetNode> {
  const children: AssetNode[] = [];

  if (depth < maxDepth) {
    const childAssets = await prisma.asset.findMany({
      where: { parentAssetId: asset.id },
      select: SELECT,
      orderBy: { assetCode: "asc" },
    });

    for (const child of childAssets) {
      const childNode = await buildSubtree(child as FlatAsset, depth + 1, maxDepth);
      children.push(childNode);
    }
  }

  return { ...asset, children };
}
