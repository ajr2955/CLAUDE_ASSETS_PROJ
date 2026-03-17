import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

// GET /api/assets/:id/current-operator
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const asset = await prisma.asset.findUnique({ where: { id }, select: { id: true } });
  if (!asset) return NextResponse.json(err("Asset not found"), { status: 404 });

  // Active operator allocation
  const operatorAllocation = await prisma.allocation.findFirst({
    where: {
      assetId: id,
      allocationType: "operator",
      status: "active",
    },
    include: {
      allocatedToBody: true,
    },
    orderBy: { startDate: "desc" },
  });

  if (!operatorAllocation) {
    return NextResponse.json(ok({ operator: null, contract: null }));
  }

  // Find linked operator_agreement contract (by same asset + counterparty match or just most recent active)
  const operatorContract = await prisma.contract.findFirst({
    where: {
      assetId: id,
      status: "active",
      contractType: { name: "operator_agreement" },
    },
    include: { contractType: true, responsibleBody: true },
    orderBy: { startDate: "desc" },
  });

  return NextResponse.json(ok({ operator: operatorAllocation, contract: operatorContract }));
}
