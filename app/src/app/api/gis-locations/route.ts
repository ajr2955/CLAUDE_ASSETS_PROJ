import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

const gisLocationInclude = {
  asset: { select: { id: true, assetName: true, assetCode: true, currentStatus: true } },
};

// GET /api/gis-locations — list GIS locations with optional filters
export async function GET(req: NextRequest) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const district = sp.get("district");
  const neighborhood = sp.get("neighborhood");
  const hasCoordinatesParam = sp.get("has_coordinates");

  const where: Record<string, unknown> = {};
  if (district) where.district = { contains: district, mode: "insensitive" };
  if (neighborhood) where.neighborhood = { contains: neighborhood, mode: "insensitive" };

  if (hasCoordinatesParam !== null) {
    if (hasCoordinatesParam === "true") {
      where.latitude = { not: null };
      where.longitude = { not: null };
    } else if (hasCoordinatesParam === "false") {
      where.OR = [{ latitude: null }, { longitude: null }];
    }
  }

  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const perPage = Math.min(100, Math.max(1, parseInt(sp.get("per_page") ?? "25", 10)));
  const skip = (page - 1) * perPage;

  const [locations, total] = await Promise.all([
    prisma.gisLocation.findMany({
      where,
      include: gisLocationInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    prisma.gisLocation.count({ where }),
  ]);

  return ok(locations, { page, per_page: perPage, total });
}

// POST /api/gis-locations — create a location and link it to an asset
export async function POST(req: NextRequest) {
  const auth = requireAuth(req, "operations_manager");
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  const { asset_id } = body;
  if (!asset_id) return err("asset_id is required", 422);

  // Check asset exists
  const asset = await prisma.asset.findUnique({ where: { id: asset_id } });
  if (!asset) return err("Asset not found", 404);

  // Check if a GIS location already exists for this asset
  const existing = await prisma.gisLocation.findUnique({ where: { assetId: asset_id } });
  if (existing) {
    return err(
      "A GIS location already exists for this asset. Use PUT /api/gis-locations/:id to update it.",
      409
    );
  }

  // Validate geometry type if provided
  const validGeometryTypes = ["point", "polygon", "line"];
  if (body.geometry_type && !validGeometryTypes.includes(body.geometry_type)) {
    return err(`Invalid geometry_type. Must be one of: ${validGeometryTypes.join(", ")}`, 422);
  }

  // Create location record
  const location = await prisma.gisLocation.create({
    data: {
      assetId: asset_id,
      latitude: body.latitude !== undefined ? body.latitude : null,
      longitude: body.longitude !== undefined ? body.longitude : null,
      geometryType: body.geometry_type ?? "point",
      geojson: body.geojson ?? null,
      addressFormatted: body.address_formatted ?? null,
      neighborhood: body.neighborhood ?? null,
      district: body.district ?? null,
      parcelNumber: body.parcel_number ?? null,
      mapLayerReference: body.map_layer_reference ?? null,
    },
    include: gisLocationInclude,
  });

  // Update asset.location_id to link to the new location
  await prisma.asset.update({
    where: { id: asset_id },
    data: { locationId: location.id },
  });

  return ok(location, undefined, 201);
}
