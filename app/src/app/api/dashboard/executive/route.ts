/**
 * US-066: Executive KPI dashboard — backend
 *
 * GET /api/dashboard/executive
 * Returns cross-portfolio KPIs for the executive dashboard.
 * Requires asset_manager or admin role.
 * Response is cached for DASHBOARD_CACHE_TTL_MS (default 5 minutes).
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

// ─── Simple in-memory cache ───────────────────────────────────────────────────

const CACHE_TTL_MS = parseInt(
  process.env.DASHBOARD_CACHE_TTL_MS ?? String(5 * 60 * 1000),
  10
);

let cachedData: unknown = null;
let cacheExpiresAt = 0;

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = requireAuth(req, "asset_manager");
  if (auth instanceof Response) return auth;

  // Return cached response if still fresh
  if (cachedData && Date.now() < cacheExpiresAt) {
    return ok(cachedData);
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const startOfYear = new Date(currentYear, 0, 1);

  // ─── Run all queries in parallel ──────────────────────────────────────────

  const [
    // 1. total_assets: grouped by status and family
    assetsByStatus,
    assetsByFamily,

    // 2. assets_by_lifecycle_stage
    assetsByStage,

    // 3. assets_at_risk: risk score in High or Critical band
    assetsAtRisk,

    // 4. open_exceptions proxy data
    contractsExpired,
    contractsExpiring30,
    contractsExpiring60,
    contractsExpiring90,
    safetyHazards,
    criticalCondition,
    overdueWorkOrders,
    budgetOverruns,
    placeholderBodyAssets,
    noConditionIn1Year,
    handoverPending30,

    // 5. developer_obligations_summary
    devObligationsTotal,
    devObligationsDelivered,
    devObligationsOverdue,
    devObligationsPlaceholder,

    // 6. planning_entities_summary
    planningEntitiesTotal,
    planningEntitiesConverted,
    planningEntitiesOverdue,

    // 7. budget_variance_summary — assets with variance events this fiscal year
    budgetVarianceEvents,

    // 8. maintenance_backlog_summary
    maintenanceBacklog,
    maintenanceOverdue,

    // 9. placeholder_bodies_summary
    placeholderBodies,
  ] = await Promise.all([
    // 1a. count by status
    prisma.asset.groupBy({ by: ["currentStatus"], _count: { id: true } }),

    // 1b. count by family
    prisma.asset.groupBy({
      by: ["assetFamilyId"],
      _count: { id: true },
    }),

    // 2. assets by lifecycle stage + family
    prisma.asset.groupBy({
      by: ["currentLifecycleStageId", "assetFamilyId"],
      _count: { id: true },
    }),

    // 3. assets at risk
    prisma.assetRiskScore.count({
      where: { riskBand: { in: ["High", "Critical"] } },
    }),

    // 4a. expired contracts
    prisma.contract.count({
      where: { status: "active", endDate: { lt: now } },
    }),

    // 4b. contracts expiring within 30 days
    prisma.contract.count({
      where: {
        status: "active",
        endDate: { gte: now, lte: new Date(now.getTime() + 30 * 86400000) },
      },
    }),

    // 4c. contracts expiring within 60 days
    prisma.contract.count({
      where: {
        status: "active",
        endDate: { gte: now, lte: new Date(now.getTime() + 60 * 86400000) },
      },
    }),

    // 4d. contracts expiring within 90 days
    prisma.contract.count({
      where: {
        status: "active",
        endDate: { gte: now, lte: new Date(now.getTime() + 90 * 86400000) },
      },
    }),

    // 4e. safety hazards
    prisma.conditionRecord.count({
      where: { safetyCondition: { in: ["unsafe", "major_hazard"] } },
    }),

    // 4f. critical condition (score = 1)
    prisma.conditionRecord.count({
      where: { conditionScore: 1 },
    }),

    // 4g. overdue work orders (critical or high, past target date, open)
    prisma.workOrder.count({
      where: {
        priority: { in: ["critical", "high"] },
        status: { notIn: ["closed", "cancelled"] },
        targetCompletionDate: { lt: now },
      },
    }),

    // 4h. budget overruns
    prisma.budgetEnvelope.count({
      where: { varianceAmount: { lt: 0 }, isClosed: false },
    }),

    // 4i. assets assigned to placeholder bodies
    prisma.asset.count({ where: { isPlaceholderBody: true } }),

    // 4j. assets with no condition record in last 12 months
    prisma.asset
      .findMany({
        where: { currentStatus: { notIn: ["disposed", "decommissioned"] } },
        select: { id: true },
      })
      .then(async (assets) => {
        const oneYearAgo = new Date(now.getTime() - 365 * 86400000);
        const recentInspections = await prisma.conditionRecord.findMany({
          where: { inspectionDate: { gte: oneYearAgo } },
          select: { assetId: true },
          distinct: ["assetId"],
        });
        const inspectedSet = new Set(recentInspections.map((r) => r.assetId));
        return assets.filter((a) => !inspectedSet.has(a.id)).length;
      }),

    // 4k. handovers pending for over 30 days
    prisma.handoverRecord.count({
      where: {
        handoverStatus: "pending",
        handoverDate: { lt: new Date(now.getTime() - 30 * 86400000) },
      },
    }),

    // 5a. developer obligations total
    prisma.developerObligation.count(),

    // 5b. developer obligations delivered
    prisma.developerObligation.count({
      where: { status: { in: ["delivered"] } },
    }),

    // 5c. developer obligations overdue
    prisma.developerObligation.count({
      where: {
        status: { notIn: ["delivered", "closed_gap_identified"] },
        committedDeliveryDate: { lt: now },
      },
    }),

    // 5d. developer obligations with placeholder receiving body
    prisma.developerObligation.count({
      where: { receivingBodyIsPlaceholder: true },
    }),

    // 6a. planning entities total
    prisma.planningEntity.count(),

    // 6b. planning entities converted
    prisma.planningEntity.count({
      where: { status: "converted_to_asset" },
    }),

    // 6c. planning entities overdue
    prisma.planningEntity.count({
      where: {
        status: { notIn: ["delivered", "converted_to_asset"] },
        targetDeliveryDate: { lt: now },
      },
    }),

    // 7. budget variance events this fiscal year (distinct assetIds)
    prisma.event.findMany({
      where: {
        isSystemGenerated: true,
        occurredAt: { gte: startOfYear },
        eventType: { name: "budget_variance_detected" },
      },
      select: { assetId: true, metadata: true },
      distinct: ["assetId"],
    }),

    // 8a. maintenance backlog totals
    prisma.workOrder.aggregate({
      where: { status: { notIn: ["closed", "cancelled"] } },
      _count: { id: true },
      _sum: { estimatedCost: true },
    }),

    // 8b. overdue work orders
    prisma.workOrder.count({
      where: {
        status: { notIn: ["closed", "cancelled"] },
        targetCompletionDate: { lt: now },
      },
    }),

    // 9. placeholder bodies with asset counts
    prisma.responsibleBody.findMany({
      where: { isPlaceholder: true },
      select: {
        id: true,
        name: true,
        resolutionNote: true,
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
    }),
  ]);

  // ─── Resolve stage and family names for lifecycle breakdown ────────────────
  const stageIds = [...new Set(assetsByStage.map((r) => r.currentLifecycleStageId))];
  const familyIds = [...new Set([
    ...assetsByStage.map((r) => r.assetFamilyId),
    ...assetsByFamily.map((r) => r.assetFamilyId),
  ])];

  const [stages, families] = await Promise.all([
    prisma.lifecycleStage.findMany({
      where: { id: { in: stageIds } },
      select: { id: true, name: true, displayOrder: true },
    }),
    prisma.assetFamily.findMany({
      where: { id: { in: familyIds } },
      select: { id: true, name: true },
    }),
  ]);

  const stageMap = Object.fromEntries(stages.map((s) => [s.id, s.name]));
  const familyMap = Object.fromEntries(families.map((f) => [f.id, f.name]));

  // ─── Compute budget_variance_summary ─────────────────────────────────────
  let totalVarianceAmount = 0;
  for (const event of budgetVarianceEvents) {
    const meta = event.metadata as Record<string, unknown> | null;
    if (meta && typeof meta["variance_amount"] === "number") {
      totalVarianceAmount += meta["variance_amount"] as number;
    }
  }

  // ─── Compute open_exceptions summary ────────────────────────────────────
  const openExceptions = [
    { exception_type: "contract_expired", severity: "high", count: contractsExpired },
    { exception_type: "safety_hazard", severity: "critical", count: safetyHazards },
    { exception_type: "critical_condition", severity: "critical", count: criticalCondition },
    { exception_type: "overdue_work_order", severity: "high", count: overdueWorkOrders },
    { exception_type: "budget_overrun", severity: "high", count: budgetOverruns },
    { exception_type: "placeholder_body_assigned", severity: "medium", count: placeholderBodyAssets },
    {
      exception_type: "no_condition_record_in_1_year",
      severity: "medium",
      count: noConditionIn1Year,
    },
    {
      exception_type: "handover_pending_over_30_days",
      severity: "medium",
      count: handoverPending30,
    },
  ].filter((e) => e.count > 0);

  // ─── Compute placeholder_bodies_summary ──────────────────────────────────
  const placeholderBodiesWithCounts = placeholderBodies.map((b) => ({
    id: b.id,
    name: b.name,
    resolution_note: b.resolutionNote,
    asset_count:
      b._count.assetsAsStrategicOwner +
      b._count.assetsAsResponsible +
      b._count.assetsAsOperational +
      b._count.assetsAsMaintenance +
      b._count.assetsAsDataSteward,
  }));

  // ─── Build response ───────────────────────────────────────────────────────
  const dashboard = {
    total_assets: {
      by_status: assetsByStatus.map((r) => ({
        status: r.currentStatus,
        count: r._count.id,
      })),
      by_family: assetsByFamily.map((r) => ({
        family_id: r.assetFamilyId,
        family_name: familyMap[r.assetFamilyId] ?? r.assetFamilyId,
        count: r._count.id,
      })),
      total: assetsByStatus.reduce((sum, r) => sum + r._count.id, 0),
    },

    assets_by_lifecycle_stage: assetsByStage.map((r) => ({
      stage_id: r.currentLifecycleStageId,
      stage_name: stageMap[r.currentLifecycleStageId] ?? r.currentLifecycleStageId,
      family_id: r.assetFamilyId,
      family_name: familyMap[r.assetFamilyId] ?? r.assetFamilyId,
      count: r._count.id,
    })),

    assets_at_risk: {
      count: assetsAtRisk,
    },

    open_exceptions: {
      total: openExceptions.reduce((s, e) => s + e.count, 0),
      by_type: openExceptions,
    },

    developer_obligations_summary: {
      total: devObligationsTotal,
      delivered: devObligationsDelivered,
      overdue: devObligationsOverdue,
      placeholder_receiving_body: devObligationsPlaceholder,
    },

    planning_entities_summary: {
      total: planningEntitiesTotal,
      converted: planningEntitiesConverted,
      overdue: planningEntitiesOverdue,
    },

    budget_variance_summary: {
      assets_with_variance_events: budgetVarianceEvents.length,
      total_variance_amount: Math.round(totalVarianceAmount * 100) / 100,
      fiscal_year: currentYear,
    },

    maintenance_backlog_summary: {
      total_open: maintenanceBacklog._count.id ?? 0,
      total_overdue: maintenanceOverdue,
      estimated_cost_total: Number(maintenanceBacklog._sum.estimatedCost ?? 0),
    },

    contracts_expiring_summary: {
      within_30_days: contractsExpiring30,
      within_60_days: contractsExpiring60,
      within_90_days: contractsExpiring90,
    },

    placeholder_bodies_summary: {
      total_assets_on_placeholder_bodies: placeholderBodiesWithCounts.reduce(
        (s, b) => s + b.asset_count,
        0
      ),
      placeholder_bodies: placeholderBodiesWithCounts,
    },

    cached_at: new Date().toISOString(),
  };

  // Store in cache
  cachedData = dashboard;
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;

  return ok(dashboard);
}
