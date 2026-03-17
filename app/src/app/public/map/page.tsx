"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { GeoFeature } from "../../map/LeafletMap";

const LeafletMap = dynamic(() => import("../../map/LeafletMap"), { ssr: false });

interface PublicGeoFeatureProperties {
  id: string;
  asset_id: string;
  asset_name: string;
  asset_family_id: string;
  asset_family_name: string;
  asset_type_name: string;
  asset_status: string;
  neighborhood: string | null;
}

const FAMILY_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#84cc16", "#f97316", "#ec4899",
];

export default function PublicMapPage() {
  const [features, setFeatures] = useState<GeoFeature[]>([]);
  const [familyColors, setFamilyColors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalFeatures, setTotalFeatures] = useState(0);

  const fetchGeoData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/public/gis-locations/geojson");
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      const featureList: GeoFeature[] = (json.features ?? []).map(
        (f: { type: string; geometry: { type: string; coordinates: unknown } | null; properties: PublicGeoFeatureProperties }) => ({
          type: "Feature" as const,
          geometry: f.geometry,
          properties: {
            id: f.properties.id,
            asset_id: f.properties.asset_id,
            asset_name: f.properties.asset_name,
            asset_code: "",
            asset_status: f.properties.asset_status,
            asset_family_id: f.properties.asset_family_id,
            asset_family_name: f.properties.asset_family_name,
            asset_type_name: f.properties.asset_type_name,
            lifecycle_stage_name: "Active",
            geometry_type: f.geometry?.type ?? "Point",
          },
        })
      );

      // Build family colors
      const colorMap: Record<string, string> = {};
      let idx = 0;
      for (const f of featureList) {
        const fid = f.properties.asset_family_id;
        if (fid && !colorMap[fid]) {
          colorMap[fid] = FAMILY_COLORS[idx % FAMILY_COLORS.length];
          idx++;
        }
      }

      setFeatures(featureList);
      setFamilyColors(colorMap);
      setTotalFeatures(featureList.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load map data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGeoData();
  }, [fetchGeoData]);

  // Build legend entries
  const familyEntries = Object.entries(
    features.reduce<Record<string, string>>((acc, f) => {
      if (f.properties.asset_family_id && !acc[f.properties.asset_family_id]) {
        acc[f.properties.asset_family_id] = f.properties.asset_family_name;
      }
      return acc;
    }, {})
  );

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Public header */}
      <header className="bg-blue-700 text-white py-6 px-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold">Municipal Public Assets</h1>
          <p className="text-blue-200 text-sm mt-1">
            View active public facilities and services in your area
          </p>
          <div className="mt-3 flex gap-4 text-sm">
            <Link href="/public/assets" className="text-blue-200 hover:text-white">
              Asset List
            </Link>
            <span className="text-blue-100 font-semibold border-b-2 border-white pb-1">
              Map View
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 120px)" }}>
        {/* Side panel */}
        <div className="w-64 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto p-4">
          <div className="mb-4">
            <p className="text-sm text-gray-500">
              {loading ? "Loading..." : `${totalFeatures} mapped asset${totalFeatures !== 1 ? "s" : ""}`}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2 mb-4">
              {error}
            </div>
          )}

          {/* Legend */}
          {familyEntries.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                Asset Categories
              </h3>
              <div className="space-y-1.5">
                {familyEntries.map(([fid, fname]) => (
                  <div key={fid} className="flex items-center gap-2 text-xs text-gray-700">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: familyColors[fid] ?? "#6b7280" }}
                    />
                    <span>{fname}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 text-xs text-gray-400">
            Click a marker to view asset details.
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <div className="text-sm text-gray-500">Loading map...</div>
            </div>
          )}
          <LeafletMap features={features} familyColors={familyColors} />
        </div>
      </div>

      <footer className="border-t border-gray-200 py-3 text-center text-xs text-gray-400 flex-shrink-0">
        Municipal Asset Information — Public Portal
      </footer>
    </div>
  );
}
