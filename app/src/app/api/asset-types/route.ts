import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

// GET /api/asset-types — returns all active types, supports ?family_id= filter
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const familyId = searchParams.get("family_id");

  const types = await prisma.assetType.findMany({
    where: {
      isActive: true,
      ...(familyId ? { assetFamilyId: familyId } : {}),
    },
    include: { assetFamily: { select: { id: true, name: true } } },
    orderBy: [{ assetFamilyId: "asc" }, { name: "asc" }],
  });
  return ok(types);
}

// POST /api/asset-types — creates a new type (admin only)
export async function POST(req: NextRequest) {
  const auth = requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  const familyId: string | undefined = body.asset_family_id;
  if (!familyId || typeof familyId !== "string") {
    return err("asset_family_id is required", 422);
  }

  const name: string | undefined = body.name;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return err("name is required", 422);
  }
  if (name.trim().length > 120) {
    return err("name must be 120 characters or fewer", 422);
  }

  const trimmedName = name.trim();

  const family = await prisma.assetFamily.findUnique({ where: { id: familyId } });
  if (!family) return err("Asset family not found", 422);

  const existing = await prisma.assetType.findUnique({
    where: { assetFamilyId_name: { assetFamilyId: familyId, name: trimmedName } },
  });
  if (existing) return err("An asset type with this name already exists in this family", 422);

  const type = await prisma.assetType.create({
    data: {
      assetFamilyId: familyId,
      name: trimmedName,
      description: body.description ?? null,
    },
    include: { assetFamily: { select: { id: true, name: true } } },
  });
  return ok(type, undefined, 201);
}
