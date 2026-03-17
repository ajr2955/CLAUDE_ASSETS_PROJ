import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAnyRole } from "@/lib/rbac";

// GET /api/assets/:id/condition-records — condition history for an asset (most recent first)
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
    prisma.conditionRecord.findMany({
      where: { assetId: id },
      include: {
        inspectedByBody: { select: { id: true, name: true } },
      },
      // Most recent inspection first — first record in results is the current condition
      orderBy: [{ inspectionDate: "desc" }, { createdAt: "desc" }],
      skip,
      take: perPage,
    }),
    prisma.conditionRecord.count({ where: { assetId: id } }),
  ]);

  return ok(records, { page, per_page: perPage, total });
}
