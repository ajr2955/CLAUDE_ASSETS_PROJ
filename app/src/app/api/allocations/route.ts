import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";
import { AllocationStatus, AllocationType } from "@/generated/prisma/client";

const INCLUDE = {
  asset: { select: { id: true, assetName: true, assetCode: true } },
  allocatedToBody: true,
};

// GET /api/allocations
export async function GET(req: NextRequest) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const assetId = sp.get("asset_id");
  const status = sp.get("status");
  const allocationType = sp.get("allocation_type");
  const isRevenueGenerating = sp.get("is_revenue_generating");
  const expiringWithinDays = sp.get("expiring_within_days");
  const page = Math.max(1, parseInt(sp.get("page") ?? "1"));
  const perPage = Math.min(100, Math.max(1, parseInt(sp.get("per_page") ?? "25")));

  if (status && !Object.values(AllocationStatus).includes(status as AllocationStatus)) {
    return NextResponse.json(err("Invalid status value"), { status: 422 });
  }
  if (allocationType && !Object.values(AllocationType).includes(allocationType as AllocationType)) {
    return NextResponse.json(err("Invalid allocation_type value"), { status: 422 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (assetId) where.assetId = assetId;
  if (status) where.status = status as AllocationStatus;
  if (allocationType) where.allocationType = allocationType as AllocationType;
  if (isRevenueGenerating === "true") where.isRevenueGenerating = true;
  if (isRevenueGenerating === "false") where.isRevenueGenerating = false;

  if (expiringWithinDays) {
    const days = parseInt(expiringWithinDays);
    if (!isNaN(days)) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + days);
      where.endDate = { lte: cutoff };
      where.status = { in: [AllocationStatus.active, AllocationStatus.pending] };
    }
  }

  const [total, allocations] = await Promise.all([
    prisma.allocation.count({ where }),
    prisma.allocation.findMany({
      where,
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);

  return NextResponse.json(ok(allocations, { page, per_page: perPage, total }));
}

// POST /api/allocations
export async function POST(req: NextRequest) {
  const auth = requireAuth(req, "asset_manager");
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err("Invalid JSON body"), { status: 400 });
  }

  const { asset_id, allocation_type, start_date } = body;
  if (!asset_id || typeof asset_id !== "string") {
    return NextResponse.json(err("asset_id is required"), { status: 422 });
  }
  if (!allocation_type || !Object.values(AllocationType).includes(allocation_type as AllocationType)) {
    return NextResponse.json(err("allocation_type is required and must be valid"), { status: 422 });
  }
  if (!start_date || typeof start_date !== "string") {
    return NextResponse.json(err("start_date is required"), { status: 422 });
  }

  const asset = await prisma.asset.findUnique({ where: { id: asset_id } });
  if (!asset) return NextResponse.json(err("asset not found"), { status: 422 });

  // Find asset_transferred event type
  const eventType = await prisma.eventType.findFirst({ where: { name: "asset_transferred" } });

  const [allocation] = await prisma.$transaction([
    prisma.allocation.create({
      data: {
        assetId: asset_id,
        allocationType: allocation_type as AllocationType,
        startDate: new Date(start_date),
        endDate: typeof body.end_date === "string" ? new Date(body.end_date) : undefined,
        allocatedToBodyId: typeof body.allocated_to_body_id === "string" ? body.allocated_to_body_id : undefined,
        allocatedToName: typeof body.allocated_to_name === "string" ? body.allocated_to_name : undefined,
        areaSqm: body.area_sqm != null ? Number(body.area_sqm) : undefined,
        usageDescription: typeof body.usage_description === "string" ? body.usage_description : undefined,
        isRevenueGenerating: body.is_revenue_generating === true,
        periodicFee: body.periodic_fee != null ? Number(body.periodic_fee) : undefined,
        notes: typeof body.notes === "string" ? body.notes : undefined,
      },
      include: INCLUDE,
    }),
    ...(eventType
      ? [
          prisma.event.create({
            data: {
              eventTypeId: eventType.id,
              assetId: asset_id,
              isSystemGenerated: false,
              description: `Asset allocated (${allocation_type})${body.allocated_to_name ? ` to ${body.allocated_to_name}` : ""}`,
            },
          }),
        ]
      : []),
  ]);

  return NextResponse.json(ok(allocation), { status: 201 });
}
