import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

// GET /api/gis-locations/geojson — returns a GeoJSON FeatureCollection of all assets with coordinates
// Supports filters: family_id, status, lifecycle_stage_id
export async function GET(req: NextRequest) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const familyId = sp.get("family_id");
  const status = sp.get("status");
  const lifecycleStageId = sp.get("lifecycle_stage_id");

  // Build asset filter
  const assetWhere: Prisma.AssetWhereInput = {};
  if (familyId) assetWhere.assetFamilyId = familyId;
  if (status) assetWhere.currentStatus = status as Prisma.EnumAssetStatusFilter;
  if (lifecycleStageId) assetWhere.currentLifecycleStageId = lifecycleStageId;

  const locationWhere: Prisma.GisLocationWhereInput = {
    // Only include locations that have coordinates or geojson geometry
    OR: [
      { latitude: { not: null }, longitude: { not: null } },
      { geojson: { not: null } },
    ],
  };

  if (Object.keys(assetWhere).length > 0) {
    locationWhere.asset = assetWhere;
  }

  const locationInclude = {
    asset: {
      select: {
        id: true,
        assetName: true,
        assetCode: true,
        currentStatus: true,
        assetFamily: { select: { id: true, name: true } },
        assetType: { select: { id: true, name: true } },
        currentLifecycleStage: { select: { id: true, name: true } },
        address: true,
      },
    },
  };

  const locations = await prisma.gisLocation.findMany({
    where: locationWhere,
    include: locationInclude,
    orderBy: { createdAt: "asc" },
  });

  // Build GeoJSON FeatureCollection
  type GeoJsonGeometry =
    | { type: "Point"; coordinates: [number, number] }
    | Record<string, unknown>;

  type GeoJsonFeature = {
    type: "Feature";
    geometry: GeoJsonGeometry | null;
    properties: Record<string, unknown>;
  };

  const features: GeoJsonFeature[] = locations.map((loc) => {
    let geometry: GeoJsonGeometry | null = null;

    if (loc.geojson && loc.geojson !== null) {
      // Use stored GeoJSON geometry directly
      geometry = loc.geojson as Record<string, unknown>;
    } else if (loc.latitude !== null && loc.longitude !== null) {
      geometry = {
        type: "Point" as const,
        coordinates: [
          parseFloat(loc.longitude.toString()),
          parseFloat(loc.latitude.toString()),
        ],
      };
    }

    const { asset } = loc;

    return {
      type: "Feature" as const,
      geometry,
      properties: {
        id: loc.id,
        asset_id: loc.assetId,
        asset_name: asset.assetName,
        asset_code: asset.assetCode,
        asset_status: asset.currentStatus,
        asset_family_id: asset.assetFamily.id,
        asset_family_name: asset.assetFamily.name,
        asset_type_id: asset.assetType.id,
        asset_type_name: asset.assetType.name,
        lifecycle_stage_id: asset.currentLifecycleStage.id,
        lifecycle_stage_name: asset.currentLifecycleStage.name,
        address: asset.address ?? loc.addressFormatted ?? null,
        district: loc.district,
        neighborhood: loc.neighborhood,
        parcel_number: loc.parcelNumber,
        geometry_type: loc.geometryType,
      },
    };
  });

  const featureCollection = {
    type: "FeatureCollection",
    features,
    meta: {
      total: features.length,
      filters: {
        family_id: familyId ?? null,
        status: status ?? null,
        lifecycle_stage_id: lifecycleStageId ?? null,
      },
    },
  };

  return NextResponse.json(featureCollection);
}
