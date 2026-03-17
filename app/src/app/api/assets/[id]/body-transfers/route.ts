import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

// GET /api/assets/:id/body-transfers
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const asset = await prisma.asset.findUnique({ where: { id }, select: { id: true } });
  if (!asset) return NextResponse.json(err("Asset not found"), { status: 404 });

  const transfers = await prisma.bodyTransfer.findMany({
    where: { assetId: id },
    include: {
      fromBody: { select: { id: true, name: true, isPlaceholder: true } },
      toBody: { select: { id: true, name: true, isPlaceholder: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(ok(transfers));
}
