import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

const gisLocationInclude = {
  asset: { select: { id: true, assetName: true, assetCode: true, currentStatus: true } },
};

// PUT /api/gis-locations/:id — update coordinates and metadata
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(req, "operations_manager");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const location = await prisma.gisLocation.findUnique({ where: { id } });
  if (!location) return err("GIS location not found", 404);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  // Validate geometry type if provided
  const validGeometryTypes = ["point", "polygon", "line"];
  if (body.geometry_type && !validGeometryTypes.includes(body.geometry_type)) {
    return err(`Invalid geometry_type. Must be one of: ${validGeometryTypes.join(", ")}`, 422);
  }

  const updateData: Record<string, unknown> = {};
  if (body.latitude !== undefined) updateData.latitude = body.latitude;
  if (body.longitude !== undefined) updateData.longitude = body.longitude;
  if (body.geometry_type !== undefined) updateData.geometryType = body.geometry_type;
  if (body.geojson !== undefined) updateData.geojson = body.geojson;
  if (body.address_formatted !== undefined) updateData.addressFormatted = body.address_formatted;
  if (body.neighborhood !== undefined) updateData.neighborhood = body.neighborhood;
  if (body.district !== undefined) updateData.district = body.district;
  if (body.parcel_number !== undefined) updateData.parcelNumber = body.parcel_number;
  if (body.map_layer_reference !== undefined) updateData.mapLayerReference = body.map_layer_reference;

  const updated = await prisma.gisLocation.update({
    where: { id },
    data: updateData,
    include: gisLocationInclude,
  });

  return ok(updated);
}
