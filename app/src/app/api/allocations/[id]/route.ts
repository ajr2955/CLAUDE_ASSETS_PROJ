import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

const INCLUDE = {
  asset: { select: { id: true, assetName: true, assetCode: true } },
  allocatedToBody: true,
};

// GET /api/allocations/:id
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const allocation = await prisma.allocation.findUnique({ where: { id }, include: INCLUDE });
  if (!allocation) return NextResponse.json(err("Not found"), { status: 404 });

  return NextResponse.json(ok(allocation));
}

// PUT /api/allocations/:id
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req, "asset_manager");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = await prisma.allocation.findUnique({ where: { id } });
  if (!existing) return NextResponse.json(err("Not found"), { status: 404 });

  if (existing.status === "terminated") {
    return NextResponse.json(err("Cannot update a terminated allocation"), { status: 422 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err("Invalid JSON body"), { status: 400 });
  }

  const updated = await prisma.allocation.update({
    where: { id },
    data: {
      ...(typeof body.end_date === "string" && { endDate: new Date(body.end_date) }),
      ...(body.end_date === null && { endDate: null }),
      ...(body.allocated_to_body_id !== undefined && { allocatedToBodyId: body.allocated_to_body_id as string | null }),
      ...(typeof body.allocated_to_name === "string" && { allocatedToName: body.allocated_to_name }),
      ...(body.area_sqm != null && { areaSqm: Number(body.area_sqm) }),
      ...(typeof body.usage_description === "string" && { usageDescription: body.usage_description }),
      ...(body.is_revenue_generating !== undefined && { isRevenueGenerating: body.is_revenue_generating === true }),
      ...(body.periodic_fee != null && { periodicFee: Number(body.periodic_fee) }),
      ...(typeof body.notes === "string" && { notes: body.notes }),
    },
    include: INCLUDE,
  });

  return NextResponse.json(ok(updated));
}
