"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export interface GeoFeatureProperties {
  id: string;
  asset_id: string;
  asset_name: string;
  asset_code: string;
  asset_status: string;
  asset_family_id: string;
  asset_family_name: string;
  asset_type_name: string;
  lifecycle_stage_name: string;
  geometry_type: string;
}

export interface GeoFeature {
  type: "Feature";
  geometry: {
    type: string;
    coordinates: unknown;
  } | null;
  properties: GeoFeatureProperties;
}

interface LeafletMapProps {
  features: GeoFeature[];
  familyColors: Record<string, string>;
}

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  in_formation: "In Formation",
  in_construction: "In Construction",
  decommissioned: "Decommissioned",
  disposed: "Disposed",
};

export default function LeafletMap({ features, familyColors }: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layersRef = useRef<any[]>([]);

  // Initialize map once
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const L = require("leaflet");

    const map = L.map(mapRef.current, {
      center: [32.0853, 34.7818], // Default: Tel Aviv area
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update layers when features change
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const L = require("leaflet");
    const map = mapInstanceRef.current;

    // Remove existing layers
    layersRef.current.forEach((layer) => map.removeLayer(layer));
    layersRef.current = [];

    features.forEach((feature) => {
      if (!feature.geometry) return;

      const props = feature.properties;
      const color = familyColors[props.asset_family_id] ?? "#6B7280";
      const statusLabel = STATUS_LABELS[props.asset_status] ?? props.asset_status;

      const popupContent = `
        <div style="min-width:200px; font-family: sans-serif;">
          <div style="font-weight:700; font-size:14px; margin-bottom:4px;">${props.asset_name}</div>
          <div style="font-size:12px; color:#6b7280; margin-bottom:6px;">${props.asset_code}</div>
          <div style="margin-bottom:4px;">
            <span style="background:${color};color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;">${props.asset_family_name}</span>
            <span style="background:#e5e7eb;color:#374151;padding:2px 6px;border-radius:4px;font-size:11px;margin-left:4px;">${props.asset_type_name}</span>
          </div>
          <div style="font-size:12px;margin-bottom:2px;"><strong>Status:</strong> ${statusLabel}</div>
          <div style="font-size:12px;margin-bottom:8px;"><strong>Stage:</strong> ${props.lifecycle_stage_name}</div>
          <a href="/assets/${props.asset_id}" style="display:inline-block;background:#3b82f6;color:#fff;padding:4px 10px;border-radius:4px;font-size:12px;text-decoration:none;">View Asset</a>
        </div>
      `;

      if (feature.geometry.type === "Point") {
        const coords = feature.geometry.coordinates as [number, number];
        // GeoJSON uses [lng, lat]
        const layer = L.circleMarker([coords[1], coords[0]], {
          radius: 8,
          fillColor: color,
          color: "#ffffff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.85,
        });
        layer.bindPopup(popupContent);
        layer.addTo(map);
        layersRef.current.push(layer);
      } else if (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon" || feature.geometry.type === "LineString" || feature.geometry.type === "MultiLineString") {
        // Use L.geoJSON for polygon/line features
        const layer = L.geoJSON(feature, {
          style: {
            color: color,
            weight: 2,
            fillColor: color,
            fillOpacity: 0.3,
          },
        });
        layer.bindPopup(popupContent);
        layer.addTo(map);
        layersRef.current.push(layer);
      }
    });

    // Fit bounds if there are features
    if (features.length > 0 && layersRef.current.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const group = L.featureGroup(layersRef.current);
      try {
        const bounds = group.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [40, 40] });
        }
      } catch {
        // ignore if bounds are invalid
      }
    }
  }, [features, familyColors]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full"
      style={{ minHeight: "400px" }}
    />
  );
}
