import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

// GET /api/gis-locations/near — returns assets within a radius ordered by distance
// Params: lat, lng, radius_meters
// Uses Haversine formula in-memory since PostGIS is not assumed available.
// For large datasets this is not scalable, but is correct for the current scope.
export async function GET(req: NextRequest) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const latParam = sp.get("lat");
  const lngParam = sp.get("lng");
  const radiusParam = sp.get("radius_meters");

  if (!latParam) return err("lat is required", 422);
  if (!lngParam) return err("lng is required", 422);
  if (!radiusParam) return err("radius_meters is required", 422);

  const lat = parseFloat(latParam);
  const lng = parseFloat(lngParam);
  const radiusMeters = parseFloat(radiusParam);

  if (isNaN(lat) || lat < -90 || lat > 90) {
    return err("lat must be a valid latitude between -90 and 90", 422);
  }
  if (isNaN(lng) || lng < -180 || lng > 180) {
    return err("lng must be a valid longitude between -180 and 180", 422);
  }
  if (isNaN(radiusMeters) || radiusMeters <= 0) {
    return err("radius_meters must be a positive number", 422);
  }

  // Approximate bounding box for initial DB filter (1 degree latitude ≈ 111,000 m)
  const latDelta = radiusMeters / 111000;
  const lngDelta = radiusMeters / (111000 * Math.cos((lat * Math.PI) / 180));

  const candidates = await prisma.gisLocation.findMany({
    where: {
      latitude: {
        gte: lat - latDelta,
        lte: lat + latDelta,
      },
      longitude: {
        gte: lng - lngDelta,
        lte: lng + lngDelta,
      },
    },
    include: {
      asset: {
        select: {
          id: true,
          assetName: true,
          assetCode: true,
          currentStatus: true,
          assetFamily: { select: { id: true, name: true } },
          assetType: { select: { id: true, name: true } },
          currentLifecycleStage: { select: { id: true, name: true } },
        },
      },
    },
  });

  // Apply precise Haversine filter and compute distances
  const EARTH_RADIUS_M = 6371000;

  type CandidateWithDistance = (typeof candidates)[number] & { distance_meters: number };

  const results: CandidateWithDistance[] = [];

  for (const loc of candidates) {
    if (loc.latitude === null || loc.longitude === null) continue;

    const locLat = parseFloat(loc.latitude.toString());
    const locLng = parseFloat(loc.longitude.toString());

    const dLat = ((locLat - lat) * Math.PI) / 180;
    const dLng = ((locLng - lng) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat * Math.PI) / 180) *
        Math.cos((locLat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMeters = EARTH_RADIUS_M * c;

    if (distanceMeters <= radiusMeters) {
      results.push({ ...loc, distance_meters: Math.round(distanceMeters) });
    }
  }

  // Sort by distance ascending
  results.sort((a, b) => a.distance_meters - b.distance_meters);

  return ok(results, { page: 1, per_page: results.length, total: results.length });
}
