import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { BodyType } from "@/generated/prisma/client";
import { requireAuth } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

// GET /api/responsible-bodies/:id — returns body detail including asset counts by role
export async function GET(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const body = await prisma.responsibleBody.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          assetsAsStrategicOwner: true,
          assetsAsResponsible: true,
          assetsAsOperational: true,
          assetsAsMaintenance: true,
          assetsAsDataSteward: true,
        },
      },
    },
  });

  if (!body) return err("Responsible body not found", 404);

  return ok({
    ...body,
    asset_counts_by_role: {
      strategic_owner: body._count.assetsAsStrategicOwner,
      responsible: body._count.assetsAsResponsible,
      operational: body._count.assetsAsOperational,
      maintenance: body._count.assetsAsMaintenance,
      data_steward: body._count.assetsAsDataSteward,
    },
  });
}

// PUT /api/responsible-bodies/:id — updates mutable fields (admin only)
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  const existing = await prisma.responsibleBody.findUnique({ where: { id } });
  if (!existing) return err("Responsible body not found", 404);

  // Placeholder bodies cannot be deactivated without explicit confirmation
  if (
    existing.isPlaceholder &&
    body.is_active === false &&
    body.confirm_deactivate_placeholder !== true
  ) {
    return err(
      "Placeholder bodies cannot be deactivated without explicit confirmation. Pass confirm_deactivate_placeholder: true to proceed.",
      422
    );
  }

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return err("name must be a non-empty string", 422);
    }
    const conflict = await prisma.responsibleBody.findFirst({
      where: { name: body.name.trim(), id: { not: id } },
    });
    if (conflict) return err("A responsible body with this name already exists", 422);
  }

  if (body.body_type !== undefined) {
    if (!Object.values(BodyType).includes(body.body_type as BodyType)) {
      return err("Invalid body_type value", 422);
    }
  }

  const updated = await prisma.responsibleBody.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.body_type !== undefined && { bodyType: body.body_type as BodyType }),
      ...(body.is_active !== undefined && { isActive: Boolean(body.is_active) }),
      ...(body.resolution_note !== undefined && { resolutionNote: body.resolution_note }),
    },
  });

  return ok(updated);
}
