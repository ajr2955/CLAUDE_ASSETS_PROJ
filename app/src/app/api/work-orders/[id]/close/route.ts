import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";
import { WorkOrderStatus } from "@/generated/prisma/client";
import { triggerRiskScoreRecompute } from "@/lib/risk-scoring";

// PUT /api/work-orders/:id/close — close a work order
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(req, "operations_manager");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = await prisma.workOrder.findUnique({ where: { id } });
  if (!existing) return err("WorkOrder not found", 404);

  if (existing.status === WorkOrderStatus.closed) {
    return err("Work order is already closed", 422);
  }
  if (existing.status === WorkOrderStatus.cancelled) {
    return err("Cannot close a cancelled work order", 422);
  }

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  if (!body.actual_completion_date) {
    return err("actual_completion_date is required to close a work order", 422);
  }

  // Find work_order_closed event type
  const eventType = await prisma.eventType.findUnique({
    where: { name: "work_order_closed" },
  });

  const [updated] = await prisma.$transaction([
    prisma.workOrder.update({
      where: { id },
      data: {
        status: WorkOrderStatus.closed,
        actualCompletionDate: new Date(body.actual_completion_date),
        actualCost: body.actual_cost ?? existing.actualCost,
        notes: body.notes ?? existing.notes,
      },
      include: {
        asset: { select: { id: true, assetName: true, assetCode: true } },
        category: true,
        assignedToBody: { select: { id: true, name: true } },
        lifecycleStage: { select: { id: true, name: true } },
      },
    }),
    ...(eventType
      ? [
          prisma.event.create({
            data: {
              eventTypeId: eventType.id,
              assetId: existing.assetId,
              description: `Work order ${existing.workOrderNumber} closed`,
              isSystemGenerated: true,
              metadata: {
                work_order_id: id,
                work_order_number: existing.workOrderNumber,
                actual_completion_date: body.actual_completion_date,
                actual_cost: body.actual_cost ?? null,
              },
            },
          }),
        ]
      : []),
  ]);

  // Trigger async risk score recompute (fire-and-forget)
  triggerRiskScoreRecompute(existing.assetId);

  return ok(updated);
}
