import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAnyRole } from "@/lib/rbac";

// GET /api/assets/:id/work-orders — all work orders for an asset
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAnyRole(req, [
    "contractor",
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

  const caller = auth;
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const perPage = Math.min(100, Math.max(1, parseInt(sp.get("per_page") ?? "25", 10)));
  const skip = (page - 1) * perPage;

  const where: Record<string, unknown> = { assetId: id };

  // Contractors may only see work orders assigned to them
  if (caller.role === "contractor" && caller.sub) {
    where.assignedToUserId = caller.sub;
  }

  const [workOrders, total] = await Promise.all([
    prisma.workOrder.findMany({
      where,
      include: {
        category: true,
        assignedToBody: { select: { id: true, name: true } },
        lifecycleStage: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      skip,
      take: perPage,
    }),
    prisma.workOrder.count({ where }),
  ]);

  return ok(workOrders, { page, per_page: perPage, total });
}
