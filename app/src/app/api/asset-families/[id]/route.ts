import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

// GET /api/asset-families/:id — returns single family with its asset types
export async function GET(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const family = await prisma.assetFamily.findUnique({
    where: { id },
    include: { assetTypes: { where: { isActive: true }, orderBy: { name: "asc" } } },
  });
  if (!family) return err("Asset family not found", 404);
  return ok(family);
}

// PUT /api/asset-families/:id — updates name, description, is_active (admin only)
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  const family = await prisma.assetFamily.findUnique({ where: { id } });
  if (!family) return err("Asset family not found", 404);

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return err("name must be a non-empty string", 422);
    }
    if (body.name.trim().length > 120) {
      return err("name must be 120 characters or fewer", 422);
    }
    const conflict = await prisma.assetFamily.findFirst({
      where: { name: body.name.trim(), id: { not: id } },
    });
    if (conflict) return err("An asset family with this name already exists", 422);
  }

  const updated = await prisma.assetFamily.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.is_active !== undefined && { isActive: Boolean(body.is_active) }),
    },
  });
  return ok(updated);
}
