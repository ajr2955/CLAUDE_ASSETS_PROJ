import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

// POST /api/contracts/:id/renew — renew a contract
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(req, "asset_manager");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = await prisma.contract.findUnique({ where: { id } });
  if (!existing) return err("Contract not found", 404);

  if (existing.status === "renewed" || existing.status === "terminated") {
    return err(`Cannot renew a contract with status '${existing.status}'`, 422);
  }

  const body = await req.json().catch(() => ({}));
  const startDate = body.start_date ? new Date(body.start_date) : existing.endDate ?? new Date();
  const endDate = body.end_date ? new Date(body.end_date) : null;

  // Generate new contract reference
  const year = new Date().getFullYear();
  const count = await prisma.contract.count();
  const newRef = `CTR-${year}-${String(count + 1).padStart(5, "0")}`;

  // Find contract_renewed event type
  const eventType = await prisma.eventType.findUnique({ where: { name: "contract_renewed" } });

  const [updatedOld, newContract] = await prisma.$transaction([
    // Mark old contract as renewed
    prisma.contract.update({
      where: { id },
      data: { status: "renewed" },
    }),
    // Create new contract
    prisma.contract.create({
      data: {
        assetId: existing.assetId,
        contractTypeId: existing.contractTypeId,
        contractReference: newRef,
        counterpartyName: existing.counterpartyName,
        counterpartyType: existing.counterpartyType,
        responsibleBodyId: existing.responsibleBodyId,
        startDate,
        endDate,
        noticePeriodDays: existing.noticePeriodDays,
        renewalOption: existing.renewalOption,
        autoRenewal: existing.autoRenewal,
        contractValue: existing.contractValue,
        periodicAmount: existing.periodicAmount,
        paymentFrequency: existing.paymentFrequency,
        slaDescription: existing.slaDescription,
        status: "active",
        notes: body.notes ?? existing.notes,
      },
    }),
    ...(eventType
      ? [
          prisma.event.create({
            data: {
              eventTypeId: eventType.id,
              assetId: existing.assetId,
              description: `Contract ${existing.contractReference ?? id} renewed; new reference: ${newRef}`,
              isSystemGenerated: true,
              metadata: {
                previous_contract_id: id,
                previous_contract_reference: existing.contractReference,
                new_contract_reference: newRef,
              },
            },
          }),
        ]
      : []),
  ]);

  return ok({ renewed_contract: updatedOld, new_contract: newContract }, undefined, 201);
}
