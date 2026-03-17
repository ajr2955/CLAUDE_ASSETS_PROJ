"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { GeoFeature } from "./LeafletMap";

// Dynamically import Leaflet map (SSR disabled)
const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 h-full bg-gray-100 flex items-center justify-center">
      <p className="text-gray-500">Loading map...</p>
    </div>
  ),
});

interface AssetFamily {
  id: string;
  name: string;
}

interface AssetType {
  id: string;
  name: string;
  assetFamilyId: string;
}

interface LifecycleStage {
  id: string;
  name: string;
}

interface UnmappedAsset {
  id: string;
  assetCode: string;
  assetName: string;
  assetFamily: { name: string };
  assetType: { name: string };
  currentStatus: string;
}

// Family color scheme
const FAMILY_COLORS: string[] = [
  "#3B82F6", // blue
  "#10B981", // emerald
  "#F59E0B", // amber
  "#059669", // green
  "#84CC16", // lime
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#6B7280", // gray
  "#EF4444", // red
];

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "in_formation", label: "In Formation" },
  { value: "in_construction", label: "In Construction" },
  { value: "decommissioned", label: "Decommissioned" },
  { value: "disposed", label: "Disposed" },
];

export default function MapPage() {
  const [families, setFamilies] = useState<AssetFamily[]>([]);
  const [allTypes, setAllTypes] = useState<AssetType[]>([]);
  const [stages, setStages] = useState<LifecycleStage[]>([]);

  const [selectedFamilyId, setSelectedFamilyId] = useState<string>("");
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedStageId, setSelectedStageId] = useState<string>("");

  const [features, setFeatures] = useState<GeoFeature[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const [unmappedAssets, setUnmappedAssets] = useState<UnmappedAsset[]>([]);
  const [unmappedTotal, setUnmappedTotal] = useState(0);
  const [unmappedLoading, setUnmappedLoading] = useState(false);

  const [familyColors, setFamilyColors] = useState<Record<string, string>>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Build family colors map from loaded families
  useEffect(() => {
    const colorMap: Record<string, string> = {};
    families.forEach((f, i) => {
      colorMap[f.id] = FAMILY_COLORS[i % FAMILY_COLORS.length];
    });
    setFamilyColors(colorMap);
  }, [families]);

  // Load filter options on mount
  useEffect(() => {
    Promise.all([
      fetch("/api/asset-families").then((r) => r.json()),
      fetch("/api/asset-types").then((r) => r.json()),
      fetch("/api/lifecycle-stages").then((r) => r.json()),
    ]).then(([fRes, tRes, sRes]) => {
      setFamilies(fRes.data ?? []);
      setAllTypes(tRes.data ?? []);
      setStages(sRes.data ?? []);
    });
  }, []);

  // Fetch GeoJSON features when filters change
  const fetchFeatures = useCallback(async () => {
    setMapLoading(true);
    setMapError(null);
    try {
      const params = new URLSearchParams();
      if (selectedFamilyId) params.set("family_id", selectedFamilyId);
      if (selectedStatus) params.set("status", selectedStatus);
      if (selectedStageId) params.set("lifecycle_stage_id", selectedStageId);

      const res = await fetch(`/api/gis-locations/geojson?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load map data");
      const json = await res.json();
      setFeatures(json.features ?? []);
    } catch (e) {
      setMapError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setMapLoading(false);
    }
  }, [selectedFamilyId, selectedStatus, selectedStageId]);

  // Fetch unmapped assets (assets in the same family filter but with no GIS coords)
  const fetchUnmapped = useCallback(async () => {
    setUnmappedLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("per_page", "50");
      if (selectedFamilyId) params.set("family_id", selectedFamilyId);
      if (selectedStatus) params.set("status", selectedStatus);

      const res = await fetch(`/api/assets?${params.toString()}`);
      if (!res.ok) return;
      const json = await res.json();
      const allAssets: UnmappedAsset[] = json.data ?? [];

      // Get the set of asset IDs that have map features
      // Re-fetch features to get current IDs (or use the features state if already loaded)
      // Compare: assets not in features
      const mappedIds = new Set<string>();
      // We need to check after features are fetched; use a ref to avoid race
      // For simplicity: assets whose IDs don't appear in the features list
      // We fetch features in parallel and compare here
      const geoParams = new URLSearchParams();
      if (selectedFamilyId) geoParams.set("family_id", selectedFamilyId);
      if (selectedStatus) geoParams.set("status", selectedStatus);
      const geoRes = await fetch(`/api/gis-locations/geojson?${geoParams.toString()}`);
      if (geoRes.ok) {
        const geoJson = await geoRes.json();
        (geoJson.features ?? []).forEach((f: GeoFeature) => {
          mappedIds.add(f.properties.asset_id);
        });
      }

      const unmapped = allAssets.filter((a) => !mappedIds.has(a.id));
      setUnmappedAssets(unmapped);
      setUnmappedTotal(json.meta?.total ?? 0);
    } finally {
      setUnmappedLoading(false);
    }
  }, [selectedFamilyId, selectedStatus]);

  // Debounce filter changes
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchFeatures();
      fetchUnmapped();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchFeatures, fetchUnmapped]);

  // Available types filtered by selected family
  const availableTypes = selectedFamilyId
    ? allTypes.filter((t) => t.assetFamilyId === selectedFamilyId)
    : allTypes;

  // Reset type when family changes
  const handleFamilyChange = (value: string) => {
    setSelectedFamilyId(value);
    setSelectedTypeId("");
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <div
        className={`flex flex-col bg-white border-r border-gray-200 transition-all duration-200 ${
          sidebarCollapsed ? "w-10" : "w-80"
        } flex-shrink-0`}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <Link href="/assets" className="text-gray-400 hover:text-gray-600 text-sm">
                ← Assets
              </Link>
              <span className="text-gray-300">|</span>
              <h1 className="text-sm font-semibold text-gray-800">Asset Map</h1>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 ml-auto"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? "▶" : "◀"}
          </button>
        </div>

        {!sidebarCollapsed && (
          <div className="flex-1 overflow-y-auto">
            {/* Filters */}
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Filters</h2>

              <div className="space-y-3">
                {/* Family */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Family</label>
                  <select
                    value={selectedFamilyId}
                    onChange={(e) => handleFamilyChange(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">All Families</option>
                    {families.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Type */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select
                    value={selectedTypeId}
                    onChange={(e) => setSelectedTypeId(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={availableTypes.length === 0}
                  >
                    <option value="">All Types</option>
                    {availableTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">All Statuses</option>
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Lifecycle Stage */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Lifecycle Stage</label>
                  <select
                    value={selectedStageId}
                    onChange={(e) => setSelectedStageId(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">All Stages</option>
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Clear filters */}
                {(selectedFamilyId || selectedTypeId || selectedStatus || selectedStageId) && (
                  <button
                    onClick={() => {
                      setSelectedFamilyId("");
                      setSelectedTypeId("");
                      setSelectedStatus("");
                      setSelectedStageId("");
                    }}
                    className="w-full text-xs text-blue-600 hover:text-blue-800 py-1 border border-blue-200 rounded hover:bg-blue-50"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* Family color legend */}
            {families.length > 0 && (
              <div className="p-4 border-b border-gray-100">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Legend</h2>
                <div className="space-y-1.5">
                  {families.map((f, i) => (
                    <div key={f.id} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: FAMILY_COLORS[i % FAMILY_COLORS.length] }}
                      />
                      <span className="text-xs text-gray-600 truncate">{f.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Map status */}
            {mapLoading && (
              <div className="px-4 py-2 text-xs text-blue-600 bg-blue-50">
                Loading map data...
              </div>
            )}
            {mapError && (
              <div className="px-4 py-2 text-xs text-red-600 bg-red-50">
                {mapError}
              </div>
            )}
            {!mapLoading && !mapError && (
              <div className="px-4 py-2 text-xs text-gray-500">
                {features.length} asset{features.length !== 1 ? "s" : ""} on map
              </div>
            )}

            {/* Unmapped assets */}
            <div className="p-4">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Unmapped Assets
                {unmappedAssets.length > 0 && (
                  <span className="ml-2 bg-gray-200 text-gray-600 rounded-full px-2 py-0.5 text-xs font-normal">
                    {unmappedAssets.length}
                  </span>
                )}
              </h2>

              {unmappedLoading ? (
                <p className="text-xs text-gray-400">Loading...</p>
              ) : unmappedAssets.length === 0 ? (
                <p className="text-xs text-gray-400">
                  {unmappedTotal > 0
                    ? "All visible assets are mapped"
                    : "No assets found"}
                </p>
              ) : (
                <div className="space-y-2">
                  {unmappedAssets.slice(0, 20).map((a) => (
                    <Link
                      key={a.id}
                      href={`/assets/${a.id}`}
                      className="block p-2 bg-gray-50 rounded border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                      <div className="font-mono text-xs text-gray-500">{a.assetCode}</div>
                      <div className="text-xs font-medium text-gray-800 truncate">{a.assetName}</div>
                      <div className="text-xs text-gray-500 truncate">{a.assetFamily?.name}</div>
                    </Link>
                  ))}
                  {unmappedAssets.length > 20 && (
                    <p className="text-xs text-gray-400 text-center py-1">
                      + {unmappedAssets.length - 20} more
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Map area */}
      <div className="flex-1 relative">
        <LeafletMap features={features} familyColors={familyColors} />
      </div>
    </div>
  );
}
