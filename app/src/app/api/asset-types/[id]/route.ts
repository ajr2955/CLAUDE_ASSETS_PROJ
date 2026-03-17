import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

// GET /api/asset-types/:id — returns a single type
export async function GET(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const type = await prisma.assetType.findUnique({
    where: { id },
    include: { assetFamily: { select: { id: true, name: true } } },
  });
  if (!type) return err("Asset type not found", 404);
  return ok(type);
}

// PUT /api/asset-types/:id — updates name, description, is_active (admin only)
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  const type = await prisma.assetType.findUnique({ where: { id } });
  if (!type) return err("Asset type not found", 404);

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return err("name must be a non-empty string", 422);
    }
    if (body.name.trim().length > 120) {
      return err("name must be 120 characters or fewer", 422);
    }
    const conflict = await prisma.assetType.findFirst({
      where: {
        assetFamilyId: type.assetFamilyId,
        name: body.name.trim(),
        id: { not: id },
      },
    });
    if (conflict) return err("An asset type with this name already exists in this family", 422);
  }

  const updated = await prisma.assetType.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.is_active !== undefined && { isActive: Boolean(body.is_active) }),
    },
    include: { assetFamily: { select: { id: true, name: true } } },
  });
  return ok(updated);
}
