import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAnyRole, requireAuth } from "@/lib/rbac";
import { WorkOrderPriority, WorkOrderStatus } from "@/generated/prisma/client";

const workOrderInclude = {
  asset: { select: { id: true, assetName: true, assetCode: true } },
  category: true,
  assignedToBody: { select: { id: true, name: true } },
  lifecycleStage: { select: { id: true, name: true } },
};

// GET /api/work-orders/:id — full work order detail
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // contractors and above can view
  const auth = requireAnyRole(req, [
    "contractor",
    "department_user",
    "operations_manager",
    "planner",
    "asset_manager",
    "admin",
  ]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const workOrder = await prisma.workOrder.findUnique({
    where: { id },
    include: workOrderInclude,
  });
  if (!workOrder) return err("WorkOrder not found", 404);

  // Contractors may only view work orders assigned to them
  const caller = auth;
  if (caller.role === "contractor" && workOrder.assignedToUserId !== caller.sub) {
    return err("Forbidden: contractors can only view their own assigned work orders", 403);
  }

  return ok(workOrder);
}

// PUT /api/work-orders/:id — update mutable fields
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Contractors may update status, notes; others need operations_manager+
  const auth = requireAnyRole(req, [
    "contractor",
    "department_user",
    "operations_manager",
    "planner",
    "asset_manager",
    "admin",
  ]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = await prisma.workOrder.findUnique({ where: { id } });
  if (!existing) return err("WorkOrder not found", 404);

  const caller = auth;

  // Contractors may only update work orders assigned to them
  if (caller.role === "contractor" && existing.assignedToUserId !== caller.sub) {
    return err("Forbidden: contractors can only update their own assigned work orders", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  const isContractor = caller.role === "contractor";
  const data: Record<string, unknown> = {};

  // Contractors may only update: status, notes, description (photos via notes)
  if (isContractor) {
    if (body.status !== undefined) {
      if (!Object.values(WorkOrderStatus).includes(body.status as WorkOrderStatus)) {
        return err(
          `Invalid status. Must be one of: ${Object.values(WorkOrderStatus).join(", ")}`,
          422
        );
      }
      data.status = body.status;
    }
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.description !== undefined) data.description = body.description;
  } else {
    // Non-contractors can update all mutable fields
    if (body.category_id !== undefined) data.categoryId = body.category_id;
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.priority !== undefined) {
      if (!Object.values(WorkOrderPriority).includes(body.priority as WorkOrderPriority)) {
        return err(
          `Invalid priority. Must be one of: ${Object.values(WorkOrderPriority).join(", ")}`,
          422
        );
      }
      data.priority = body.priority;
    }
    if (body.status !== undefined) {
      if (!Object.values(WorkOrderStatus).includes(body.status as WorkOrderStatus)) {
        return err(
          `Invalid status. Must be one of: ${Object.values(WorkOrderStatus).join(", ")}`,
          422
        );
      }
      data.status = body.status;
    }
    if (body.assigned_to_body_id !== undefined) data.assignedToBodyId = body.assigned_to_body_id;
    if (body.assigned_to_user_id !== undefined) data.assignedToUserId = body.assigned_to_user_id;
    if (body.lifecycle_stage_id !== undefined) data.lifecycleStageId = body.lifecycle_stage_id;
    if (body.target_completion_date !== undefined) {
      data.targetCompletionDate = body.target_completion_date
        ? new Date(body.target_completion_date)
        : null;
    }
    if (body.actual_completion_date !== undefined) {
      data.actualCompletionDate = body.actual_completion_date
        ? new Date(body.actual_completion_date)
        : null;
    }
    if (body.estimated_cost !== undefined) data.estimatedCost = body.estimated_cost;
    if (body.actual_cost !== undefined) data.actualCost = body.actual_cost;
    if (body.sla_breach_at !== undefined) {
      data.slaBreachAt = body.sla_breach_at ? new Date(body.sla_breach_at) : null;
    }
    if (body.notes !== undefined) data.notes = body.notes;
  }

  const updated = await prisma.workOrder.update({
    where: { id },
    data,
    include: workOrderInclude,
  });
  return ok(updated);
}
