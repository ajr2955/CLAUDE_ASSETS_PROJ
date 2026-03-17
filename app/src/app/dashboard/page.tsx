"use client";

/**
 * US-068: Executive KPI dashboard UI
 * Route: /dashboard
 * Visible to: admin, asset_manager, operations_manager
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TotalAssets {
  by_status: { status: string; count: number }[];
  by_family: { family_id: string; family_name: string; count: number }[];
  total: number;
}

interface AssetsByStage {
  stage_id: string;
  stage_name: string;
  family_id: string;
  family_name: string;
  count: number;
}

interface OpenExceptions {
  total: number;
  by_type: { exception_type: string; severity: string; count: number }[];
}

interface DevObligationsSummary {
  total: number;
  delivered: number;
  overdue: number;
  placeholder_receiving_body: number;
}

interface PlaceholderBodySummary {
  total_assets_on_placeholder_bodies: number;
  placeholder_bodies: { id: string; name: string; resolution_note: string | null; asset_count: number }[];
}

interface DashboardData {
  total_assets: TotalAssets;
  assets_by_lifecycle_stage: AssetsByStage[];
  assets_at_risk: { count: number };
  open_exceptions: OpenExceptions;
  developer_obligations_summary: DevObligationsSummary;
  planning_entities_summary: { total: number; converted: number; overdue: number };
  budget_variance_summary: { assets_with_variance_events: number; total_variance_amount: number; fiscal_year: number };
  maintenance_backlog_summary: { total_open: number; total_overdue: number; estimated_cost_total: number };
  contracts_expiring_summary: { within_30_days: number; within_60_days: number; within_90_days: number };
  placeholder_bodies_summary: PlaceholderBodySummary;
}

interface AssetException {
  asset_id: string;
  asset_name: string;
  asset_code: string;
  asset_family_name: string;
  exception_type: string;
  severity: string;
  description: string;
  detected_at: string;
}

interface OverdueObligation {
  id: string;
  developerName: string;
  relatedProjectName: string;
  committedDeliveryDate: string | null;
  promisedAssetType: { name: string } | null;
  promisedAssetFamily: { name: string } | null;
  status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNumber(n: number) {
  return n.toLocaleString();
}

function fmtCurrency(n: number) {
  if (n >= 1_000_000) return `₪${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₪${(n / 1_000).toFixed(0)}K`;
  return `₪${n.toFixed(0)}`;
}

function overdueDays(dateStr: string | null): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

function severityColor(s: string) {
  if (s === "critical") return "bg-red-100 text-red-800 border-red-300";
  if (s === "high") return "bg-orange-100 text-orange-800 border-orange-300";
  return "bg-amber-100 text-amber-800 border-amber-300";
}

function exceptionTypeLabel(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  sub,
  color,
  href,
}: {
  title: string;
  value: string | number;
  sub?: string;
  color?: "red" | "amber" | "blue" | "green" | "gray";
  href?: string;
}) {
  const colorCls =
    color === "red"
      ? "border-red-400 bg-red-50"
      : color === "amber"
      ? "border-amber-400 bg-amber-50"
      : color === "blue"
      ? "border-blue-400 bg-blue-50"
      : color === "green"
      ? "border-green-400 bg-green-50"
      : "border-gray-200 bg-white";

  const valueCls =
    color === "red"
      ? "text-red-700"
      : color === "amber"
      ? "text-amber-700"
      : color === "blue"
      ? "text-blue-700"
      : color === "green"
      ? "text-green-700"
      : "text-gray-900";

  const inner = (
    <div className={`rounded-lg border-2 ${colorCls} p-4 flex flex-col gap-1`}>
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</div>
      <div className={`text-3xl font-bold ${valueCls}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );

  if (href) {
    return <Link href={href}>{inner}</Link>;
  }
  return inner;
}

// ─── Horizontal Bar Chart ─────────────────────────────────────────────────────

function HBarChart({ data }: { data: { label: string; value: number; color?: string }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const COLORS = [
    "bg-blue-500",
    "bg-violet-500",
    "bg-green-500",
    "bg-amber-500",
    "bg-red-500",
    "bg-pink-500",
    "bg-cyan-500",
    "bg-orange-500",
    "bg-teal-500",
    "bg-indigo-500",
  ];
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={d.label} className="flex items-center gap-2 text-sm">
          <div className="w-36 text-right text-gray-600 truncate shrink-0">{d.label}</div>
          <div className="flex-1 bg-gray-100 rounded-full h-5 relative">
            <div
              className={`${d.color ?? COLORS[i % COLORS.length]} rounded-full h-5`}
              style={{ width: `${Math.max(4, (d.value / max) * 100)}%` }}
            />
          </div>
          <div className="w-10 text-right font-medium text-gray-700 shrink-0">{d.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ExecutiveDashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [exceptions, setExceptions] = useState<AssetException[]>([]);
  const [overdueObligations, setOverdueObligations] = useState<OverdueObligation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, excRes, obligRes] = await Promise.all([
        fetch("/api/dashboard/executive"),
        fetch("/api/exceptions?severity=critical&per_page=10"),
        fetch("/api/developer-obligations?overdue=true&per_page=10"),
      ]);

      if (!dashRes.ok) {
        const j = await dashRes.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed to load dashboard data");
      }

      const dashJson = await dashRes.json();
      setDashboard(dashJson.data);

      if (excRes.ok) {
        const excJson = await excRes.json();
        const excData: AssetException[] = excJson.data ?? [];
        // Also fetch high severity to fill up to 10
        if (excData.length < 10) {
          const excHighRes = await fetch("/api/exceptions?severity=high&per_page=10");
          if (excHighRes.ok) {
            const excHighJson = await excHighRes.json();
            const combined = [...excData, ...(excHighJson.data ?? [])];
            const seen = new Set<string>();
            const deduped = combined.filter((e) => {
              const key = `${e.asset_id}:${e.exception_type}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            setExceptions(deduped.slice(0, 10));
          } else {
            setExceptions(excData.slice(0, 10));
          }
        } else {
          setExceptions(excData.slice(0, 10));
        }
      }

      if (obligRes.ok) {
        const obligJson = await obligRes.json();
        setOverdueObligations(obligJson.data ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-400">Loading dashboard…</div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-300 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  const d = dashboard;

  // ── Compute lifecycle stage chart data ──
  // Group by stage, sum counts across families
  const stageCountMap: Record<string, { name: string; count: number }> = {};
  for (const row of d.assets_by_lifecycle_stage) {
    if (!stageCountMap[row.stage_id]) {
      stageCountMap[row.stage_id] = { name: row.stage_name, count: 0 };
    }
    stageCountMap[row.stage_id].count += row.count;
  }
  const stageChartData = Object.values(stageCountMap)
    .sort((a, b) => b.count - a.count)
    .map((s) => ({ label: s.name, value: s.count }));

  // ── Compute budget variance chart data ──
  // We'll show the summary from dashboard; for the stacked bar, use budget_variance_summary
  const bv = d.budget_variance_summary;

  const activeOblTotal =
    d.developer_obligations_summary.total - d.developer_obligations_summary.delivered;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-8 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Executive Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">Municipal Asset Portfolio Overview</p>
          </div>
          <button
            onClick={fetchAll}
            className="text-sm text-blue-600 hover:underline"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-8">
        {/* ── Summary Stat Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard
            title="Total Assets"
            value={fmtNumber(d.total_assets.total)}
            sub={`${d.total_assets.by_status.length} statuses`}
            color="blue"
            href="/assets"
          />
          <StatCard
            title="Assets at Risk"
            value={fmtNumber(d.assets_at_risk.count)}
            sub="High or Critical risk band"
            color={d.assets_at_risk.count > 0 ? "red" : "green"}
            href="/risk-registry"
          />
          <StatCard
            title="Open Exceptions"
            value={fmtNumber(d.open_exceptions.total)}
            sub={`${d.open_exceptions.by_type.length} exception types`}
            color={d.open_exceptions.total > 0 ? "amber" : "green"}
            href="/exceptions"
          />
          <StatCard
            title="Active Dev Obligations"
            value={fmtNumber(activeOblTotal)}
            sub={`${d.developer_obligations_summary.overdue} overdue`}
            color={d.developer_obligations_summary.overdue > 0 ? "amber" : "gray"}
            href="/developer-obligations"
          />
          <StatCard
            title="Planning In Progress"
            value={fmtNumber(
              d.planning_entities_summary.total - d.planning_entities_summary.converted
            )}
            sub={`${d.planning_entities_summary.overdue} overdue`}
            color={d.planning_entities_summary.overdue > 0 ? "amber" : "gray"}
            href="/planning"
          />
        </div>

        {/* ── Charts Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lifecycle Stage Chart */}
          <div className="bg-white rounded-lg border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Assets by Lifecycle Stage</h2>
              <Link href="/assets" className="text-xs text-blue-600 hover:underline">
                View all →
              </Link>
            </div>
            {stageChartData.length > 0 ? (
              <HBarChart data={stageChartData} />
            ) : (
              <p className="text-sm text-gray-400">No data available</p>
            )}
          </div>

          {/* Budget Variance Overview */}
          <div className="bg-white rounded-lg border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Budget Variance Overview</h2>
              <span className="text-xs text-gray-400">FY {bv.fiscal_year}</span>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-700">
                    {fmtNumber(bv.assets_with_variance_events)}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">Assets with Overruns</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-orange-700">
                    {fmtCurrency(Math.abs(bv.total_variance_amount))}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">Total Variance Amount</div>
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Maintenance backlog: {fmtNumber(d.maintenance_backlog_summary.total_open)} open work orders
                ({fmtNumber(d.maintenance_backlog_summary.total_overdue)} overdue)
                {d.maintenance_backlog_summary.estimated_cost_total > 0 && (
                  <> — est. {fmtCurrency(d.maintenance_backlog_summary.estimated_cost_total)}</>
                )}
              </div>
              <div className="border-t pt-3 space-y-1.5">
                <div className="text-xs font-medium text-gray-600">Contracts Expiring</div>
                {[
                  { label: "Within 30 days", val: d.contracts_expiring_summary.within_30_days, color: "text-red-600" },
                  { label: "Within 60 days", val: d.contracts_expiring_summary.within_60_days, color: "text-orange-600" },
                  { label: "Within 90 days", val: d.contracts_expiring_summary.within_90_days, color: "text-amber-600" },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{row.label}</span>
                    <Link href="/assets" className={`font-semibold ${row.color} hover:underline`}>
                      {fmtNumber(row.val)}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Panels Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Exceptions Panel */}
          <div className="lg:col-span-1 bg-white rounded-lg border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">
                Top Exceptions{" "}
                {d.open_exceptions.total > 0 && (
                  <span className="ml-1 text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5">
                    {fmtNumber(d.open_exceptions.total)}
                  </span>
                )}
              </h2>
              <Link href="/exceptions" className="text-xs text-blue-600 hover:underline">
                View all →
              </Link>
            </div>
            {exceptions.length === 0 ? (
              <div className="text-sm text-gray-400 py-4 text-center">No exceptions detected</div>
            ) : (
              <div className="space-y-2">
                {exceptions.map((ex, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border p-3 ${severityColor(ex.severity)}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">{exceptionTypeLabel(ex.exception_type)}</div>
                        <Link
                          href={`/assets/${ex.asset_id}`}
                          className="text-xs hover:underline font-medium"
                        >
                          {ex.asset_name} ({ex.asset_code})
                        </Link>
                        <div className="text-xs opacity-75">{ex.asset_family_name}</div>
                      </div>
                      <span className="text-xs px-1.5 py-0.5 rounded font-semibold uppercase shrink-0">
                        {ex.severity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Placeholder Bodies Panel */}
          <div className="bg-white rounded-lg border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">
                Placeholder Bodies{" "}
                {d.placeholder_bodies_summary.total_assets_on_placeholder_bodies > 0 && (
                  <span className="ml-1 text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
                    {fmtNumber(d.placeholder_bodies_summary.total_assets_on_placeholder_bodies)} assets
                  </span>
                )}
              </h2>
              <Link href="/admin/responsible-bodies" className="text-xs text-blue-600 hover:underline">
                Manage →
              </Link>
            </div>
            {d.placeholder_bodies_summary.placeholder_bodies.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No placeholder bodies</p>
            ) : (
              <div className="space-y-3">
                {d.placeholder_bodies_summary.placeholder_bodies.map((b) => (
                  <div key={b.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-amber-900">{b.name}</div>
                      <span className="text-xs bg-amber-200 text-amber-800 rounded-full px-2 py-0.5 font-semibold">
                        {b.asset_count} assets
                      </span>
                    </div>
                    {b.resolution_note && (
                      <div className="text-xs text-amber-700 mt-1">{b.resolution_note}</div>
                    )}
                    <div className="text-xs text-amber-600 mt-1 font-medium">
                      ⚠ Open Decision — Organizational ownership pending
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Developer Obligations Panel */}
          <div className="bg-white rounded-lg border p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">
                Overdue Obligations{" "}
                {d.developer_obligations_summary.overdue > 0 && (
                  <span className="ml-1 text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5">
                    {fmtNumber(d.developer_obligations_summary.overdue)}
                  </span>
                )}
              </h2>
              <Link
                href="/developer-obligations?overdue=true"
                className="text-xs text-blue-600 hover:underline"
              >
                View all →
              </Link>
            </div>
            {overdueObligations.length === 0 ? (
              <div className="text-sm text-gray-400 py-4 text-center">No overdue obligations</div>
            ) : (
              <div className="space-y-2">
                {overdueObligations.slice(0, 8).map((ob) => {
                  const days = overdueDays(ob.committedDeliveryDate);
                  return (
                    <div key={ob.id} className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-red-900 truncate">
                            {ob.developerName}
                          </div>
                          <div className="text-xs text-red-700 truncate">
                            {ob.promisedAssetType?.name ?? "Unknown type"} •{" "}
                            {ob.promisedAssetFamily?.name ?? "Unknown family"}
                          </div>
                        </div>
                        {days > 0 && (
                          <span className="text-xs bg-red-200 text-red-800 rounded px-1.5 py-0.5 shrink-0 font-semibold">
                            {days}d overdue
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/developer-obligations/${ob.id}`}
                        className="text-xs text-red-600 hover:underline mt-1 inline-block"
                      >
                        View obligation →
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
