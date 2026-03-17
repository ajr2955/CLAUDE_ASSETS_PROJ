import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

// GET /api/assets/:id/revenue-summary
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const asset = await prisma.asset.findUnique({ where: { id }, select: { id: true } });
  if (!asset) return NextResponse.json(err("Asset not found"), { status: 404 });

  const now = new Date();
  const ytdStart = new Date(now.getFullYear(), 0, 1); // Jan 1 of current year

  const records = await prisma.revenueRecord.findMany({
    where: {
      assetId: id,
      periodStart: { gte: ytdStart },
    },
    select: {
      expectedAmount: true,
      actualAmount: true,
      status: true,
    },
  });

  let totalExpectedYtd = 0;
  let totalReceivedYtd = 0;
  let totalOverdueYtd = 0;

  for (const r of records) {
    totalExpectedYtd += Number(r.expectedAmount);
    if (r.status === "received" || r.status === "partial") {
      totalReceivedYtd += Number(r.actualAmount);
    }
    if (r.status === "overdue") {
      totalOverdueYtd += Number(r.expectedAmount) - Number(r.actualAmount);
    }
  }

  return NextResponse.json(
    ok({
      asset_id: id,
      fiscal_year: now.getFullYear(),
      total_expected_ytd: totalExpectedYtd,
      total_received_ytd: totalReceivedYtd,
      total_overdue_ytd: totalOverdueYtd,
      record_count: records.length,
    })
  );
}
