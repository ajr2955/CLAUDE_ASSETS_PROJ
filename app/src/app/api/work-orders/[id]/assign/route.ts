import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";
import { WorkOrderStatus } from "@/generated/prisma/client";

// PUT /api/work-orders/:id/assign — assign work order to a body or user
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(req, "operations_manager");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = await prisma.workOrder.findUnique({ where: { id } });
  if (!existing) return err("WorkOrder not found", 404);

  if (
    existing.status === WorkOrderStatus.closed ||
    existing.status === WorkOrderStatus.cancelled
  ) {
    return err(`Cannot assign a work order with status '${existing.status}'`, 422);
  }

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  const { assigned_to_body_id, assigned_to_user_id } = body;
  if (!assigned_to_body_id && !assigned_to_user_id) {
    return err("At least one of assigned_to_body_id or assigned_to_user_id is required", 422);
  }

  // Validate body exists if provided
  if (assigned_to_body_id) {
    const body_ = await prisma.responsibleBody.findUnique({ where: { id: assigned_to_body_id } });
    if (!body_) return err("ResponsibleBody not found", 404);
  }

  // Find work_order_assigned event type for notification event
  const eventType = await prisma.eventType.findFirst({
    where: { name: { in: ["work_order_assigned", "work_order_created"] } },
  });

  const assignedEventType = await prisma.eventType.findUnique({
    where: { name: "work_order_assigned" },
  });

  const data: Record<string, unknown> = {
    status: WorkOrderStatus.assigned,
  };
  if (assigned_to_body_id !== undefined) data.assignedToBodyId = assigned_to_body_id;
  if (assigned_to_user_id !== undefined) data.assignedToUserId = assigned_to_user_id;

  const [updated] = await prisma.$transaction([
    prisma.workOrder.update({
      where: { id },
      data,
      include: {
        asset: { select: { id: true, assetName: true, assetCode: true } },
        category: true,
        assignedToBody: { select: { id: true, name: true } },
        lifecycleStage: { select: { id: true, name: true } },
      },
    }),
    ...(assignedEventType ?? eventType
      ? [
          prisma.event.create({
            data: {
              eventTypeId: (assignedEventType ?? eventType)!.id,
              assetId: existing.assetId,
              description: `Work order ${existing.workOrderNumber} assigned`,
              isSystemGenerated: true,
              metadata: {
                work_order_id: id,
                work_order_number: existing.workOrderNumber,
                assigned_to_body_id: assigned_to_body_id ?? null,
                assigned_to_user_id: assigned_to_user_id ?? null,
              },
            },
          }),
        ]
      : []),
  ]);

  return ok(updated);
}
