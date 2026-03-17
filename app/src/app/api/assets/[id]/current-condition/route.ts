import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAnyRole } from "@/lib/rbac";

// GET /api/assets/:id/current-condition — most recent condition record for an asset
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAnyRole(req, [
    "department_user",
    "operations_manager",
    "planner",
    "asset_manager",
    "admin",
  ]);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) return err("Asset not found", 404);

  const currentCondition = await prisma.conditionRecord.findFirst({
    where: { assetId: id },
    include: {
      inspectedByBody: { select: { id: true, name: true } },
    },
    orderBy: [{ inspectionDate: "desc" }, { createdAt: "desc" }],
  });

  if (!currentCondition) return err("No condition records found for this asset", 404);

  return ok(currentCondition);
}
