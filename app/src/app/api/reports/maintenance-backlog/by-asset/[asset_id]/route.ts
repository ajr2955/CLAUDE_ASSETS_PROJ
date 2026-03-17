import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";
import { WorkOrderStatus } from "@/generated/prisma/client";

const CLOSED_STATUSES: WorkOrderStatus[] = [WorkOrderStatus.closed, WorkOrderStatus.cancelled];

// GET /api/reports/maintenance-backlog/by-asset/:asset_id (operations_manager+)
// Returns backlog for a specific asset: open work orders grouped by priority,
// status, and category, with overdue counts and cost totals.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ asset_id: string }> }
) {
  const auth = requireAuth(req, "operations_manager");
  if (auth instanceof NextResponse) return auth;

  const { asset_id } = await params;

  // Validate asset exists
  const asset = await prisma.asset.findUnique({
    where: { id: asset_id },
    select: {
      id: true,
      assetCode: true,
      assetName: true,
      assetFamily: { select: { id: true, name: true } },
    },
  });
  if (!asset) return err("Asset not found", 404);

  const now = new Date();

  const where = {
    assetId: asset_id,
    status: { notIn: CLOSED_STATUSES },
  };

  const overdueWhere = {
    ...where,
    targetCompletionDate: { lt: now },
  };

  const [workOrders, overdueCount] = await Promise.all([
    prisma.workOrder.findMany({
      where,
      select: {
        id: true,
        workOrderNumber: true,
        title: true,
        priority: true,
        status: true,
        estimatedCost: true,
        actualCost: true,
        targetCompletionDate: true,
        createdAt: true,
        category: { select: { id: true, name: true } },
        assignedToBody: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    }),
    prisma.workOrder.count({ where: overdueWhere }),
  ]);

  const total = workOrders.length;

  // Aggregate by priority
  const byPriority = aggregateByKey(workOrders, (wo) => wo.priority, now);

  // Aggregate by status
  const byStatus = aggregateByKey(workOrders, (wo) => wo.status, now);

  // Aggregate by category
  const byCategory = aggregateByKey(workOrders, (wo) => wo.category.name, now);

  // Compute cost totals
  const estimatedCostTotal = workOrders.reduce((sum, wo) => sum + Number(wo.estimatedCost ?? 0), 0);
  const actualCostTotal = workOrders.reduce((sum, wo) => sum + Number(wo.actualCost ?? 0), 0);

  return ok({
    asset: {
      id: asset.id,
      asset_code: asset.assetCode,
      asset_name: asset.assetName,
      family: asset.assetFamily,
    },
    total_open: total,
    overdue_count: overdueCount,
    estimated_cost_total: Math.round(estimatedCostTotal * 100) / 100,
    actual_cost_total: Math.round(actualCostTotal * 100) / 100,
    by_priority: byPriority,
    by_status: byStatus,
    by_category: byCategory,
    work_orders: workOrders.map((wo) => ({
      id: wo.id,
      work_order_number: wo.workOrderNumber,
      title: wo.title,
      priority: wo.priority,
      status: wo.status,
      category: wo.category,
      assigned_to_body: wo.assignedToBody,
      estimated_cost: wo.estimatedCost ? Number(wo.estimatedCost) : null,
      actual_cost: wo.actualCost ? Number(wo.actualCost) : null,
      target_completion_date: wo.targetCompletionDate,
      is_overdue:
        wo.targetCompletionDate !== null && wo.targetCompletionDate < now,
      created_at: wo.createdAt,
    })),
  });
}

type WOItem = {
  priority: string;
  status: string;
  estimatedCost: unknown;
  actualCost: unknown;
  targetCompletionDate: Date | null;
  category: { name: string };
};

function aggregateByKey(
  workOrders: WOItem[],
  keyFn: (wo: WOItem) => string,
  now: Date
): { key: string; count: number; overdue_count: number; estimated_cost_total: number; actual_cost_total: number }[] {
  const map = new Map<string, { count: number; overdue_count: number; estimated: number; actual: number }>();

  for (const wo of workOrders) {
    const key = keyFn(wo);
    const existing = map.get(key) ?? { count: 0, overdue_count: 0, estimated: 0, actual: 0 };
    existing.count += 1;
    if (wo.targetCompletionDate && wo.targetCompletionDate < now) {
      existing.overdue_count += 1;
    }
    existing.estimated += Number(wo.estimatedCost ?? 0);
    existing.actual += Number(wo.actualCost ?? 0);
    map.set(key, existing);
  }

  return Array.from(map.entries()).map(([key, s]) => ({
    key,
    count: s.count,
    overdue_count: s.overdue_count,
    estimated_cost_total: Math.round(s.estimated * 100) / 100,
    actual_cost_total: Math.round(s.actual * 100) / 100,
  }));
}
