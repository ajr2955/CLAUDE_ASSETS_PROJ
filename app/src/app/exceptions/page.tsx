"use client";

/**
 * US-070: Exception management UI
 * Route: /exceptions
 * Visible to: all authenticated roles except contractor
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type ExceptionType =
  | "contract_expiring_soon"
  | "contract_expired"
  | "missing_mandatory_document"
  | "safety_hazard"
  | "critical_condition"
  | "overdue_work_order"
  | "budget_overrun"
  | "overdue_developer_obligation"
  | "placeholder_body_assigned"
  | "no_condition_record_in_1_year"
  | "handover_pending_over_30_days";

type ExceptionSeverity = "critical" | "high" | "medium";

interface AssetException {
  asset_id: string;
  asset_name: string;
  asset_code: string;
  asset_family_id: string;
  asset_family_name: string;
  responsible_body_id: string | null;
  exception_type: ExceptionType;
  severity: ExceptionSeverity;
  description: string;
  detected_at: string;
}

interface AssetFamily {
  id: string;
  name: string;
}

interface ResponsibleBody {
  id: string;
  name: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EXCEPTION_TYPE_LABELS: Record<ExceptionType, string> = {
  contract_expiring_soon: "Contract Expiring Soon",
  contract_expired: "Contract Expired",
  missing_mandatory_document: "Missing Mandatory Document",
  safety_hazard: "Safety Hazard",
  critical_condition: "Critical Condition",
  overdue_work_order: "Overdue Work Order",
  budget_overrun: "Budget Overrun",
  overdue_developer_obligation: "Overdue Developer Obligation",
  placeholder_body_assigned: "Placeholder Body Assigned",
  no_condition_record_in_1_year: "No Condition Record (1yr)",
  handover_pending_over_30_days: "Handover Pending >30 Days",
};

const SEVERITY_COLORS: Record<ExceptionSeverity, { bg: string; text: string; border: string; badge: string }> = {
  critical: {
    bg: "bg-red-50",
    text: "text-red-800",
    border: "border-red-200",
    badge: "bg-red-100 text-red-800",
  },
  high: {
    bg: "bg-orange-50",
    text: "text-orange-800",
    border: "border-orange-200",
    badge: "bg-orange-100 text-orange-800",
  },
  medium: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-800",
  },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ExceptionsPage() {
  const [exceptions, setExceptions] = useState<AssetException[]>([]);
  const [dismissed, setDismissed] = useState<AssetException[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterFamily, setFilterFamily] = useState("");
  const [filterBody, setFilterBody] = useState("");

  // Reference data
  const [families, setFamilies] = useState<AssetFamily[]>([]);
  const [bodies, setBodies] = useState<ResponsibleBody[]>([]);

  // Tab: "active" | "resolved"
  const [activeTab, setActiveTab] = useState<"active" | "resolved">("active");

  // Dismissing
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  // User role (to show/hide dismiss button)
  const [userRole, setUserRole] = useState<string>("department_user");

  const fetchUserRole = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: {},
      });
      if (res.ok) {
        const json = await res.json();
        setUserRole(json.data?.role ?? "department_user");
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchReferenceData = useCallback(async () => {
    const [famRes, bodyRes] = await Promise.all([
      fetch("/api/asset-families"),
      fetch("/api/responsible-bodies"),
    ]);
    if (famRes.ok) {
      const json = await famRes.json();
      setFamilies(json.data ?? []);
    }
    if (bodyRes.ok) {
      const json = await bodyRes.json();
      setBodies(json.data ?? []);
    }
  }, []);

  const fetchExceptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterSeverity) params.set("severity", filterSeverity);
      if (filterType) params.set("exception_type", filterType);
      if (filterFamily) params.set("asset_family_id", filterFamily);
      if (filterBody) params.set("responsible_body_id", filterBody);

      const res = await fetch(`/api/exceptions?${params.toString()}`, {
        headers: {},
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? "Failed to load exceptions");
        return;
      }
      const json = await res.json();
      setExceptions(json.data ?? []);
    } catch {
      setError("Network error loading exceptions");
    } finally {
      setLoading(false);
    }
  }, [filterSeverity, filterType, filterFamily, filterBody]);

  useEffect(() => {
    fetchUserRole();
    fetchReferenceData();
  }, [fetchUserRole, fetchReferenceData]);

  useEffect(() => {
    fetchExceptions();
  }, [fetchExceptions]);

  const handleDismiss = useCallback(
    async (ex: AssetException) => {
      const key = `${ex.asset_id}:${ex.exception_type}`;
      setDismissingId(key);
      try {
        // Create a dismissal event on the asset
        await fetch("/api/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            asset_id: ex.asset_id,
            event_type_name: "status_changed",
            description: `Exception dismissed: ${EXCEPTION_TYPE_LABELS[ex.exception_type]}`,
          }),
        });
        // Move to dismissed list
        setDismissed((prev) => [...prev, { ...ex, detected_at: new Date().toISOString() }]);
        setExceptions((prev) =>
          prev.filter((e) => !(e.asset_id === ex.asset_id && e.exception_type === ex.exception_type))
        );
      } finally {
        setDismissingId(null);
      }
    },
    []
  );

  const canDismiss = ["asset_manager", "admin"].includes(userRole);

  // Group by severity
  const grouped = (list: AssetException[]) => {
    const groups: Record<ExceptionSeverity, AssetException[]> = {
      critical: [],
      high: [],
      medium: [],
    };
    for (const ex of list) {
      groups[ex.severity].push(ex);
    }
    return groups;
  };

  const activeGroups = grouped(exceptions);
  const resolvedGroups = grouped(dismissed);
  const currentGroups = activeTab === "active" ? activeGroups : resolvedGroups;
  const totalCriticalHigh = activeGroups.critical.length + activeGroups.high.length;

  const allExceptionTypes = Object.entries(EXCEPTION_TYPE_LABELS);
  const severities: ExceptionSeverity[] = ["critical", "high", "medium"];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-500 hover:text-gray-700 text-sm">
              ← Home
            </Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-xl font-semibold text-gray-900">
              Exceptions
              {totalCriticalHigh > 0 && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  {totalCriticalHigh}
                </span>
              )}
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("active")}
              className={`px-4 py-1.5 rounded text-sm font-medium border ${
                activeTab === "active"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              Active
              {exceptions.length > 0 && (
                <span className="ml-1.5 text-xs opacity-75">({exceptions.length})</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("resolved")}
              className={`px-4 py-1.5 rounded text-sm font-medium border ${
                activeTab === "resolved"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              Resolved
              {dismissed.length > 0 && (
                <span className="ml-1.5 text-xs opacity-75">({dismissed.length})</span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6">
        {/* Filter Panel */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Filters</h2>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Severity</label>
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              >
                <option value="">All severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Exception Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              >
                <option value="">All types</option>
                {allExceptionTypes.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Asset Family</label>
              <select
                value={filterFamily}
                onChange={(e) => setFilterFamily(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              >
                <option value="">All families</option>
                {families.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Responsible Body</label>
              <select
                value={filterBody}
                onChange={(e) => setFilterBody(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              >
                <option value="">All bodies</option>
                {bodies.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                setFilterSeverity("");
                setFilterType("");
                setFilterFamily("");
                setFilterBody("");
              }}
              className="w-full text-xs text-gray-500 hover:text-gray-700 underline text-left"
            >
              Clear filters
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {loading && (
            <div className="text-center py-12 text-gray-500">Loading exceptions...</div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-4">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              {severities.map((severity) => {
                const items = currentGroups[severity];
                if (items.length === 0) return null;
                const colors = SEVERITY_COLORS[severity];
                return (
                  <div key={severity} className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <h2 className={`text-sm font-bold uppercase tracking-wide ${colors.text}`}>
                        {severity.charAt(0).toUpperCase() + severity.slice(1)}
                      </h2>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>
                        {items.length}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {items.map((ex) => {
                        const key = `${ex.asset_id}:${ex.exception_type}`;
                        const isDismissing = dismissingId === key;
                        return (
                          <div
                            key={key}
                            className={`rounded-lg border p-4 ${colors.bg} ${colors.border}`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  {/* Asset code */}
                                  <code className="text-xs font-mono bg-white border border-gray-200 px-1.5 py-0.5 rounded text-gray-700">
                                    {ex.asset_code}
                                  </code>
                                  {/* Family badge */}
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 font-medium">
                                    {ex.asset_family_name}
                                  </span>
                                  {/* Exception type badge */}
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>
                                    {EXCEPTION_TYPE_LABELS[ex.exception_type]}
                                  </span>
                                </div>
                                {/* Asset name as link */}
                                <Link
                                  href={`/assets/${ex.asset_id}`}
                                  className={`text-base font-semibold hover:underline ${colors.text}`}
                                >
                                  {ex.asset_name}
                                </Link>
                                <p className="text-sm mt-1 text-gray-700">{ex.description}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Detected {formatDate(ex.detected_at)}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Link
                                  href={`/assets/${ex.asset_id}`}
                                  className="text-xs px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                                >
                                  View Asset →
                                </Link>
                                {canDismiss && activeTab === "active" && (
                                  <button
                                    onClick={() => handleDismiss(ex)}
                                    disabled={isDismissing}
                                    className="text-xs px-3 py-1.5 rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                  >
                                    {isDismissing ? "Dismissing..." : "Dismiss"}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Empty state */}
              {severities.every((s) => currentGroups[s].length === 0) && (
                <div className="text-center py-16 text-gray-500">
                  <div className="text-4xl mb-3">✓</div>
                  <p className="text-lg font-medium text-gray-700">
                    {activeTab === "active" ? "No active exceptions" : "No resolved exceptions"}
                  </p>
                  <p className="text-sm mt-1">
                    {activeTab === "active"
                      ? "All assets are within expected parameters."
                      : "Dismissed exceptions will appear here."}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
