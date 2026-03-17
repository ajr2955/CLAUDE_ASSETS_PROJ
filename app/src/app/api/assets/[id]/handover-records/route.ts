import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAnyRole } from "@/lib/rbac";

// GET /api/assets/:id/handover-records — all handover records for an asset
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

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const perPage = Math.min(100, Math.max(1, parseInt(sp.get("per_page") ?? "25", 10)));
  const skip = (page - 1) * perPage;

  const [records, total] = await Promise.all([
    prisma.handoverRecord.findMany({
      where: { assetId: id },
      include: {
        deliveredByBody: { select: { id: true, name: true } },
        receivedByBody: { select: { id: true, name: true } },
      },
      orderBy: [{ handoverDate: "desc" }, { createdAt: "desc" }],
      skip,
      take: perPage,
    }),
    prisma.handoverRecord.count({ where: { assetId: id } }),
  ]);

  return ok(records, { page, per_page: perPage, total });
}
