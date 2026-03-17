import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";
import { BudgetType } from "@/generated/prisma/client";

// GET /api/reports/budget-variance (operations_manager+)
// Returns all assets with at least one budget_variance_detected governance event in the current fiscal year
// Supports filters: family_id, body_id, fiscal_year, budget_type
export async function GET(req: NextRequest) {
  const auth = requireAuth(req, "operations_manager");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const familyId = searchParams.get("family_id");
  const bodyId = searchParams.get("body_id");
  const fiscalYearParam = searchParams.get("fiscal_year");
  const budgetTypeParam = searchParams.get("budget_type");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get("per_page") ?? "25")));

  if (budgetTypeParam && !Object.values(BudgetType).includes(budgetTypeParam as BudgetType)) {
    return err(`Invalid budget_type: ${budgetTypeParam}`, 422);
  }

  const currentYear = new Date().getFullYear();
  const targetYear = fiscalYearParam ? Number(fiscalYearParam) : currentYear;

  // Year boundaries for governance event lookup
  const yearStart = new Date(`${targetYear}-01-01T00:00:00.000Z`);
  const yearEnd = new Date(`${targetYear}-12-31T23:59:59.999Z`);

  // Find assets that have a budget_variance_detected event in the target year
  const varianceEventType = await prisma.eventType.findFirst({
    where: { name: "budget_variance_detected" },
    select: { id: true },
  });

  if (!varianceEventType) {
    return ok({ data: [], meta: { page, per_page: perPage, total: 0 } });
  }

  // Build asset where clause
  const assetWhere: Record<string, unknown> = {};
  if (familyId) assetWhere.assetFamilyId = familyId;
  if (bodyId) {
    assetWhere.OR = [
      { responsibleBodyId: bodyId },
      { operationalBodyId: bodyId },
      { maintenanceBodyId: bodyId },
      { strategicOwnerBodyId: bodyId },
    ];
  }

  // Find envelope where clause for budget_type filter
  const envelopeWhere: Record<string, unknown> = { varianceEventCreated: true };
  if (budgetTypeParam) envelopeWhere.budgetType = budgetTypeParam;
  if (fiscalYearParam) envelopeWhere.fiscalYear = targetYear;

  // Get asset IDs that have variance events in the target year
  const varianceEvents = await prisma.event.findMany({
    where: {
      eventTypeId: varianceEventType.id,
      occurredAt: { gte: yearStart, lte: yearEnd },
      isSystemGenerated: true,
    },
    select: { assetId: true },
    distinct: ["assetId"],
  });

  const assetIdsWithVariance = varianceEvents.map((e) => e.assetId);
  if (assetIdsWithVariance.length === 0) {
    return ok({ data: [], meta: { page, per_page: perPage, total: 0 } });
  }

  assetWhere.id = { in: assetIdsWithVariance };

  const total = await prisma.asset.count({ where: assetWhere as never });

  const assets = await prisma.asset.findMany({
    where: assetWhere as never,
    skip: (page - 1) * perPage,
    take: perPage,
    include: {
      assetFamily: { select: { id: true, name: true } },
      assetType: { select: { id: true, name: true } },
      responsibleBody: { select: { id: true, name: true } },
      budgetEnvelopes: {
        where: envelopeWhere as never,
        select: {
          id: true,
          budgetType: true,
          fiscalYear: true,
          approvedAmount: true,
          actualAmount: true,
          varianceAmount: true,
        },
      },
    },
    orderBy: { assetCode: "asc" },
  });

  const result = assets.map((a) => ({
    asset_id: a.id,
    asset_code: a.assetCode,
    asset_name: a.assetName,
    family: a.assetFamily,
    type: a.assetType,
    responsible_body: a.responsibleBody,
    variance_envelopes: a.budgetEnvelopes.map((e) => ({
      id: e.id,
      budget_type: e.budgetType,
      fiscal_year: e.fiscalYear,
      approved_amount: Number(e.approvedAmount),
      actual_amount: Number(e.actualAmount),
      variance_amount: Number(e.varianceAmount),
      variance_percent:
        Number(e.approvedAmount) > 0
          ? Math.round(
              ((Number(e.actualAmount) - Number(e.approvedAmount)) / Number(e.approvedAmount)) *
                100 *
                10
            ) / 10
          : null,
    })),
  }));

  return ok(result, { page, per_page: perPage, total });
}
