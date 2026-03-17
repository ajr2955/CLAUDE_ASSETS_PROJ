import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";
import { WorkOrderStatus } from "@/generated/prisma/client";

const CLOSED_STATUSES: WorkOrderStatus[] = [WorkOrderStatus.closed, WorkOrderStatus.cancelled];

// Priority sort order: critical=0, high=1, medium=2, low=3
const PRIORITY_WEIGHT: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// GET /api/reports/overdue-work-orders (operations_manager+)
// Returns all overdue open work orders sorted by priority (critical first),
// then by overdue days descending (most overdue first).
// Supports filters: body_id (assigned_to_body_id), family_id (asset family)
export async function GET(req: NextRequest) {
  const auth = requireAuth(req, "operations_manager");
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const bodyId = sp.get("body_id");
  const familyId = sp.get("family_id");
  const page = Math.max(1, Number(sp.get("page") ?? "1"));
  const perPage = Math.min(100, Math.max(1, Number(sp.get("per_page") ?? "25")));

  const now = new Date();

  const where: Record<string, unknown> = {
    targetCompletionDate: { lt: now },
    status: { notIn: CLOSED_STATUSES },
  };

  if (bodyId) where.assignedToBodyId = bodyId;
  if (familyId) {
    where.asset = { assetFamilyId: familyId };
  }

  const [workOrders, total] = await Promise.all([
    prisma.workOrder.findMany({
      where: where as never,
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
        asset: {
          select: {
            id: true,
            assetCode: true,
            assetName: true,
            assetFamily: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.workOrder.count({ where: where as never }),
  ]);

  // Sort by priority ascending, then overdue days descending
  const nowMs = now.getTime();
  const sorted = workOrders.sort((a, b) => {
    const pA = PRIORITY_WEIGHT[a.priority] ?? 99;
    const pB = PRIORITY_WEIGHT[b.priority] ?? 99;
    if (pA !== pB) return pA - pB;
    // Same priority: sort by overdue days descending (most overdue first)
    const overdueA = a.targetCompletionDate ? nowMs - a.targetCompletionDate.getTime() : 0;
    const overdueB = b.targetCompletionDate ? nowMs - b.targetCompletionDate.getTime() : 0;
    return overdueB - overdueA;
  });

  // Paginate in-memory (after sort)
  const start = (page - 1) * perPage;
  const paginated = sorted.slice(start, start + perPage);

  return ok(
    paginated.map((wo) => ({
      id: wo.id,
      work_order_number: wo.workOrderNumber,
      title: wo.title,
      priority: wo.priority,
      status: wo.status,
      category: wo.category,
      assigned_to_body: wo.assignedToBody,
      asset: {
        id: wo.asset.id,
        asset_code: wo.asset.assetCode,
        asset_name: wo.asset.assetName,
        family: wo.asset.assetFamily,
      },
      estimated_cost: wo.estimatedCost ? Number(wo.estimatedCost) : null,
      actual_cost: wo.actualCost ? Number(wo.actualCost) : null,
      target_completion_date: wo.targetCompletionDate,
      overdue_days: wo.targetCompletionDate
        ? Math.floor((nowMs - wo.targetCompletionDate.getTime()) / (1000 * 60 * 60 * 24))
        : null,
      created_at: wo.createdAt,
    })),
    { page, per_page: perPage, total }
  );
}
