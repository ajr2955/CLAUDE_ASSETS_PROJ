import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";
import { RevenueStatus } from "@/generated/prisma/client";

// PUT /api/revenue-records/:id/mark-received
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req, "asset_manager");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const record = await prisma.revenueRecord.findUnique({ where: { id } });
  if (!record) return NextResponse.json(err("Not found"), { status: 404 });

  if (record.status === RevenueStatus.waived) {
    return NextResponse.json(err("Cannot mark a waived record as received"), { status: 422 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err("Invalid JSON body"), { status: 400 });
  }

  const { actual_amount, payment_date } = body;
  if (actual_amount == null) return NextResponse.json(err("actual_amount is required"), { status: 422 });

  const actualAmountNum = Number(actual_amount);
  const expectedAmountNum = Number(record.expectedAmount);

  const newStatus: RevenueStatus =
    actualAmountNum >= expectedAmountNum ? RevenueStatus.received : RevenueStatus.partial;

  const updated = await prisma.revenueRecord.update({
    where: { id },
    data: {
      actualAmount: actualAmountNum,
      paymentDate: typeof payment_date === "string" ? new Date(payment_date) : new Date(),
      status: newStatus,
    },
    include: {
      asset: { select: { id: true, assetName: true, assetCode: true } },
    },
  });

  return NextResponse.json(ok(updated));
}
