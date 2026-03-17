import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

// PUT /api/allocations/:id/terminate
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req, "asset_manager");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const allocation = await prisma.allocation.findUnique({
    where: { id },
    include: { asset: { select: { id: true } } },
  });
  if (!allocation) return NextResponse.json(err("Not found"), { status: 404 });

  if (allocation.status === "terminated") {
    return NextResponse.json(err("Allocation is already terminated"), { status: 422 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err("Invalid JSON body"), { status: 400 });
  }

  const { reason } = body;
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json(err("reason is required for termination"), { status: 422 });
  }

  const eventType = await prisma.eventType.findFirst({
    where: { name: { in: ["status_changed", "asset_reassigned"] } },
  });

  const [updated] = await prisma.$transaction([
    prisma.allocation.update({
      where: { id },
      data: {
        status: "terminated",
        notes: allocation.notes ? `${allocation.notes}\n\nTermination reason: ${reason}` : `Termination reason: ${reason}`,
      },
      include: {
        asset: { select: { id: true, assetName: true, assetCode: true } },
        allocatedToBody: true,
      },
    }),
    ...(eventType
      ? [
          prisma.event.create({
            data: {
              eventTypeId: eventType.id,
              assetId: allocation.assetId,
              isSystemGenerated: false,
              description: `Allocation terminated: ${reason}`,
              metadata: { allocation_id: id, reason },
            },
          }),
        ]
      : []),
  ]);

  return NextResponse.json(ok(updated));
}
