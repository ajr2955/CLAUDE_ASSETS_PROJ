/**
 * US-067: Department-level dashboard — backend
 *
 * GET /api/dashboard/department?body_id=<uuid>
 * Returns department-scoped KPIs for a specific responsible body.
 * body_id is required for admin; auto-resolved from JWT for
 * department_user and operations_manager roles.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth, hasMinRole } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(req.url);
  let bodyId: string | null = searchParams.get("body_id");

  // For non-admin roles, auto-resolve from JWT user's responsible_body_id
  if (!hasMinRole(auth.role, "asset_manager")) {
    // Look up the user's responsible_body_id from DB
    const user = await prisma.user.findUnique({
      where: { id: auth.sub },
      select: { responsibleBodyId: true },
    });
    if (!user?.responsibleBodyId) {
      return err(
        "No responsible body assigned to your user account. Ask an admin to set one.",
        400
      );
    }
    bodyId = user.responsibleBodyId;
  } else if (!bodyId) {
    return err("body_id query parameter is required for admin and asset_manager roles", 400);
  }

  // Validate body exists
  const body = await prisma.responsibleBody.findUnique({
    where: { id: bodyId },
    select: { id: true, name: true },
  });
  if (!body) {
    return err("Responsible body not found", 404);
  }

  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  // Assets where this body is responsible, operational, or maintenance
  const bodyAssetFilter = {
    OR: [
      { responsibleBodyId: bodyId },
      { operationalBodyId: bodyId },
      { maintenanceBodyId: bodyId },
    ],
  };

  const [
    // 1. total_assets: grouped by status and family
    assetsByStatus,
    assetsByFamily,

    // 2. assets_by_lifecycle_stage
    assetsByStage,

    // 3. assets_at_risk
    assetsAtRisk,

    // 4. Work orders for this body
    workOrdersByStatus,
    overdueWorkOrders,

    // 5. Contracts expiring within 90 days
    myContractsExpiring,

    // 6. Recent events (last 10 on body's assets)
    recentEvents,

    // 7. Assets needing inspection (last condition record > 12 months ago)
    allBodyAssets,
    recentConditionAssets,

    // 8. Work orders by category
    workOrdersByCategory,

    // 9. Condition score distribution
    conditionScoreDistribution,
  ] = await Promise.all([
    // 1a. by status
    prisma.asset.groupBy({
      by: ["currentStatus"],
      where: bodyAssetFilter,
      _count: { id: true },
    }),
    // 1b. by family
    prisma.asset.groupBy({
      by: ["assetFamilyId"],
      where: bodyAssetFilter,
      _count: { id: true },
    }),

    // 2. by lifecycle stage
    prisma.asset.groupBy({
      by: ["currentLifecycleStageId"],
      where: bodyAssetFilter,
      _count: { id: true },
    }),

    // 3. assets at risk
    prisma.assetRiskScore.count({
      where: {
        riskBand: { in: ["High", "Critical"] },
        asset: bodyAssetFilter,
      },
    }),

    // 4a. work orders by status
    prisma.workOrder.groupBy({
      by: ["status"],
      where: { assignedToBodyId: bodyId },
      _count: { id: true },
    }),
    // 4b. overdue work orders count
    prisma.workOrder.count({
      where: {
        assignedToBodyId: bodyId,
        status: { notIn: ["closed", "cancelled"] },
        targetCompletionDate: { lt: now },
      },
    }),

    // 5. my contracts expiring within 90 days
    prisma.contract.findMany({
      where: {
        responsibleBodyId: bodyId,
        status: "active",
        endDate: { lte: in90Days, gte: now },
      },
      select: {
        id: true,
        contractReference: true,
        counterpartyName: true,
        endDate: true,
        asset: { select: { id: true, assetName: true, assetCode: true } },
      },
      orderBy: { endDate: "asc" },
      take: 20,
    }),

    // 6. recent events (last 10) on this body's assets
    prisma.event.findMany({
      where: {
        asset: bodyAssetFilter,
      },
      include: {
        eventType: { select: { name: true, category: true } },
        asset: { select: { id: true, assetName: true, assetCode: true } },
      },
      orderBy: { occurredAt: "desc" },
      take: 10,
    }),

    // 7a. all asset IDs in this body
    prisma.asset.findMany({
      where: bodyAssetFilter,
      select: { id: true },
    }),
    // 7b. assets with a recent condition record (within last 12 months)
    prisma.conditionRecord.groupBy({
      by: ["assetId"],
      where: {
        asset: bodyAssetFilter,
        inspectionDate: { gte: oneYearAgo },
      },
      _count: { id: true },
    }),

    // 8. work orders by category for this body
    prisma.workOrder.groupBy({
      by: ["categoryId"],
      where: {
        assignedToBodyId: bodyId,
        status: { notIn: ["closed", "cancelled"] },
      },
      _count: { id: true },
    }),

    // 9. condition score distribution
    prisma.conditionRecord.groupBy({
      by: ["conditionScore"],
      where: {
        asset: bodyAssetFilter,
        // Only count latest per asset — approximate with all records from last 12 months
        inspectionDate: { gte: oneYearAgo },
      },
      _count: { id: true },
    }),
  ]);

  // Resolve names for families and stages
  const familyIds = [...new Set(assetsByFamily.map((r) => r.assetFamilyId))];
  const stageIds = [...new Set(assetsByStage.map((r) => r.currentLifecycleStageId))];
  const categoryIds = [...new Set(workOrdersByCategory.map((r) => r.categoryId))];

  const [families, stages, categories] = await Promise.all([
    prisma.assetFamily.findMany({
      where: { id: { in: familyIds } },
      select: { id: true, name: true },
    }),
    prisma.lifecycleStage.findMany({
      where: { id: { in: stageIds } },
      select: { id: true, name: true, displayOrder: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.workOrderCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    }),
  ]);

  const familyMap = new Map(families.map((f) => [f.id, f.name]));
  const stageMap = new Map(stages.map((s) => [s.id, s.name]));
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  // Assets needing inspection: all body assets minus those with recent condition records
  const recentConditionAssetIds = new Set(recentConditionAssets.map((r) => r.assetId));
  const assetsNeedingInspection = allBodyAssets.filter(
    (a) => !recentConditionAssetIds.has(a.id)
  ).length;

  const totalAssets = allBodyAssets.length;

  const data = {
    body: { id: body.id, name: body.name },

    total_assets: {
      total: totalAssets,
      by_status: assetsByStatus.map((r) => ({
        status: r.currentStatus,
        count: r._count.id,
      })),
      by_family: assetsByFamily.map((r) => ({
        family_id: r.assetFamilyId,
        family_name: familyMap.get(r.assetFamilyId) ?? "Unknown",
        count: r._count.id,
      })),
    },

    assets_by_lifecycle_stage: assetsByStage.map((r) => ({
      stage_id: r.currentLifecycleStageId,
      stage_name: stageMap.get(r.currentLifecycleStageId) ?? "Unknown",
      count: r._count.id,
    })),

    assets_at_risk: assetsAtRisk,

    work_orders_summary: {
      by_status: workOrdersByStatus.map((r) => ({
        status: r.status,
        count: r._count.id,
      })),
      overdue_count: overdueWorkOrders,
    },

    work_orders_by_category: workOrdersByCategory.map((r) => ({
      category_id: r.categoryId,
      category_name: categoryMap.get(r.categoryId) ?? "Unknown",
      count: r._count.id,
    })),

    my_contracts_expiring: myContractsExpiring.map((c) => ({
      id: c.id,
      contract_reference: c.contractReference,
      counterparty_name: c.counterpartyName,
      end_date: c.endDate,
      asset: c.asset,
    })),

    assets_needing_inspection: assetsNeedingInspection,

    condition_overview: {
      score_distribution: conditionScoreDistribution.map((r) => ({
        score: r.conditionScore,
        count: r._count.id,
      })),
    },

    recent_events: recentEvents.map((e) => ({
      id: e.id,
      event_type: e.eventType.name,
      category: e.eventType.category,
      asset_id: e.assetId,
      asset_name: e.asset.assetName,
      asset_code: e.asset.assetCode,
      occurred_at: e.occurredAt,
      description: e.description,
      is_system_generated: e.isSystemGenerated,
    })),
  };

  return ok(data);
}
