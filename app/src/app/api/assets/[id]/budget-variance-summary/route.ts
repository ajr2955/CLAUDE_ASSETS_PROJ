import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

// GET /api/assets/:id/budget-variance-summary (operations_manager+)
// Returns all budget envelopes for this asset where variance_amount < 0 (overrun)
export async function GET(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req, "operations_manager");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const asset = await prisma.asset.findUnique({
    where: { id },
    select: { id: true, assetName: true, assetCode: true },
  });
  if (!asset) return err("Asset not found", 404);

  // varianceAmount = approvedAmount - actualAmount; negative means overrun
  const envelopes = await prisma.budgetEnvelope.findMany({
    where: {
      assetId: id,
      varianceAmount: { lt: 0 },
    },
    include: {
      lifecycleStage: { select: { id: true, name: true } },
    },
    orderBy: { varianceAmount: "asc" }, // most negative first
  });

  const summary = envelopes.map((e) => {
    const approved = Number(e.approvedAmount);
    const actual = Number(e.actualAmount);
    const variance = Number(e.varianceAmount);
    const variancePercent =
      approved > 0 ? Math.round(((actual - approved) / approved) * 100 * 10) / 10 : null;
    return {
      id: e.id,
      budget_type: e.budgetType,
      fiscal_year: e.fiscalYear,
      is_multi_year: e.isMultiYear,
      multi_year_start: e.multiYearStart,
      multi_year_end: e.multiYearEnd,
      approved_amount: approved,
      committed_amount: Number(e.committedAmount),
      actual_amount: actual,
      variance_amount: variance,
      variance_percent: variancePercent,
      lifecycle_stage: e.lifecycleStage,
      is_closed: e.isClosed,
      variance_event_created: e.varianceEventCreated,
    };
  });

  return ok({
    asset,
    overrun_envelopes: summary,
    total_overrun: summary.reduce((sum, e) => sum + e.variance_amount, 0),
    envelope_count: summary.length,
  });
}
