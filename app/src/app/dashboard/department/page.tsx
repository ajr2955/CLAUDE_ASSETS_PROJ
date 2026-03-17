"use client";

/**
 * US-069: Department dashboard UI
 * Route: /dashboard/department
 * Auto-scoped to user's responsible body.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ByStatus {
  status: string;
  count: number;
}

interface ByFamily {
  family_id: string;
  family_name: string;
  count: number;
}

interface ByStage {
  stage_id: string;
  stage_name: string;
  count: number;
}

interface WorkOrderSummary {
  by_status: ByStatus[];
  overdue_count: number;
}

interface WorkOrderByCategory {
  category_id: string;
  category_name: string;
  count: number;
}

interface ContractExpiring {
  id: string;
  contract_reference: string;
  counterparty_name: string;
  end_date: string;
  asset: { id: string; assetName: string; assetCode: string };
}

interface RecentEvent {
  id: string;
  event_type: string;
  category: string;
  asset_id: string;
  asset_name: string;
  asset_code: string;
  occurred_at: string;
  description: string | null;
  is_system_generated: boolean;
}

interface ConditionOverview {
  score_distribution: { score: number; count: number }[];
}

interface DeptDashboard {
  body: { id: string; name: string };
  total_assets: { total: number; by_status: ByStatus[]; by_family: ByFamily[] };
  assets_by_lifecycle_stage: ByStage[];
  assets_at_risk: number;
  work_orders_summary: WorkOrderSummary;
  work_orders_by_category: WorkOrderByCategory[];
  my_contracts_expiring: ContractExpiring[];
  assets_needing_inspection: number;
  condition_overview: ConditionOverview;
  recent_events: RecentEvent[];
}

// ─── Quick-action modal types ─────────────────────────────────────────────────

type QuickActionType = "work_order" | "inspection" | "document" | null;

interface AssetOption {
  id: string;
  assetCode: string;
  assetName: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_ORDER = [
  "open",
  "assigned",
  "in_progress",
  "pending_approval",
  "closed",
  "cancelled",
];

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  assigned: "Assigned",
  in_progress: "In Progress",
  pending_approval: "Pending Approval",
  closed: "Closed",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-gray-100 text-gray-700",
  assigned: "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  pending_approval: "bg-purple-100 text-purple-700",
  closed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const SCORE_COLORS: Record<number, string> = {
  5: "bg-green-500",
  4: "bg-lime-400",
  3: "bg-yellow-400",
  2: "bg-orange-400",
  1: "bg-red-500",
};

const CATEGORY_COLORS: Record<string, string> = {
  business: "bg-blue-100 text-blue-700",
  operational: "bg-green-100 text-green-700",
  governance: "bg-purple-100 text-purple-700",
};

function formatLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function daysUntil(dateStr: string | null) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color,
  href,
}: {
  label: string;
  value: number | string;
  sub?: string;
  color?: string;
  href?: string;
}) {
  const inner = (
    <div
      className={`rounded-lg border p-4 flex flex-col gap-1 ${color ?? "bg-white"} ${href ? "hover:shadow-md transition-shadow cursor-pointer" : ""}`}
    >
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-3xl font-bold">{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DepartmentDashboard() {
  const [data, setData] = useState<DeptDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quick action state
  const [quickAction, setQuickAction] = useState<QuickActionType>(null);
  const [assetQuery, setAssetQuery] = useState("");
  const [assetResults, setAssetResults] = useState<AssetOption[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<AssetOption | null>(null);
  const [assetDropOpen, setAssetDropOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/department");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to load dashboard");
        return;
      }
      setData(json.data);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Asset typeahead for quick actions
  useEffect(() => {
    if (!assetQuery.trim() || assetQuery.length < 2) {
      setAssetResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(
        `/api/assets?search=${encodeURIComponent(assetQuery)}&per_page=10`
      );
      const json = await res.json();
      if (res.ok) {
        setAssetResults(
          (json.data ?? []).map((a: Record<string, string>) => ({
            id: a.id,
            assetCode: a.asset_code,
            assetName: a.asset_name,
          }))
        );
      }
    }, 300);
    return () => clearTimeout(t);
  }, [assetQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading dashboard…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          {error}
        </div>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  // ── Derived values ──────────────────────────────────────────────────────────

  const totalWOs = data.work_orders_summary.by_status.reduce(
    (s, r) => s + r.count,
    0
  );
  const overdueWOs = data.work_orders_summary.overdue_count;
  const expiringContracts = data.my_contracts_expiring.length;

  // Ordered status counts for funnel
  const woByStatusMap = new Map(
    data.work_orders_summary.by_status.map((r) => [r.status, r.count])
  );

  // Score distribution max for bar scaling
  const scoreMax = Math.max(
    1,
    ...data.condition_overview.score_distribution.map((r) => r.count)
  );

  // ── Quick action helpers ────────────────────────────────────────────────────

  function openQuickAction(type: QuickActionType) {
    setQuickAction(type);
    setAssetQuery("");
    setAssetResults([]);
    setSelectedAsset(null);
    setAssetDropOpen(false);
  }

  function closeQuickAction() {
    setQuickAction(null);
  }

  function quickActionTarget() {
    if (!selectedAsset) return "";
    if (quickAction === "work_order") return `/assets/${selectedAsset.id}#work-orders`;
    if (quickAction === "inspection") return `/assets/${selectedAsset.id}#condition`;
    if (quickAction === "document") return `/assets/${selectedAsset.id}#documents`;
    return `/assets/${selectedAsset.id}`;
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Department Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">{data.body.name}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard"
            className="px-3 py-1.5 text-sm border rounded text-gray-600 hover:bg-gray-50"
          >
            Executive View
          </Link>
          <button
            onClick={fetchData}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="My Assets"
          value={data.total_assets.total}
          href={`/assets?responsible_body_id=${data.body.id}`}
          color="bg-white border"
        />
        <StatCard
          label="Overdue Work Orders"
          value={overdueWOs}
          sub={`${totalWOs} total open`}
          color={overdueWOs > 0 ? "bg-red-50 border border-red-200" : "bg-white border"}
          href="/work-orders?overdue=true"
        />
        <StatCard
          label="Assets Needing Inspection"
          value={data.assets_needing_inspection}
          sub="No condition record in 12+ months"
          color={data.assets_needing_inspection > 0 ? "bg-amber-50 border border-amber-200" : "bg-white border"}
        />
        <StatCard
          label="Expiring Contracts"
          value={expiringContracts}
          sub="Within 90 days"
          color={expiringContracts > 0 ? "bg-amber-50 border border-amber-200" : "bg-white border"}
        />
      </div>

      {/* Second row: At Risk */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Assets at Risk"
          value={data.assets_at_risk}
          sub="High or Critical risk band"
          color={data.assets_at_risk > 0 ? "bg-orange-50 border border-orange-200" : "bg-white border"}
          href="/risk-registry"
        />
        {data.total_assets.by_family.map((f) => (
          <StatCard
            key={f.family_id}
            label={f.family_name}
            value={f.count}
            color="bg-white border"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Work Order Pipeline */}
        <div className="bg-white border rounded-lg p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Work Order Pipeline
          </h2>
          <div className="flex items-end gap-1">
            {STATUS_ORDER.filter((s) => s !== "cancelled").map((status) => {
              const count = woByStatusMap.get(status) ?? 0;
              const maxCount = Math.max(
                1,
                ...STATUS_ORDER.map((s) => woByStatusMap.get(s) ?? 0)
              );
              const heightPct = Math.max(8, Math.round((count / maxCount) * 100));
              return (
                <div
                  key={status}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <span className="text-sm font-semibold text-gray-700">{count}</span>
                  <div
                    className={`w-full rounded-t transition-all ${STATUS_COLORS[status]} flex items-center justify-center`}
                    style={{ height: `${heightPct}px`, minHeight: "8px" }}
                  />
                  <span className="text-xs text-gray-500 text-center leading-tight">
                    {STATUS_LABELS[status]}
                  </span>
                </div>
              );
            })}
          </div>
          {overdueWOs > 0 && (
            <div className="mt-3 text-sm text-red-600 font-medium">
              ⚠ {overdueWOs} overdue work order{overdueWOs !== 1 ? "s" : ""}
            </div>
          )}
          <div className="mt-3">
            <Link
              href="/work-orders"
              className="text-sm text-blue-600 hover:underline"
            >
              View all work orders →
            </Link>
          </div>
        </div>

        {/* Condition Score Distribution */}
        <div className="bg-white border rounded-lg p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Asset Condition Overview
          </h2>
          {data.condition_overview.score_distribution.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No condition records in last 12 months.</p>
          ) : (
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((score) => {
                const entry = data.condition_overview.score_distribution.find(
                  (r) => r.score === score
                );
                const count = entry?.count ?? 0;
                const widthPct = Math.round((count / scoreMax) * 100);
                const labels: Record<number, string> = {
                  5: "Excellent",
                  4: "Good",
                  3: "Fair",
                  2: "Poor",
                  1: "Critical",
                };
                return (
                  <div key={score} className="flex items-center gap-3">
                    <span className="text-xs w-16 text-gray-500 shrink-0">
                      {score} – {labels[score]}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded h-5 relative">
                      <div
                        className={`h-5 rounded ${SCORE_COLORS[score]}`}
                        style={{ width: `${widthPct}%`, minWidth: count > 0 ? "4px" : "0" }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-700 w-6 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-3 text-xs text-gray-400">
            Based on condition records from the last 12 months.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Work Orders by Category */}
        <div className="bg-white border rounded-lg p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Work Orders by Category
          </h2>
          {data.work_orders_by_category.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No open work orders.</p>
          ) : (
            <div className="space-y-2">
              {data.work_orders_by_category
                .sort((a, b) => b.count - a.count)
                .map((cat) => {
                  const maxCat = Math.max(
                    1,
                    ...data.work_orders_by_category.map((c) => c.count)
                  );
                  return (
                    <div key={cat.category_id} className="flex items-center gap-3">
                      <span className="text-xs w-36 text-gray-600 shrink-0 truncate">
                        {formatLabel(cat.category_name)}
                      </span>
                      <div className="flex-1 bg-gray-100 rounded h-4">
                        <div
                          className="h-4 rounded bg-blue-400"
                          style={{
                            width: `${Math.round((cat.count / maxCat) * 100)}%`,
                            minWidth: "4px",
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-700 w-5 text-right">
                        {cat.count}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Contracts Expiring */}
        <div className="bg-white border rounded-lg p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Contracts Expiring (90 days)
          </h2>
          {data.my_contracts_expiring.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No contracts expiring soon.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {data.my_contracts_expiring.map((c) => {
                const days = daysUntil(c.end_date);
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between text-sm border-b pb-2 last:border-0"
                  >
                    <div>
                      <span className="font-mono text-xs text-gray-500">
                        {c.contract_reference}
                      </span>
                      <div className="text-gray-800">{c.counterparty_name}</div>
                      <Link
                        href={`/assets/${c.asset.id}`}
                        className="text-xs text-blue-500 hover:underline"
                      >
                        {c.asset.assetCode} — {c.asset.assetName}
                      </Link>
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded ${
                        days !== null && days <= 30
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {days !== null ? `${days}d` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Events Feed */}
      <div className="bg-white border rounded-lg p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          Recent Events
        </h2>
        {data.recent_events.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No recent events.</p>
        ) : (
          <div className="space-y-2">
            {data.recent_events.map((ev) => (
              <div
                key={ev.id}
                className="flex items-start gap-3 text-sm border-b pb-3 last:border-0"
              >
                <div className="shrink-0 mt-0.5">
                  {ev.is_system_generated ? (
                    <span title="System generated" className="text-base">🤖</span>
                  ) : (
                    <span className="text-base">📌</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-800">{formatLabel(ev.event_type)}</span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${CATEGORY_COLORS[ev.category] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {ev.category}
                    </span>
                    <span className="text-xs text-gray-400">{timeAgo(ev.occurred_at)}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    <Link
                      href={`/assets/${ev.asset_id}`}
                      className="text-blue-500 hover:underline"
                    >
                      {ev.asset_code} — {ev.asset_name}
                    </Link>
                  </div>
                  {ev.description && (
                    <div className="text-xs text-gray-600 mt-0.5 truncate">{ev.description}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white border rounded-lg p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => openQuickAction("work_order")}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            + Create Work Order
          </button>
          <button
            onClick={() => openQuickAction("inspection")}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
          >
            + Record Inspection
          </button>
          <button
            onClick={() => openQuickAction("document")}
            className="px-4 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
          >
            + Upload Document
          </button>
        </div>
      </div>

      {/* Quick Action Modal */}
      {quickAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {quickAction === "work_order" && "Create Work Order"}
              {quickAction === "inspection" && "Record Inspection"}
              {quickAction === "document" && "Upload Document"}
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              Search for an asset to proceed:
            </p>

            {/* Asset Typeahead */}
            <div className="relative">
              <input
                type="text"
                value={selectedAsset ? `${selectedAsset.assetCode} — ${selectedAsset.assetName}` : assetQuery}
                onChange={(e) => {
                  setSelectedAsset(null);
                  setAssetQuery(e.target.value);
                  setAssetDropOpen(true);
                }}
                onFocus={() => {
                  if (!selectedAsset) setAssetDropOpen(true);
                }}
                onBlur={() => setTimeout(() => setAssetDropOpen(false), 200)}
                placeholder="Search by asset name or code…"
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              {assetDropOpen && assetResults.length > 0 && (
                <div className="absolute z-10 w-full bg-white border rounded shadow-lg mt-1 max-h-48 overflow-y-auto">
                  {assetResults.map((a) => (
                    <div
                      key={a.id}
                      onMouseDown={() => {
                        setSelectedAsset(a);
                        setAssetDropOpen(false);
                      }}
                      className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer"
                    >
                      <span className="font-mono text-xs text-gray-500 mr-2">{a.assetCode}</span>
                      {a.assetName}
                    </div>
                  ))}
                </div>
              )}
              {assetDropOpen && assetQuery.length >= 2 && assetResults.length === 0 && (
                <div className="absolute z-10 w-full bg-white border rounded shadow-lg mt-1 px-3 py-2 text-sm text-gray-400">
                  No assets found
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={closeQuickAction}
                className="px-4 py-2 text-sm border rounded text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              {selectedAsset && (
                <Link
                  href={quickActionTarget()}
                  onClick={closeQuickAction}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Go to Asset →
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
