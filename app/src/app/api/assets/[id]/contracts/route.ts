import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

// GET /api/assets/:id/contracts — all contracts for an asset
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) return err("Asset not found", 404);

  const contracts = await prisma.contract.findMany({
    where: { assetId: id },
    include: {
      contractType: true,
      responsibleBody: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return ok(contracts);
}
