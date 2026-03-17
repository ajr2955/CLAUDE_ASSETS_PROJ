import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { BodyType } from "@/generated/prisma/client";
import { requireAuth } from "@/lib/rbac";

// GET /api/responsible-bodies — returns all bodies with optional filters
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const bodyType = searchParams.get("body_type");
  const includePlaceholders = searchParams.get("include_placeholders");

  const where: Record<string, unknown> = {};

  if (bodyType) {
    if (!Object.values(BodyType).includes(bodyType as BodyType)) {
      return err("Invalid body_type value", 422);
    }
    where.bodyType = bodyType as BodyType;
  }

  if (includePlaceholders === "false") {
    where.isPlaceholder = false;
  }

  const bodies = await prisma.responsibleBody.findMany({
    where,
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
    orderBy: { name: "asc" },
  });

  return ok(bodies);
}

// POST /api/responsible-bodies — creates a new body (admin only)
export async function POST(req: NextRequest) {
  const auth = requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  const name: string | undefined = body.name;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return err("name is required", 422);
  }

  const bodyType: string | undefined = body.body_type;
  if (!bodyType || !Object.values(BodyType).includes(bodyType as BodyType)) {
    return err("body_type is required and must be a valid value", 422);
  }

  const trimmedName = name.trim();

  const existing = await prisma.responsibleBody.findUnique({ where: { name: trimmedName } });
  if (existing) return err("A responsible body with this name already exists", 422);

  const created = await prisma.responsibleBody.create({
    data: {
      name: trimmedName,
      bodyType: bodyType as BodyType,
      description: body.description ?? null,
      isPlaceholder: body.is_placeholder ?? false,
      resolutionNote: body.resolution_note ?? null,
    },
  });

  return ok(created, undefined, 201);
}
