import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

// PUT /api/assets/:id/change-operator
// Terminates the existing active operator allocation and assigns a new one
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    return NextResponse.json(err("start_date is required for the new operator"), { status: 422 });
  }

  // Terminate existing active operator allocation(s)
  const existingOperators = await prisma.allocation.findMany({
    where: { assetId: id, allocationType: "operator", status: "active" },
  });

  if (existingOperators.length > 0) {
    await prisma.allocation.updateMany({
      where: { assetId: id, allocationType: "operator", status: "active" },
      data: {
        status: "terminated",
        notes: `Terminated due to operator change on ${new Date().toISOString().split("T")[0]}`,
      },
    });
  }

  // Terminate related active operator_agreement contracts
  await prisma.contract.updateMany({
    where: {
      assetId: id,
      status: "active",
      contractType: { name: "operator_agreement" },
    },
    data: { status: "terminated" },
  });

  // Call assign-operator logic (inline to avoid HTTP call)
  const allocatedToBodyId = typeof body.allocated_to_body_id === "string" ? body.allocated_to_body_id : undefined;
  const allocatedToName = typeof body.allocated_to_name === "string" ? body.allocated_to_name : undefined;

  const [operatorChangedEventType] = await Promise.all([
    prisma.eventType.findFirst({ where: { name: "operator_changed" } }),
  ]);

  const newAllocation = await prisma.allocation.create({
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

  if (operatorChangedEventType) {
    await prisma.event.create({
      data: {
        eventTypeId: operatorChangedEventType.id,
        assetId: id,
        isSystemGenerated: false,
        description: `Operator changed to: ${allocatedToName ?? allocatedToBodyId ?? "unknown"}`,
        metadata: {
          previous_operator_ids: existingOperators.map((o) => o.id),
          allocated_to_body_id: allocatedToBodyId ?? null,
          allocated_to_name: allocatedToName ?? null,
        },
      },
    });
  }

  if (allocatedToBodyId) {
    await prisma.asset.update({
      where: { id },
      data: { operationalBodyId: allocatedToBodyId },
    });
  }

  return NextResponse.json(ok({ allocation: newAllocation, terminated_count: existingOperators.length }));
}
