import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";
import { WorkOrderStatus, WorkOrderPriority } from "@/generated/prisma/client";

const CLOSED_STATUSES: WorkOrderStatus[] = [WorkOrderStatus.closed, WorkOrderStatus.cancelled];
const OPEN_STATUSES: WorkOrderStatus[] = [
  WorkOrderStatus.open,
  WorkOrderStatus.assigned,
  WorkOrderStatus.in_progress,
  WorkOrderStatus.pending_approval,
];

// GET /api/reports/maintenance-backlog (operations_manager+)
// Returns aggregated data: total open work orders grouped by priority, status,
// category, assigned_to_body_id, and asset_family_id.
// Includes estimated_cost and actual_cost totals per group, plus overdue counts.
export async function GET(req: NextRequest) {
  const auth = requireAuth(req, "operations_manager");
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const familyId = sp.get("family_id");
  const bodyId = sp.get("body_id");

  const now = new Date();

  // Base where: open work orders (not closed/cancelled), optionally scoped by body/family
  const baseWhere: Record<string, unknown> = {
    status: { notIn: CLOSED_STATUSES },
  };
  if (bodyId) baseWhere.assignedToBodyId = bodyId;
  if (familyId) {
    baseWhere.asset = { assetFamilyId: familyId };
  }

  // Overdue where: additionally requires targetCompletionDate < now
  const overdueWhere: Record<string, unknown> = {
    ...baseWhere,
    targetCompletionDate: { lt: now },
  };

  // Fetch all open work orders with includes for grouping
  const [workOrders, overdueWorkOrders] = await Promise.all([
    prisma.workOrder.findMany({
      where: baseWhere as never,
      select: {
        id: true,
        priority: true,
        status: true,
        estimatedCost: true,
        actualCost: true,
        targetCompletionDate: true,
        categoryId: true,
        category: { select: { id: true, name: true } },
        assignedToBodyId: true,
        assignedToBody: { select: { id: true, name: true } },
        asset: {
          select: {
            id: true,
            assetFamilyId: true,
            assetFamily: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.workOrder.count({ where: overdueWhere as never }),
  ]);

  const total = workOrders.length;

  // Group by priority
  const byPriority = groupAndAggregate(workOrders, (wo) => wo.priority, now);

  // Group by status
  const byStatus = groupAndAggregate(workOrders, (wo) => wo.status, now);

  // Group by category
  const byCategory = groupAndAggregate(
    workOrders,
    (wo) => `${wo.categoryId}::${wo.category.name}`,
    now,
    (key) => {
      const [id, name] = key.split("::");
      return { id, name };
    }
  );

  // Group by assigned body
  const byBody = groupAndAggregate(
    workOrders,
    (wo) => (wo.assignedToBodyId ? `${wo.assignedToBodyId}::${wo.assignedToBody?.name ?? ""}` : "unassigned::Unassigned"),
    now,
    (key) => {
      if (key.startsWith("unassigned::")) return { id: null, name: "Unassigned" };
      const [id, name] = key.split("::");
      return { id, name };
    }
  );

  // Group by asset family
  const byFamily = groupAndAggregate(
    workOrders,
    (wo) => `${wo.asset.assetFamilyId}::${wo.asset.assetFamily.name}`,
    now,
    (key) => {
      const [id, name] = key.split("::");
      return { id, name };
    }
  );

  return ok({
    total_open: total,
    overdue_count: overdueWorkOrders,
    by_priority: byPriority,
    by_status: byStatus,
    by_category: byCategory,
    by_assigned_body: byBody,
    by_asset_family: byFamily,
  });
}

type WORecord = {
  id: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  estimatedCost: unknown;
  actualCost: unknown;
  targetCompletionDate: Date | null;
  categoryId: string;
  category: { id: string; name: string };
  assignedToBodyId: string | null;
  assignedToBody: { id: string; name: string } | null;
  asset: {
    id: string;
    assetFamilyId: string;
    assetFamily: { id: string; name: string };
  };
};

function groupAndAggregate(
  workOrders: WORecord[],
  keyFn: (wo: WORecord) => string,
  now: Date,
  labelFn?: (key: string) => Record<string, unknown>
): Record<string, unknown>[] {
  const map = new Map<
    string,
    {
      count: number;
      overdue_count: number;
      estimated_cost_total: number;
      actual_cost_total: number;
    }
  >();

  for (const wo of workOrders) {
    const key = keyFn(wo);
    const existing = map.get(key) ?? {
      count: 0,
      overdue_count: 0,
      estimated_cost_total: 0,
      actual_cost_total: 0,
    };
    existing.count += 1;
    if (wo.targetCompletionDate && wo.targetCompletionDate < now) {
      existing.overdue_count += 1;
    }
    existing.estimated_cost_total += Number(wo.estimatedCost ?? 0);
    existing.actual_cost_total += Number(wo.actualCost ?? 0);
    map.set(key, existing);
  }

  return Array.from(map.entries()).map(([key, stats]) => ({
    key,
    ...(labelFn ? labelFn(key) : { value: key }),
    count: stats.count,
    overdue_count: stats.overdue_count,
    estimated_cost_total: Math.round(stats.estimated_cost_total * 100) / 100,
    actual_cost_total: Math.round(stats.actual_cost_total * 100) / 100,
  }));
}
