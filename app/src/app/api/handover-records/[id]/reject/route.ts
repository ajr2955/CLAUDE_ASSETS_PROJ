import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";
import { HandoverStatus } from "@/generated/prisma/client";

// PUT /api/handover-records/:id/reject — reject a handover record
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(req, "asset_manager");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const record = await prisma.handoverRecord.findUnique({
    where: { id },
    include: {
      asset: { select: { id: true, assetName: true, assetCode: true } },
      deliveredByBody: { select: { id: true, name: true } },
      receivedByBody: { select: { id: true, name: true } },
    },
  });
  if (!record) return err("Handover record not found", 404);

  if (record.handoverStatus !== HandoverStatus.pending) {
    return err(
      `Cannot reject a handover record with status '${record.handoverStatus}'. Only 'pending' records can be rejected.`,
      422
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  const { rejection_reason } = body;
  if (!rejection_reason) return err("rejection_reason is required", 422);

  // Find a suitable event type for rejection (asset_reassigned or status_changed as fallback)
  const rejectedEventType = await prisma.eventType.findFirst({
    where: {
      name: {
        in: ["status_changed", "asset_reassigned"],
      },
    },
    orderBy: { name: "asc" },
  });

  const [updatedRecord] = await prisma.$transaction([
    prisma.handoverRecord.update({
      where: { id },
      data: {
        handoverStatus: HandoverStatus.rejected,
        notes: record.notes
          ? `${record.notes}\n\nRejection reason: ${rejection_reason}`
          : `Rejection reason: ${rejection_reason}`,
      },
      include: {
        asset: { select: { id: true, assetName: true, assetCode: true } },
        deliveredByBody: { select: { id: true, name: true } },
        receivedByBody: { select: { id: true, name: true } },
      },
    }),
    ...(rejectedEventType
      ? [
          prisma.event.create({
            data: {
              eventTypeId: rejectedEventType.id,
              assetId: record.assetId,
              description: `Handover rejected by ${record.receivedByBody.name}. Reason: ${rejection_reason}`,
              isSystemGenerated: true,
              metadata: {
                handover_record_id: id,
                status: HandoverStatus.rejected,
                rejection_reason,
                delivered_by_body_id: record.deliveredByBodyId,
                received_by_body_id: record.receivedByBodyId,
              },
            },
          }),
        ]
      : []),
  ]);

  return ok(updatedRecord);
}
