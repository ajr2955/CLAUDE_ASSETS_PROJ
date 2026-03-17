"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

interface RuleDetail {
  rule_id: string;
  document_type_id: string;
  document_type_name: string;
  is_mandatory: boolean;
  is_satisfied: boolean;
}

interface AssetCompleteness {
  asset_id: string;
  asset_code: string;
  asset_name: string;
  family_name: string | null;
  type_name: string | null;
  lifecycle_stage_name: string | null;
  completeness_score: number;
  total_rules: number;
  satisfied_rules: number;
  missing_count: number;
  rules: RuleDetail[];
}

interface Family { id: string; name: string; }
interface Stage { id: string; name: string; }
interface Body { id: string; name: string; }

export default function DocumentCompletenessPage() {
  const [items, setItems] = useState<AssetCompleteness[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 25;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [families, setFamilies] = useState<Family[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [bodies, setBodies] = useState<Body[]>([]);

  const [filterFamily, setFilterFamily] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterBody, setFilterBody] = useState("");
  const [filterHasMissing, setFilterHasMissing] = useState(false);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(p));
      params.set("per_page", String(perPage));
      if (filterFamily) params.set("family_id", filterFamily);
      if (filterStage) params.set("stage_id", filterStage);
      if (filterBody) params.set("responsible_body_id", filterBody);
      if (filterHasMissing) params.set("has_missing", "true");

      const res = await fetch(`/api/reports/document-completeness?${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setItems(json.data ?? []);
      setTotal(json.meta?.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [filterFamily, filterStage, filterBody, filterHasMissing]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchData(1);
    }, 200);
  }, [fetchData]);

  useEffect(() => {
    fetchData(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    Promise.all([
      fetch("/api/asset-families").then((r) => r.json()),
      fetch("/api/lifecycle-stages").then((r) => r.json()),
      fetch("/api/responsible-bodies").then((r) => r.json()),
    ]).then(([f, s, b]) => {
      setFamilies(f.data ?? []);
      setStages(s.data ?? []);
      setBodies(b.data ?? []);
    });
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const scoreColor = (score: number) => {
    if (score === 100) return "bg-green-500";
    if (score >= 75) return "bg-yellow-400";
    if (score >= 50) return "bg-orange-400";
    return "bg-red-500";
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Document Completeness</h1>
          <p className="text-sm text-gray-500 mt-1">
            Assets missing required documents for their current lifecycle stage
          </p>
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
                <option value="">All families</option>
                {families.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Lifecycle Stage</label>
              <select
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              >
                <option value="">All stages</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
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
                <option value="">All bodies</option>
                {bodies.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={filterHasMissing}
                  onChange={(e) => setFilterHasMissing(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                Show only assets with missing docs
              </label>
            </div>
          </div>
        </div>

        {/* Results count */}
        <p className="text-sm text-gray-500 mb-3">
          {loading ? "Loading..." : `${total} asset${total !== 1 ? "s" : ""}`}
        </p>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-700 w-6"></th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Asset Code</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Asset Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Family</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Lifecycle Stage</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Completeness</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Missing</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-gray-400 py-12">
                    No assets found
                  </td>
                </tr>
              )}
              {items.map((item) => {
                const isExpanded = expandedIds.has(item.asset_id);
                return (
                  <>
                    <tr
                      key={item.asset_id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleExpand(item.asset_id)}
                    >
                      {/* Expand toggle */}
                      <td className="px-4 py-3 text-gray-400">
                        <span className="text-xs">{isExpanded ? "▼" : "▶"}</span>
                      </td>
                      {/* Asset code */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                          {item.asset_code}
                        </span>
                      </td>
                      {/* Asset name */}
                      <td className="px-4 py-3 font-medium text-gray-900">{item.asset_name}</td>
                      {/* Family */}
                      <td className="px-4 py-3 text-gray-600">{item.family_name ?? "—"}</td>
                      {/* Stage */}
                      <td className="px-4 py-3 text-gray-600">{item.lifecycle_stage_name ?? "—"}</td>
                      {/* Completeness score */}
                      <td className="px-4 py-3">
                        {item.total_rules === 0 ? (
                          <span className="text-xs text-gray-400 italic">No rules</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${scoreColor(item.completeness_score)}`}
                                style={{ width: `${item.completeness_score}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-700 w-10 text-right">
                              {item.completeness_score}%
                            </span>
                          </div>
                        )}
                      </td>
                      {/* Missing count */}
                      <td className="px-4 py-3">
                        {item.missing_count > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            {item.missing_count} missing
                          </span>
                        ) : item.total_rules > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Complete
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/assets/${item.asset_id}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Go to asset →
                        </Link>
                      </td>
                    </tr>

                    {/* Expanded rules row */}
                    {isExpanded && (
                      <tr key={`${item.asset_id}-expand`} className="bg-blue-50">
                        <td colSpan={8} className="px-8 py-4">
                          {item.total_rules === 0 ? (
                            <p className="text-sm text-gray-500 italic">
                              No document completeness rules apply to this asset at its current stage.
                            </p>
                          ) : (
                            <div>
                              <p className="text-xs font-semibold text-gray-600 mb-2">
                                Required documents for &ldquo;{item.lifecycle_stage_name}&rdquo; stage:
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {item.rules.map((rule) => (
                                  <div
                                    key={rule.rule_id}
                                    className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${
                                      rule.is_satisfied
                                        ? "bg-green-50 border border-green-200"
                                        : "bg-red-50 border border-red-200"
                                    }`}
                                  >
                                    <span className="text-lg leading-none">
                                      {rule.is_satisfied ? "✓" : "✗"}
                                    </span>
                                    <span
                                      className={
                                        rule.is_satisfied ? "text-green-800" : "text-red-800"
                                      }
                                    >
                                      {rule.document_type_name}
                                      {rule.is_mandatory && (
                                        <span className="ml-1 text-xs opacity-70">(required)</span>
                                      )}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-3 py-1 text-sm border rounded ${
                      p === page
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
