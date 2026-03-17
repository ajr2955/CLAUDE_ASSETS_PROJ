import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";

// Ownership models that should not be exposed publicly
const SENSITIVE_OWNERSHIP_MODELS = ["leased_in", "leased_out", "allocated", "developer_obligation"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const per_page = Math.min(50, parseInt(searchParams.get("per_page") ?? "25"));

  const total = await prisma.asset.count({
    where: {
      currentStatus: "active",
      ownershipModel: { notIn: SENSITIVE_OWNERSHIP_MODELS as never[] },
    },
  });

  const assets = await prisma.asset.findMany({
    where: {
      currentStatus: "active",
      ownershipModel: { notIn: SENSITIVE_OWNERSHIP_MODELS as never[] },
    },
    select: {
      id: true,
      assetName: true,
      currentStatus: true,
      serviceStartDate: true,
      assetType: { select: { name: true } },
      assetFamily: { select: { name: true } },
      gisLocation: { select: { neighborhood: true } },
    },
    orderBy: { assetName: "asc" },
    skip: (page - 1) * per_page,
    take: per_page,
  });

  const data = assets.map((a) => ({
    asset_name: a.assetName,
    asset_type: a.assetType?.name ?? null,
    asset_family: a.assetFamily?.name ?? null,
    neighborhood: a.gisLocation?.neighborhood ?? null,
    status: a.currentStatus,
    service_start_date: a.serviceStartDate,
  }));

  return NextResponse.json(ok(data, { page, per_page, total }));
}
