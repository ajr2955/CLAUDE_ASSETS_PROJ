import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

// GET /api/asset-families — returns all active families
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const families = await prisma.assetFamily.findMany({
    where: { isActive: true },
    include: { _count: { select: { assetTypes: true } } },
    orderBy: { name: "asc" },
  });
  return ok(families);
}

// POST /api/asset-families — creates a new family (admin only)
export async function POST(req: NextRequest) {
  const auth = requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  const name: string | undefined = body.name;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return err("name is required", 422);
  }
  if (name.trim().length > 120) {
    return err("name must be 120 characters or fewer", 422);
  }

  const trimmedName = name.trim();

  const existing = await prisma.assetFamily.findUnique({ where: { name: trimmedName } });
  if (existing) return err("An asset family with this name already exists", 422);

  const family = await prisma.assetFamily.create({
    data: {
      name: trimmedName,
      description: body.description ?? null,
    },
  });
  return ok(family, undefined, 201);
}
