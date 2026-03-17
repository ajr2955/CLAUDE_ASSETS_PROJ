"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";

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
  displayOrder: number;
}

interface ResponsibleBody {
  id: string;
  name: string;
}

interface Asset {
  id: string;
  assetCode: string;
  assetName: string;
  currentStatus: string;
  ownershipModel: string | null;
  isPlaceholderBody: boolean;
  assetFamily: { id: string; name: string } | null;
  assetType: { id: string; name: string } | null;
  currentLifecycleStage: { id: string; name: string } | null;
  responsibleBody: { id: string; name: string } | null;
  _lastEventDate?: string | null;
}

interface ApiResponse<T> {
  data: T;
  error: string | null;
  meta?: { page: number; per_page: number; total: number } | null;
}

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "in_formation", label: "In Formation" },
  { value: "in_construction", label: "In Construction" },
  { value: "decommissioned", label: "Decommissioned" },
  { value: "disposed", label: "Disposed" },
];

const OWNERSHIP_OPTIONS = [
  { value: "owned", label: "Owned" },
  { value: "leased_in", label: "Leased In" },
  { value: "leased_out", label: "Leased Out" },
  { value: "allocated", label: "Allocated" },
  { value: "developer_obligation", label: "Developer Obligation" },
  { value: "partnership", label: "Partnership" },
];

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-600",
  in_formation: "bg-blue-100 text-blue-800",
  in_construction: "bg-yellow-100 text-yellow-800",
  decommissioned: "bg-orange-100 text-orange-800",
  disposed: "bg-red-100 text-red-800",
};

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

type SortField = "assetCode" | "assetName" | "currentStatus" | "currentLifecycleStage";
type SortDir = "asc" | "desc";

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 25;

  // Filter state
  const [families, setFamilies] = useState<AssetFamily[]>([]);
  const [allTypes, setAllTypes] = useState<AssetType[]>([]);
  const [stages, setStages] = useState<LifecycleStage[]>([]);
  const [bodies, setBodies] = useState<ResponsibleBody[]>([]);

  const [selectedFamilies, setSelectedFamilies] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [selectedBodies, setSelectedBodies] = useState<string[]>([]);
  const [selectedOwnership, setSelectedOwnership] = useState<string[]>([]);
  const [placeholderOnly, setPlaceholderOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [sortField, setSortField] = useState<SortField>("assetCode");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [search]);

  // Load filter options
  useEffect(() => {
    Promise.all([
      fetch("/api/asset-families").then((r) => r.json()),
      fetch("/api/asset-types").then((r) => r.json()),
      fetch("/api/lifecycle-stages").then((r) => r.json()),
      fetch("/api/responsible-bodies").then((r) => r.json()),
    ]).then(([fam, typ, stg, bod]) => {
      setFamilies((fam as ApiResponse<AssetFamily[]>).data ?? []);
      setAllTypes((typ as ApiResponse<AssetType[]>).data ?? []);
      setStages((stg as ApiResponse<LifecycleStage[]>).data ?? []);
      setBodies((bod as ApiResponse<ResponsibleBody[]>).data ?? []);
    });
  }, []);

  // Available types filtered by selected families
  const availableTypes =
    selectedFamilies.length > 0
      ? allTypes.filter((t) => selectedFamilies.includes(t.assetFamilyId))
      : allTypes;

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("per_page", String(perPage));
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (selectedFamilies.length === 1) params.set("family_id", selectedFamilies[0]);
      if (selectedTypes.length === 1) params.set("type_id", selectedTypes[0]);
      if (selectedStatuses.length === 1) params.set("status", selectedStatuses[0]);
      if (selectedStages.length === 1) params.set("lifecycle_stage_id", selectedStages[0]);
      if (selectedBodies.length === 1) params.set("responsible_body_id", selectedBodies[0]);
      if (selectedOwnership.length === 1) params.set("ownership_model", selectedOwnership[0]);
      if (placeholderOnly) params.set("is_placeholder_body", "true");

      const res = await fetch(`/api/assets?${params.toString()}`);
      const json: ApiResponse<Asset[]> = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setAssets(json.data ?? []);
      setTotal(json.meta?.total ?? 0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    debouncedSearch,
    selectedFamilies,
    selectedTypes,
    selectedStatuses,
    selectedStages,
    selectedBodies,
    selectedOwnership,
    placeholderOnly,
  ]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [
    selectedFamilies,
    selectedTypes,
    selectedStatuses,
    selectedStages,
    selectedBodies,
    selectedOwnership,
    placeholderOnly,
  ]);

  // Client-side sort on current page results
  const sorted = [...assets].sort((a, b) => {
    let av = "";
    let bv = "";
    if (sortField === "assetCode") { av = a.assetCode; bv = b.assetCode; }
    else if (sortField === "assetName") { av = a.assetName; bv = b.assetName; }
    else if (sortField === "currentStatus") { av = a.currentStatus; bv = b.currentStatus; }
    else if (sortField === "currentLifecycleStage") {
      av = a.currentLifecycleStage?.name ?? "";
      bv = b.currentLifecycleStage?.name ?? "";
    }
    const cmp = av.localeCompare(bv);
    return sortDir === "asc" ? cmp : -cmp;
  });

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function SortIndicator({ field }: { field: SortField }) {
    if (sortField !== field) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-blue-600 ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  function toggleMulti(
    value: string,
    selected: string[],
    setSelected: (v: string[]) => void
  ) {
    if (selected.includes(value)) {
      setSelected(selected.filter((v) => v !== value));
    } else {
      setSelected([...selected, value]);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Assets</h1>
          <Link
            href="/assets/new"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
          >
            + New Asset
          </Link>
        </div>

        <div className="flex gap-6">
          {/* Filter Panel */}
          <aside className="w-64 shrink-0">
            <div className="bg-white border rounded-lg p-4 space-y-5">
              <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
                Filters
              </h2>

              {/* Search */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Search
                </label>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name or code..."
                  className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Family */}
              <FilterSection title="Family">
                {families.map((f) => (
                  <CheckItem
                    key={f.id}
                    label={f.name}
                    checked={selectedFamilies.includes(f.id)}
                    onChange={() =>
                      toggleMulti(f.id, selectedFamilies, setSelectedFamilies)
                    }
                  />
                ))}
              </FilterSection>

              {/* Type (dependent on Family) */}
              <FilterSection title="Type">
                {availableTypes.map((t) => (
                  <CheckItem
                    key={t.id}
                    label={t.name}
                    checked={selectedTypes.includes(t.id)}
                    onChange={() =>
                      toggleMulti(t.id, selectedTypes, setSelectedTypes)
                    }
                  />
                ))}
                {availableTypes.length === 0 && (
                  <p className="text-xs text-gray-400 italic">Select a family first</p>
                )}
              </FilterSection>

              {/* Status */}
              <FilterSection title="Status">
                {STATUS_OPTIONS.map((s) => (
                  <CheckItem
                    key={s.value}
                    label={s.label}
                    checked={selectedStatuses.includes(s.value)}
                    onChange={() =>
                      toggleMulti(s.value, selectedStatuses, setSelectedStatuses)
                    }
                  />
                ))}
              </FilterSection>

              {/* Lifecycle Stage */}
              <FilterSection title="Lifecycle Stage">
                {stages.map((s) => (
                  <CheckItem
                    key={s.id}
                    label={s.name}
                    checked={selectedStages.includes(s.id)}
                    onChange={() =>
                      toggleMulti(s.id, selectedStages, setSelectedStages)
                    }
                  />
                ))}
              </FilterSection>

              {/* Responsible Body */}
              <FilterSection title="Responsible Body">
                {bodies.slice(0, 20).map((b) => (
                  <CheckItem
                    key={b.id}
                    label={b.name}
                    checked={selectedBodies.includes(b.id)}
                    onChange={() =>
                      toggleMulti(b.id, selectedBodies, setSelectedBodies)
                    }
                  />
                ))}
              </FilterSection>

              {/* Ownership Model */}
              <FilterSection title="Ownership Model">
                {OWNERSHIP_OPTIONS.map((o) => (
                  <CheckItem
                    key={o.value}
                    label={o.label}
                    checked={selectedOwnership.includes(o.value)}
                    onChange={() =>
                      toggleMulti(o.value, selectedOwnership, setSelectedOwnership)
                    }
                  />
                ))}
              </FilterSection>

              {/* Placeholder Body */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="placeholder-only"
                  checked={placeholderOnly}
                  onChange={(e) => setPlaceholderOnly(e.target.checked)}
                  className="rounded"
                />
                <label
                  htmlFor="placeholder-only"
                  className="text-xs text-gray-700 cursor-pointer"
                >
                  Placeholder body only
                </label>
              </div>

              {/* Clear filters */}
              <button
                onClick={() => {
                  setSelectedFamilies([]);
                  setSelectedTypes([]);
                  setSelectedStatuses([]);
                  setSelectedStages([]);
                  setSelectedBodies([]);
                  setSelectedOwnership([]);
                  setPlaceholderOnly(false);
                  setSearch("");
                }}
                className="w-full text-xs text-gray-500 hover:text-gray-700 underline text-left"
              >
                Clear all filters
              </button>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Results count */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-600">
                {loading ? "Loading..." : `${total} asset${total !== 1 ? "s" : ""} found`}
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">
                {error}
              </div>
            )}

            {/* Table */}
            <div className="bg-white border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th
                        className="text-left px-3 py-2 font-medium text-gray-600 cursor-pointer hover:text-gray-900 whitespace-nowrap"
                        onClick={() => toggleSort("assetCode")}
                      >
                        Code <SortIndicator field="assetCode" />
                      </th>
                      <th
                        className="text-left px-3 py-2 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                        onClick={() => toggleSort("assetName")}
                      >
                        Name <SortIndicator field="assetName" />
                      </th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">
                        Family
                      </th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">
                        Type
                      </th>
                      <th
                        className="text-left px-3 py-2 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                        onClick={() => toggleSort("currentStatus")}
                      >
                        Status <SortIndicator field="currentStatus" />
                      </th>
                      <th
                        className="text-left px-3 py-2 font-medium text-gray-600 cursor-pointer hover:text-gray-900 whitespace-nowrap"
                        onClick={() => toggleSort("currentLifecycleStage")}
                      >
                        Stage <SortIndicator field="currentLifecycleStage" />
                      </th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">
                        Responsible Body
                      </th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">
                        Last Event
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                          Loading...
                        </td>
                      </tr>
                    ) : sorted.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                          No assets found.
                        </td>
                      </tr>
                    ) : (
                      sorted.map((asset) => (
                        <tr
                          key={asset.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-3 py-2 font-mono text-xs text-gray-700 whitespace-nowrap">
                            <Link
                              href={`/assets/${asset.id}`}
                              className="text-blue-600 hover:underline"
                            >
                              {asset.assetCode}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-gray-900">
                            <Link
                              href={`/assets/${asset.id}`}
                              className="hover:text-blue-600 hover:underline"
                            >
                              {asset.assetName}
                              {asset.isPlaceholderBody && (
                                <span
                                  className="ml-1 text-amber-500"
                                  title="Assigned to placeholder body"
                                >
                                  ⚠
                                </span>
                              )}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                            {asset.assetFamily?.name ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                            {asset.assetType?.name ?? "—"}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <StatusBadge status={asset.currentStatus} />
                          </td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                            {asset.currentLifecycleStage?.name ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                            {asset.responsibleBody?.name ?? (
                              <span className="text-gray-400 italic">Not assigned</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">
                            {asset._lastEventDate
                              ? new Date(asset._lastEventDate).toLocaleDateString()
                              : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className="px-2 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50"
                  >
                    «
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50"
                  >
                    ‹
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                    const p = start + i;
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`px-3 py-1 text-sm border rounded ${
                          p === page
                            ? "bg-blue-600 text-white border-blue-600"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50"
                  >
                    ›
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    className="px-2 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-50"
                  >
                    »
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        className="flex items-center justify-between w-full text-xs font-medium text-gray-600 uppercase tracking-wide mb-1"
        onClick={() => setOpen((o) => !o)}
      >
        {title}
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="space-y-1 max-h-40 overflow-y-auto">{children}</div>}
    </div>
  );
}

function CheckItem({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="rounded"
      />
      <span className="text-xs text-gray-700 truncate" title={label}>
        {label}
      </span>
    </label>
  );
}
