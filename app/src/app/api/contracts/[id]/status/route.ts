import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";
import { ContractStatus } from "@/generated/prisma/client";

// PUT /api/contracts/:id/status — transition contract status
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(req, "asset_manager");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = await prisma.contract.findUnique({ where: { id } });
  if (!existing) return err("Contract not found", 404);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  const { status, termination_reason } = body;
  if (!status) return err("status is required", 422);

  const validStatuses = Object.values(ContractStatus);
  if (!validStatuses.includes(status as ContractStatus)) {
    return err(`Invalid status. Must be one of: ${validStatuses.join(", ")}`, 422);
  }

  if (status === "terminated" && !termination_reason) {
    return err("termination_reason is required when transitioning to 'terminated'", 422);
  }

  const updated = await prisma.contract.update({
    where: { id },
    data: {
      status: status as ContractStatus,
      notes: status === "terminated"
        ? `${existing.notes ? existing.notes + "\n" : ""}Termination reason: ${termination_reason}`
        : existing.notes,
    },
    include: {
      contractType: true,
      asset: { select: { id: true, assetName: true, assetCode: true } },
    },
  });

  return ok(updated);
}
