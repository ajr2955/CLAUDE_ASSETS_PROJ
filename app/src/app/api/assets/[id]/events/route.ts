import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

// GET /api/assets/:id/events — full event log for an asset, newest first
export async function GET(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const { searchParams } = req.nextUrl;

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") ?? "50", 10)));

  const asset = await prisma.asset.findUnique({
    where: { id },
    select: { id: true, assetCode: true, assetName: true },
  });
  if (!asset) return err("Asset not found", 404);

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where: { assetId: id },
      include: {
        eventType: { select: { id: true, name: true, category: true } },
        lifecycleStage: { select: { id: true, name: true } },
        responsibleBody: { select: { id: true, name: true } },
      },
      orderBy: { occurredAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.event.count({ where: { assetId: id } }),
  ]);

  return ok(events, { page, per_page: perPage, total });
}
