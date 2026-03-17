"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface PlanningEntity {
  id: string;
  planningCode: string;
  name: string;
  status: string;
  targetDeliveryDate: string | null;
  intendedReceivingBodyIsPlaceholder: boolean;
  developerObligationId: string | null;
  assetFamily: { id: string; name: string };
  assetType: { id: string; name: string };
  planningBody: { id: string; name: string } | null;
}

interface Family { id: string; name: string }
interface AssetType { id: string; name: string; assetFamilyId: string }
interface Body { id: string; name: string }

const STATUS_LABELS: Record<string, string> = {
  identified: "Identified",
  in_planning: "In Planning",
  approved: "Approved",
  in_implementation: "In Implementation",
  delivered: "Delivered",
  converted_to_asset: "Converted to Asset",
};

const STATUS_COLORS: Record<string, string> = {
  identified: "bg-gray-100 text-gray-700",
  in_planning: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  in_implementation: "bg-yellow-100 text-yellow-700",
  delivered: "bg-emerald-100 text-emerald-700",
  converted_to_asset: "bg-purple-100 text-purple-700",
};

const STATUSES = Object.keys(STATUS_LABELS);

export default function PlanningEntitiesPage() {
  const [entities, setEntities] = useState<PlanningEntity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [families, setFamilies] = useState<Family[]>([]);
  const [allTypes, setAllTypes] = useState<AssetType[]>([]);
  const [bodies, setBodies] = useState<Body[]>([]);

  const [filterFamily, setFilterFamily] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterBody, setFilterBody] = useState("");
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [filterPlaceholder, setFilterPlaceholder] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", asset_family_id: "", asset_type_id: "" });
  const [addErrors, setAddErrors] = useState<Partial<typeof addForm>>({});
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addGeneralError, setAddGeneralError] = useState<string | null>(null);

  const fetchEntities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterFamily) params.set("family_id", filterFamily);
      if (filterType) params.set("type_id", filterType);
      if (filterStatus) params.set("status", filterStatus);
      if (filterBody) params.set("planning_body_id", filterBody);
      if (filterOverdue) params.set("overdue", "true");
      params.set("per_page", "50");
      const res = await fetch(`/api/planning-entities?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      let data = json.data ?? [];
      if (filterPlaceholder) {
        data = data.filter((e: PlanningEntity) => e.intendedReceivingBodyIsPlaceholder);
      }
      setEntities(data);
      setTotal(json.meta?.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [filterFamily, filterType, filterStatus, filterBody, filterOverdue, filterPlaceholder]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  useEffect(() => {
    Promise.all([
      fetch("/api/asset-families").then((r) => r.json()),
      fetch("/api/asset-types").then((r) => r.json()),
      fetch("/api/responsible-bodies").then((r) => r.json()),
    ]).then(([f, t, b]) => {
      setFamilies(f.data ?? []);
      setAllTypes(t.data ?? []);
      setBodies(b.data ?? []);
    });
  }, []);

  const availableTypes = filterFamily
    ? allTypes.filter((t) => t.assetFamilyId === filterFamily)
    : allTypes;

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Partial<typeof addForm> = {};
    if (!addForm.name.trim()) errors.name = "Name is required";
    if (!addForm.asset_family_id) errors.asset_family_id = "Family is required";
    if (!addForm.asset_type_id) errors.asset_type_id = "Type is required";
    if (Object.keys(errors).length > 0) { setAddErrors(errors); return; }

    setAddSubmitting(true);
    setAddGeneralError(null);
    try {
      const res = await fetch("/api/planning-entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const json = await res.json();
      if (!res.ok) { setAddGeneralError(json.error ?? "Error"); return; }
      setShowAddModal(false);
      setAddForm({ name: "", asset_family_id: "", asset_type_id: "" });
      fetchEntities();
    } catch {
      setAddGeneralError("Network error");
    } finally {
      setAddSubmitting(false);
    }
  };

  const isOverdue = (e: PlanningEntity) => {
    if (!e.targetDeliveryDate) return false;
    if (e.status === "delivered" || e.status === "converted_to_asset") return false;
    return new Date(e.targetDeliveryDate) < new Date();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Link href="/" className="hover:text-gray-800">Home</Link>
              <span>/</span>
              <span className="text-gray-800">Planning Entities</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Planning Entities</h1>
            <p className="text-sm text-gray-500 mt-1">{total} total entities</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            + Add Planning Entity
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Family</label>
              <select value={filterFamily} onChange={(e) => { setFilterFamily(e.target.value); setFilterType(""); }}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="">All Families</option>
                {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="">All Types</option>
                {availableTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="">All Statuses</option>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Planning Body</label>
              <select value={filterBody} onChange={(e) => setFilterBody(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="">All Bodies</option>
                {bodies.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={filterOverdue} onChange={(e) => setFilterOverdue(e.target.checked)}
                className="rounded border-gray-300" />
              Overdue only
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={filterPlaceholder} onChange={(e) => setFilterPlaceholder(e.target.checked)}
                className="rounded border-gray-300" />
              Placeholder receiving body only
            </label>
            {(filterFamily || filterType || filterStatus || filterBody || filterOverdue || filterPlaceholder) && (
              <button onClick={() => { setFilterFamily(""); setFilterType(""); setFilterStatus(""); setFilterBody(""); setFilterOverdue(false); setFilterPlaceholder(false); }}
                className="text-xs text-blue-600 hover:text-blue-800 underline">Clear filters</button>
            )}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">{error}</div>
        ) : entities.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No planning entities found</div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Family / Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Target Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entities.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-3">
                      <Link href={`/planning/${e.id}`} className="font-mono text-xs text-blue-600 hover:underline">
                        {e.planningCode}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/planning/${e.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                        {e.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      <div>{e.assetFamily.name}</div>
                      <div className="text-gray-400">{e.assetType.name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[e.status] ?? "bg-gray-100 text-gray-700"}`}>
                        {STATUS_LABELS[e.status] ?? e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {e.targetDeliveryDate ? (
                        <span className={isOverdue(e) ? "text-red-600 font-medium" : ""}>
                          {new Date(e.targetDeliveryDate).toLocaleDateString()}
                          {isOverdue(e) && " ⚠ Overdue"}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {e.intendedReceivingBodyIsPlaceholder && (
                          <span className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">TBD Body</span>
                        )}
                        {e.developerObligationId && (
                          <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Dev Obligation</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Add Planning Entity</h2>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${addErrors.name ? "border-red-400" : "border-gray-300"}`} />
                {addErrors.name && <p className="text-red-500 text-xs mt-1">{addErrors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asset Family *</label>
                <select value={addForm.asset_family_id}
                  onChange={(e) => setAddForm({ ...addForm, asset_family_id: e.target.value, asset_type_id: "" })}
                  className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${addErrors.asset_family_id ? "border-red-400" : "border-gray-300"}`}>
                  <option value="">Select family...</option>
                  {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                {addErrors.asset_family_id && <p className="text-red-500 text-xs mt-1">{addErrors.asset_family_id}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asset Type *</label>
                <select value={addForm.asset_type_id}
                  onChange={(e) => setAddForm({ ...addForm, asset_type_id: e.target.value })}
                  disabled={!addForm.asset_family_id}
                  className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${addErrors.asset_type_id ? "border-red-400" : "border-gray-300"}`}>
                  <option value="">Select type...</option>
                  {allTypes.filter((t) => t.assetFamilyId === addForm.asset_family_id).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {addErrors.asset_type_id && <p className="text-red-500 text-xs mt-1">{addErrors.asset_type_id}</p>}
              </div>
              {addGeneralError && <p className="text-red-500 text-sm">{addGeneralError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowAddModal(false); setAddErrors({}); setAddGeneralError(null); }}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={addSubmitting}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                  {addSubmitting ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
