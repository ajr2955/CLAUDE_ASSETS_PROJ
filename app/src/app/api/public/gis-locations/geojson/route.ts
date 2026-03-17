import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SENSITIVE_OWNERSHIP_MODELS = ["leased_in", "leased_out", "allocated", "developer_obligation"];

export async function GET() {
  const locations = await prisma.gisLocation.findMany({
    where: {
      asset: {
        currentStatus: "active",
        ownershipModel: { notIn: SENSITIVE_OWNERSHIP_MODELS as never[] },
      },
    },
    include: {
      asset: {
        select: {
          id: true,
          assetName: true,
          currentStatus: true,
          assetFamily: { select: { id: true, name: true } },
          assetType: { select: { name: true } },
        },
      },
    },
  });

  const features = locations
    .filter((loc) => loc.latitude !== null && loc.longitude !== null)
    .map((loc) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point",
        coordinates: [Number(loc.longitude), Number(loc.latitude)],
      },
      properties: {
        id: loc.id,
        asset_id: loc.asset.id,
        asset_name: loc.asset.assetName,
        asset_family_id: loc.asset.assetFamily?.id ?? "",
        asset_family_name: loc.asset.assetFamily?.name ?? "",
        asset_type_name: loc.asset.assetType?.name ?? "",
        asset_status: loc.asset.currentStatus,
        neighborhood: loc.neighborhood,
      },
    }));

  return NextResponse.json({
    type: "FeatureCollection",
    features,
  });
}
