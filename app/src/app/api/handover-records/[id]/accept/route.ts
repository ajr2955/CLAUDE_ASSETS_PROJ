import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";
import { HandoverStatus } from "@/generated/prisma/client";

// PUT /api/handover-records/:id/accept — accept or accept_with_conditions
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
      `Cannot accept a handover record with status '${record.handoverStatus}'. Only 'pending' records can be accepted.`,
      422
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  const { accepted_with_conditions, conditions_description } = body;

  // If accepted_with_conditions is true, conditions_description is required
  if (accepted_with_conditions && !conditions_description) {
    return err("conditions_description is required when accepted_with_conditions is true", 422);
  }

  const newStatus = accepted_with_conditions
    ? HandoverStatus.accepted_with_conditions
    : HandoverStatus.accepted;

  // Determine missing_documents for governance event trigger
  const missingDocs = record.missingDocuments as string[] | null;
  const hasMissingDocs =
    Array.isArray(missingDocs) && missingDocs.length > 0;

  // Find event types
  const [receivedEventType, missingDocEventType] = await Promise.all([
    prisma.eventType.findUnique({ where: { name: "asset_received" } }),
    hasMissingDocs
      ? prisma.eventType.findUnique({ where: { name: "missing_document_detected" } })
      : Promise.resolve(null),
  ]);

  const missingDocEvents =
    hasMissingDocs && missingDocEventType
      ? [
          prisma.event.create({
            data: {
              eventTypeId: missingDocEventType.id,
              assetId: record.assetId,
              description: `Missing documents detected at handover acceptance: ${(missingDocs as string[]).join(", ")}`,
              isSystemGenerated: true,
              metadata: {
                handover_record_id: id,
                missing_documents: missingDocs,
              },
            },
          }),
        ]
      : [];

  const [updatedRecord] = await prisma.$transaction([
    prisma.handoverRecord.update({
      where: { id },
      data: {
        handoverStatus: newStatus,
        acceptedWithConditionsFlag: accepted_with_conditions ?? false,
        conditionsDescription: conditions_description ?? null,
      },
      include: {
        asset: { select: { id: true, assetName: true, assetCode: true } },
        deliveredByBody: { select: { id: true, name: true } },
        receivedByBody: { select: { id: true, name: true } },
      },
    }),
    // Update asset.handover_date
    prisma.asset.update({
      where: { id: record.assetId },
      data: { handoverDate: record.handoverDate },
    }),
    ...(receivedEventType
      ? [
          prisma.event.create({
            data: {
              eventTypeId: receivedEventType.id,
              assetId: record.assetId,
              description: `Asset received by ${record.receivedByBody.name} from ${record.deliveredByBody.name}`,
              isSystemGenerated: true,
              metadata: {
                handover_record_id: id,
                status: newStatus,
                accepted_with_conditions: accepted_with_conditions ?? false,
                conditions_description: conditions_description ?? null,
              },
            },
          }),
        ]
      : []),
    ...missingDocEvents,
  ]);

  return ok(updatedRecord);
}
