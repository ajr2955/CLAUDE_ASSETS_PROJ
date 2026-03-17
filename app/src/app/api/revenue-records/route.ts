import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";
import { RevenueType, RevenueStatus } from "@/generated/prisma/client";

const INCLUDE = {
  asset: { select: { id: true, assetName: true, assetCode: true } },
  allocation: { select: { id: true, allocationType: true, allocatedToName: true } },
  contract: { select: { id: true, contractReference: true, counterpartyName: true } },
};

// GET /api/revenue-records
export async function GET(req: NextRequest) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const assetId = sp.get("asset_id");
  const status = sp.get("status");
  const revenueType = sp.get("revenue_type");
  const periodStartFrom = sp.get("period_start_from");
  const periodEndTo = sp.get("period_end_to");
  const page = Math.max(1, parseInt(sp.get("page") ?? "1"));
  const perPage = Math.min(100, Math.max(1, parseInt(sp.get("per_page") ?? "25")));

  if (status && !Object.values(RevenueStatus).includes(status as RevenueStatus)) {
    return NextResponse.json(err("Invalid status value"), { status: 422 });
  }
  if (revenueType && !Object.values(RevenueType).includes(revenueType as RevenueType)) {
    return NextResponse.json(err("Invalid revenue_type value"), { status: 422 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (assetId) where.assetId = assetId;
  if (status) where.status = status as RevenueStatus;
  if (revenueType) where.revenueType = revenueType as RevenueType;
  if (periodStartFrom) where.periodStart = { gte: new Date(periodStartFrom) };
  if (periodEndTo) {
    where.periodEnd = { ...(where.periodEnd ?? {}), lte: new Date(periodEndTo) };
  }

  const [total, records] = await Promise.all([
    prisma.revenueRecord.count({ where }),
    prisma.revenueRecord.findMany({
      where,
      include: INCLUDE,
      orderBy: { periodStart: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);

  return NextResponse.json(ok(records, { page, per_page: perPage, total }));
}

// POST /api/revenue-records
export async function POST(req: NextRequest) {
  const auth = requireAuth(req, "asset_manager");
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err("Invalid JSON body"), { status: 400 });
  }

  const { asset_id, revenue_type, period_start, period_end } = body;
  if (!asset_id || typeof asset_id !== "string") return NextResponse.json(err("asset_id is required"), { status: 422 });
  if (!revenue_type || !Object.values(RevenueType).includes(revenue_type as RevenueType)) {
    return NextResponse.json(err("revenue_type is required and must be valid"), { status: 422 });
  }
  if (!period_start || typeof period_start !== "string") return NextResponse.json(err("period_start is required"), { status: 422 });
  if (!period_end || typeof period_end !== "string") return NextResponse.json(err("period_end is required"), { status: 422 });

  const asset = await prisma.asset.findUnique({ where: { id: asset_id }, select: { id: true } });
  if (!asset) return NextResponse.json(err("asset not found"), { status: 422 });

  const expectedAmount = body.expected_amount != null ? Number(body.expected_amount) : 0;
  const actualAmount = body.actual_amount != null ? Number(body.actual_amount) : 0;

  // Default status logic
  let status: RevenueStatus = RevenueStatus.expected;
  if (expectedAmount > 0 && actualAmount === 0) {
    status = RevenueStatus.expected;
  } else if (actualAmount > 0 && actualAmount >= expectedAmount) {
    status = RevenueStatus.received;
  } else if (actualAmount > 0 && actualAmount < expectedAmount) {
    status = RevenueStatus.partial;
  }

  const record = await prisma.revenueRecord.create({
    data: {
      assetId: asset_id,
      revenueType: revenue_type as RevenueType,
      periodStart: new Date(period_start),
      periodEnd: new Date(period_end),
      expectedAmount,
      actualAmount,
      status,
      allocationId: typeof body.allocation_id === "string" ? body.allocation_id : undefined,
      contractId: typeof body.contract_id === "string" ? body.contract_id : undefined,
      paymentDate: typeof body.payment_date === "string" ? new Date(body.payment_date) : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    },
    include: INCLUDE,
  });

  return NextResponse.json(ok(record), { status: 201 });
}
