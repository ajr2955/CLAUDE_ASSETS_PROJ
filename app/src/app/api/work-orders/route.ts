import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAnyRole, requireAuth } from "@/lib/rbac";
import { WorkOrderStatus, WorkOrderPriority } from "@/generated/prisma/client";

const workOrderInclude = {
  asset: { select: { id: true, assetName: true, assetCode: true } },
  category: true,
  assignedToBody: { select: { id: true, name: true } },
  lifecycleStage: { select: { id: true, name: true } },
};

// GET /api/work-orders — list work orders with optional filters
export async function GET(req: NextRequest) {
  // contractors and above can list work orders
  const auth = requireAnyRole(req, [
    "contractor",
    "department_user",
    "operations_manager",
    "planner",
    "asset_manager",
    "admin",
  ]);
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const assetId = sp.get("asset_id");
  const statusParam = sp.get("status") as WorkOrderStatus | null;
  const priorityParam = sp.get("priority") as WorkOrderPriority | null;
  const assignedToBodyId = sp.get("assigned_to_body_id");
  const assignedToUserId = sp.get("assigned_to_user_id");
  const categoryId = sp.get("category_id");
  const overdueParam = sp.get("overdue");

  // Validate enum values if provided
  if (statusParam && !Object.values(WorkOrderStatus).includes(statusParam)) {
    return err(
      `Invalid status. Must be one of: ${Object.values(WorkOrderStatus).join(", ")}`,
      422
    );
  }
  if (priorityParam && !Object.values(WorkOrderPriority).includes(priorityParam)) {
    return err(
      `Invalid priority. Must be one of: ${Object.values(WorkOrderPriority).join(", ")}`,
      422
    );
  }

  // Contractors may only see work orders assigned to them
  const caller = auth;
  const isContractor = caller.role === "contractor";

  const where: Record<string, unknown> = {};
  if (assetId) where.assetId = assetId;
  if (statusParam) where.status = statusParam;
  if (priorityParam) where.priority = priorityParam;
  if (assignedToBodyId) where.assignedToBodyId = assignedToBodyId;
  if (assignedToUserId) where.assignedToUserId = assignedToUserId;
  if (categoryId) where.categoryId = categoryId;

  // Overdue filter: target_completion_date < now AND status NOT IN (closed, cancelled)
  if (overdueParam === "true") {
    where.targetCompletionDate = { lt: new Date() };
    where.status = {
      notIn: [WorkOrderStatus.closed, WorkOrderStatus.cancelled],
    };
  }

  // Contractor restriction: can only see work orders assigned to their user id
  if (isContractor && caller.sub) {
    where.assignedToUserId = caller.sub;
  }

  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const perPage = Math.min(100, Math.max(1, parseInt(sp.get("per_page") ?? "25", 10)));
  const skip = (page - 1) * perPage;

  const [workOrders, total] = await Promise.all([
    prisma.workOrder.findMany({
      where,
      include: workOrderInclude,
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      skip,
      take: perPage,
    }),
    prisma.workOrder.count({ where }),
  ]);

  return ok(workOrders, { page, per_page: perPage, total });
}

// POST /api/work-orders — create a new work order
export async function POST(req: NextRequest) {
  const auth = requireAuth(req, "operations_manager");
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  const { asset_id, category_id, title } = body;
  if (!asset_id) return err("asset_id is required", 422);
  if (!category_id) return err("category_id is required", 422);
  if (!title) return err("title is required", 422);

  // Validate priority if provided
  if (body.priority && !Object.values(WorkOrderPriority).includes(body.priority as WorkOrderPriority)) {
    return err(
      `Invalid priority. Must be one of: ${Object.values(WorkOrderPriority).join(", ")}`,
      422
    );
  }

  const [asset, category] = await Promise.all([
    prisma.asset.findUnique({ where: { id: asset_id } }),
    prisma.workOrderCategory.findUnique({ where: { id: category_id } }),
  ]);
  if (!asset) return err("Asset not found", 404);
  if (!category) return err("WorkOrderCategory not found", 404);

  // Auto-generate work_order_number: WO-YEAR-SEQUENCE
  const year = new Date().getFullYear();
  const count = await prisma.workOrder.count();
  const workOrderNumber = `WO-${year}-${String(count + 1).padStart(5, "0")}`;

  // Find work_order_created event type
  const eventType = await prisma.eventType.findUnique({
    where: { name: "work_order_created" },
  });

  const [workOrder] = await prisma.$transaction([
    prisma.workOrder.create({
      data: {
        assetId: asset_id,
        workOrderNumber,
        categoryId: category_id,
        title,
        description: body.description ?? null,
        priority: body.priority ?? WorkOrderPriority.medium,
        status: WorkOrderStatus.open,
        assignedToBodyId: body.assigned_to_body_id ?? null,
        assignedToUserId: body.assigned_to_user_id ?? null,
        reportedByUserId: body.reported_by_user_id ?? null,
        lifecycleStageId: body.lifecycle_stage_id ?? null,
        targetCompletionDate: body.target_completion_date
          ? new Date(body.target_completion_date)
          : null,
        estimatedCost: body.estimated_cost ?? null,
        slaBreachAt: body.sla_breach_at ? new Date(body.sla_breach_at) : null,
        notes: body.notes ?? null,
      },
    }),
    ...(eventType
      ? [
          prisma.event.create({
            data: {
              eventTypeId: eventType.id,
              assetId: asset_id,
              description: `Work order ${workOrderNumber} created: ${title}`,
              isSystemGenerated: true,
              metadata: {
                work_order_number: workOrderNumber,
                category: category.name,
                priority: body.priority ?? WorkOrderPriority.medium,
              },
            },
          }),
        ]
      : []),
  ]);

  return ok(workOrder, undefined, 201);
}
