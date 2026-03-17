"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface DeveloperObligation {
  id: string;
  obligationReference: string;
  developerName: string;
  relatedProjectName: string;
  committedDeliveryDate: string | null;
  actualDeliveryDate: string | null;
  status: string;
  gapsIdentified: string | null;
  receivingBodyIsPlaceholder: boolean;
  promisedAssetFamily: { id: string; name: string };
  promisedAssetType: { id: string; name: string };
}

interface Family { id: string; name: string }

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  delivered: "Delivered",
  closed_gap_identified: "Closed – Gap Identified",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  delivered: "bg-emerald-100 text-emerald-700",
  closed_gap_identified: "bg-red-100 text-red-700",
};

const STATUSES = Object.keys(STATUS_LABELS);

export default function DeveloperObligationsPage() {
  const [obligations, setObligations] = useState<DeveloperObligation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [families, setFamilies] = useState<Family[]>([]);

  const [filterStatus, setFilterStatus] = useState("");
  const [filterDeveloper, setFilterDeveloper] = useState("");
  const [filterFamilyId, setFilterFamilyId] = useState("");
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [filterPlaceholder, setFilterPlaceholder] = useState(false);

  const fetchObligations = useCallback(async () => {
    setLoading(true);
    setError(null);
    const sp = new URLSearchParams();
    if (filterStatus) sp.set("status", filterStatus);
    if (filterDeveloper) sp.set("developer_name", filterDeveloper);
    if (filterFamilyId) sp.set("promised_asset_family_id", filterFamilyId);
    if (filterOverdue) sp.set("overdue", "true");
    if (filterPlaceholder) sp.set("receiving_body_is_placeholder", "true");
    sp.set("per_page", "50");
    try {
      const res = await fetch(`/api/developer-obligations?${sp.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setObligations(json.data);
      setTotal(json.meta?.total ?? json.data.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterDeveloper, filterFamilyId, filterOverdue, filterPlaceholder]);

  useEffect(() => {
    fetchObligations();
  }, [fetchObligations]);

  useEffect(() => {
    fetch("/api/asset-families?per_page=100")
      .then((r) => r.json())
      .then((j) => setFamilies(j.data ?? []))
      .catch(() => {});
  }, []);

  const isOverdue = (ob: DeveloperObligation) => {
    if (!ob.committedDeliveryDate) return false;
    if (ob.status === "delivered" || ob.status === "closed_gap_identified") return false;
    return new Date(ob.committedDeliveryDate) < new Date();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Developer Obligations</h1>
          <p className="text-sm text-gray-500 mt-1">{total} obligation{total !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-lg p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Developer name..."
            value={filterDeveloper}
            onChange={(e) => setFilterDeveloper(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />

          <select
            value={filterFamilyId}
            onChange={(e) => setFilterFamilyId(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">All Families</option>
            {families.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>

          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={filterOverdue}
                onChange={(e) => setFilterOverdue(e.target.checked)}
                className="rounded"
              />
              Overdue only
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={filterPlaceholder}
                onChange={(e) => setFilterPlaceholder(e.target.checked)}
                className="rounded"
              />
              Placeholder body
            </label>
          </div>
        </div>
      </div>

      {/* Table */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 mb-4 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : obligations.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No obligations found</div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Reference</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Developer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Promised Asset Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Committed Delivery</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actual Delivery</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {obligations.map((ob) => {
                const overdue = isOverdue(ob);
                return (
                  <tr key={ob.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/developer-obligations/${ob.id}`}
                        className="font-mono text-blue-600 hover:underline text-xs"
                      >
                        {ob.obligationReference}
                      </Link>
                      <div className="text-gray-500 text-xs">{ob.relatedProjectName}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-800">{ob.developerName}</td>
                    <td className="px-4 py-3">
                      <div className="text-gray-800">{ob.promisedAssetType.name}</div>
                      <div className="text-gray-500 text-xs">{ob.promisedAssetFamily.name}</div>
                    </td>
                    <td className="px-4 py-3">
                      {ob.committedDeliveryDate ? (
                        <span className={overdue ? "text-red-600 font-medium" : "text-gray-800"}>
                          {new Date(ob.committedDeliveryDate).toLocaleDateString()}
                          {overdue && " ⚠"}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {ob.actualDeliveryDate ? (
                        <span className="text-gray-800">{new Date(ob.actualDeliveryDate).toLocaleDateString()}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ob.status] ?? "bg-gray-100 text-gray-700"}`}>
                        {STATUS_LABELS[ob.status] ?? ob.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {ob.gapsIdentified && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Gap</span>
                        )}
                        {ob.receivingBodyIsPlaceholder && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">TBD Body</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
