"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

interface RiskEntry {
  asset_id: string;
  asset_code: string;
  asset_name: string;
  family: { id: string; name: string } | null;
  type: { id: string; name: string } | null;
  lifecycle_stage: { id: string; name: string } | null;
  responsible_body: { id: string; name: string } | null;
  risk_score: number;
  risk_band: "Low" | "Medium" | "High" | "Critical";
  top_factors: { label: string; points: number }[];
  computed_at: string;
}

interface FilterOption {
  id: string;
  name: string;
}

const BAND_STYLES: Record<string, string> = {
  Critical: "bg-red-100 text-red-800 border border-red-300",
  High: "bg-orange-100 text-orange-800 border border-orange-300",
  Medium: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  Low: "bg-green-100 text-green-800 border border-green-300",
};

const BAND_ORDER: Record<string, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

export default function RiskRegistryPage() {
  const [entries, setEntries] = useState<RiskEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 50;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [families, setFamilies] = useState<FilterOption[]>([]);
  const [bodies, setBodies] = useState<FilterOption[]>([]);
  const [stages, setStages] = useState<FilterOption[]>([]);
  const [filterFamily, setFilterFamily] = useState("");
  const [filterBody, setFilterBody] = useState("");
  const [filterBand, setFilterBand] = useState("");
  const [filterStage, setFilterStage] = useState("");

  // User role for CSV export
  const [userRole, setUserRole] = useState<string>("");

  const fetchEntries = useCallback(async (pg: number) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(pg), per_page: String(perPage) });
    if (filterFamily) params.set("family_id", filterFamily);
    if (filterBody) params.set("responsible_body_id", filterBody);
    if (filterBand) params.set("risk_band", filterBand);
    if (filterStage) params.set("lifecycle_stage_id", filterStage);

    try {
      const res = await fetch(`/api/reports/risk-registry?${params}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to load risk registry");
        return;
      }
      setEntries(json.data ?? []);
      setTotal(json.meta?.total ?? 0);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [filterFamily, filterBody, filterBand, filterStage]);

  // Fetch filter options on mount
  useEffect(() => {
    Promise.all([
      fetch("/api/asset-families").then((r) => r.json()),
      fetch("/api/responsible-bodies").then((r) => r.json()),
      fetch("/api/lifecycle-stages").then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()),
    ]).then(([fam, bod, stg, me]) => {
      setFamilies(fam.data ?? []);
      setBodies(bod.data ?? []);
      setStages(stg.data ?? []);
      setUserRole(me.data?.role ?? "");
    }).catch(() => {});
  }, []);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchEntries(1);
      return;
    }
    setPage(1);
    fetchEntries(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterFamily, filterBody, filterBand, filterStage]);

  useEffect(() => {
    if (!isFirstRender.current) {
      fetchEntries(page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleExportCSV = () => {
    if (!entries.length) return;
    const headers = ["Asset Code", "Asset Name", "Family", "Type", "Risk Band", "Risk Score", "Top Factors", "Last Updated"];
    const rows = entries.map((e) => [
      e.asset_code,
      e.asset_name,
      e.family?.name ?? "",
      e.type?.name ?? "",
      e.risk_band,
      String(e.risk_score),
      e.top_factors.map((f) => `${f.label}(${f.points})`).join("; "),
      new Date(e.computed_at).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `risk-registry-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canExport = ["asset_manager", "admin"].includes(userRole);
  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Risk Registry</h1>
            <p className="text-sm text-gray-500 mt-1">
              All assets ordered by computed risk score
            </p>
          </div>
          <div className="flex items-center gap-3">
            {canExport && (
              <button
                onClick={handleExportCSV}
                disabled={loading || entries.length === 0}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Export CSV
              </button>
            )}
            <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
              ← Dashboard
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Family</label>
              <select
                value={filterFamily}
                onChange={(e) => setFilterFamily(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              >
                <option value="">All Families</option>
                {families.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Responsible Body</label>
              <select
                value={filterBody}
                onChange={(e) => setFilterBody(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              >
                <option value="">All Bodies</option>
                {bodies.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Risk Band</label>
              <select
                value={filterBand}
                onChange={(e) => setFilterBand(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              >
                <option value="">All Bands</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Lifecycle Stage</label>
              <select
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              >
                <option value="">All Stages</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          {(filterFamily || filterBody || filterBand || filterStage) && (
            <button
              onClick={() => { setFilterFamily(""); setFilterBody(""); setFilterBand(""); setFilterStage(""); }}
              className="mt-3 text-xs text-blue-600 hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* Results count */}
        <div className="text-sm text-gray-500 mb-3">
          {loading ? "Loading..." : `${total} asset${total !== 1 ? "s" : ""} found`}
        </div>

        {/* Table */}
        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">{error}</div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asset</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Family / Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Band</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Top Factors</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">
                        Loading risk data...
                      </td>
                    </tr>
                  ) : entries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">
                        No risk scores found. Risk scores are computed when assets are updated.
                      </td>
                    </tr>
                  ) : (
                    entries
                      .sort((a, b) => {
                        const bandDiff = (BAND_ORDER[a.risk_band] ?? 99) - (BAND_ORDER[b.risk_band] ?? 99);
                        if (bandDiff !== 0) return bandDiff;
                        return b.risk_score - a.risk_score;
                      })
                      .map((entry) => (
                        <tr
                          key={entry.asset_id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => window.location.href = `/assets/${entry.asset_id}`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-700 w-fit mb-1">
                                {entry.asset_code}
                              </code>
                              <Link
                                href={`/assets/${entry.asset_id}`}
                                className="text-sm font-medium text-blue-600 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {entry.asset_name}
                              </Link>
                              {entry.responsible_body && (
                                <span className="text-xs text-gray-400 mt-0.5">{entry.responsible_body.name}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              {entry.family && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-800 w-fit">
                                  {entry.family.name}
                                </span>
                              )}
                              {entry.type && (
                                <span className="text-xs text-gray-500">{entry.type.name}</span>
                              )}
                              {entry.lifecycle_stage && (
                                <span className="text-xs text-gray-400">{entry.lifecycle_stage.name}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${BAND_STYLES[entry.risk_band] ?? ""}`}>
                              {entry.risk_band}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    entry.risk_band === "Critical" ? "bg-red-500" :
                                    entry.risk_band === "High" ? "bg-orange-500" :
                                    entry.risk_band === "Medium" ? "bg-yellow-500" : "bg-green-500"
                                  }`}
                                  style={{ width: `${entry.risk_score}%` }}
                                />
                              </div>
                              <span className="text-sm font-semibold text-gray-700">{entry.risk_score}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {entry.top_factors.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {entry.top_factors.map((f, i) => (
                                  <div key={i} className="flex items-center gap-1.5">
                                    <span className="text-xs text-gray-500">{f.label}</span>
                                    <span className="text-xs font-medium text-red-600">+{f.points}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">No risk factors</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-gray-500">
                              {new Date(entry.computed_at).toLocaleDateString()}
                            </span>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
