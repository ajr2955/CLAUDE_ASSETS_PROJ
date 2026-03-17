import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";
import { ContractStatus } from "@/generated/prisma/client";

// POST /api/assets/:id/assign-operator
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req, "asset_manager");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const asset = await prisma.asset.findUnique({ where: { id }, select: { id: true } });
  if (!asset) return NextResponse.json(err("Asset not found"), { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err("Invalid JSON body"), { status: 400 });
  }

  const { start_date } = body;
  if (!start_date || typeof start_date !== "string") {
    return NextResponse.json(err("start_date is required"), { status: 422 });
  }

  // Find operator_changed event type and operator_agreement contract type
  const [operatorChangedEventType, operatorAgreementContractType] = await Promise.all([
    prisma.eventType.findFirst({ where: { name: "operator_changed" } }),
    prisma.contractType.findFirst({ where: { name: "operator_agreement" } }),
  ]);

  // Build allocation create data
  const allocatedToBodyId = typeof body.allocated_to_body_id === "string" ? body.allocated_to_body_id : undefined;
  const allocatedToName = typeof body.allocated_to_name === "string" ? body.allocated_to_name : undefined;

  // Create allocation + optionally a contract + event
  const allocationCreate = prisma.allocation.create({
    data: {
      assetId: id,
      allocationType: "operator",
      startDate: new Date(start_date),
      endDate: typeof body.end_date === "string" ? new Date(body.end_date) : undefined,
      allocatedToBodyId,
      allocatedToName,
      isRevenueGenerating: false,
      status: "active",
      notes: typeof body.notes === "string" ? body.notes : undefined,
    },
    include: { allocatedToBody: true },
  });

  const eventCreate = operatorChangedEventType
    ? prisma.event.create({
        data: {
          eventTypeId: operatorChangedEventType.id,
          assetId: id,
          isSystemGenerated: false,
          description: `Operator assigned: ${allocatedToName ?? allocatedToBodyId ?? "unknown"}`,
          metadata: {
            allocated_to_body_id: allocatedToBodyId ?? null,
            allocated_to_name: allocatedToName ?? null,
          },
        },
      })
    : null;

  const [allocation] = await prisma.$transaction([
    allocationCreate,
    ...(eventCreate ? [eventCreate] : []),
  ]);

  // Optionally update asset.operational_body_id if operator is a known body
  if (allocatedToBodyId) {
    await prisma.asset.update({
      where: { id },
      data: { operationalBodyId: allocatedToBodyId },
    });
  }

  // Optionally create an operator_agreement contract
  let contract = null;
  if (body.contract && typeof body.contract === "object" && operatorAgreementContractType) {
    const contractData = body.contract as Record<string, unknown>;
    const contractCounterparty = allocatedToName ?? "Operator";
    const contractRef = `OPR-${new Date().getFullYear()}-${String(await prisma.contract.count({ where: { contractReference: { startsWith: `OPR-${new Date().getFullYear()}-` } } }) + 1).padStart(5, "0")}`;

    contract = await prisma.contract.create({
      data: {
        assetId: id,
        contractTypeId: operatorAgreementContractType.id,
        contractReference: contractRef,
        counterpartyName: contractCounterparty,
        counterpartyType: "operator",
        startDate: typeof contractData.start_date === "string" ? new Date(contractData.start_date) : new Date(start_date),
        endDate: typeof contractData.end_date === "string" ? new Date(contractData.end_date) : undefined,
        status: ContractStatus.active,
        notes: typeof contractData.notes === "string" ? contractData.notes : undefined,
      },
      include: { contractType: true },
    });
  }

  return NextResponse.json(ok({ allocation, contract }), { status: 201 });
}
