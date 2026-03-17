"use client";

import { useState, useEffect, useCallback } from "react";

interface AssetFamily {
  id: string;
  name: string;
}

interface AssetType {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  assetFamilyId: string;
  assetFamily?: AssetFamily;
}

interface ApiResponse<T> {
  data: T;
  error: string | null;
}

const ALL_FAMILIES = "__all__";
const emptyForm = { name: "", description: "", assetFamilyId: "" };

export default function AssetTypesPage() {
  const [families, setFamilies] = useState<AssetFamily[]>([]);
  const [types, setTypes] = useState<AssetType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [familyFilter, setFamilyFilter] = useState<string>(ALL_FAMILIES);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AssetType | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<typeof emptyForm>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [famRes, typesRes] = await Promise.all([
        fetch("/api/asset-families"),
        fetch("/api/asset-types"),
      ]);
      const famJson: ApiResponse<AssetFamily[]> = await famRes.json();
      const typesJson: ApiResponse<AssetType[]> = await typesRes.json();
      if (!famRes.ok) throw new Error(famJson.error ?? "Failed to load families");
      if (!typesRes.ok) throw new Error(typesJson.error ?? "Failed to load types");
      setFamilies(famJson.data ?? []);
      setTypes(typesJson.data ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredTypes =
    familyFilter === ALL_FAMILIES
      ? types
      : types.filter((t) => t.assetFamilyId === familyFilter);

  // Group by family
  const grouped: Record<string, AssetType[]> = {};
  for (const t of filteredTypes) {
    const fid = t.assetFamilyId;
    if (!grouped[fid]) grouped[fid] = [];
    grouped[fid].push(t);
  }

  const openAddModal = (preselectedFamilyId?: string) => {
    setEditTarget(null);
    setForm({
      ...emptyForm,
      assetFamilyId:
        preselectedFamilyId ??
        (familyFilter !== ALL_FAMILIES ? familyFilter : families[0]?.id ?? ""),
    });
    setFormErrors({});
    setSubmitError(null);
    setModalOpen(true);
  };

  const openEditModal = (type: AssetType) => {
    setEditTarget(type);
    setForm({
      name: type.name,
      description: type.description ?? "",
      assetFamilyId: type.assetFamilyId,
    });
    setFormErrors({});
    setSubmitError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditTarget(null);
    setForm(emptyForm);
    setFormErrors({});
    setSubmitError(null);
  };

  const validate = () => {
    const errors: Partial<typeof emptyForm> = {};
    if (!form.name.trim()) errors.name = "Name is required";
    else if (form.name.trim().length > 120) errors.name = "Name must be 120 characters or fewer";
    if (!form.assetFamilyId) errors.assetFamilyId = "Family is required";
    return errors;
  };

  const handleSubmit = async () => {
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const isEdit = editTarget !== null;
      const url = isEdit ? `/api/asset-types/${editTarget.id}` : "/api/asset-types";
      const method = isEdit ? "PUT" : "POST";
      const body = isEdit
        ? { name: form.name.trim(), description: form.description.trim() || null }
        : {
            asset_family_id: form.assetFamilyId,
            name: form.name.trim(),
            description: form.description.trim() || null,
          };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json: ApiResponse<AssetType> = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      closeModal();
      await fetchData();
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (type: AssetType, isActive: boolean) => {
    if (!isActive && !confirm(`Deactivate "${type.name}"?`)) return;
    try {
      const res = await fetch(`/api/asset-types/${type.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: isActive }),
      });
      const json: ApiResponse<AssetType> = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      await fetchData();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const familyName = (id: string) =>
    families.find((f) => f.id === id)?.name ?? id;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Asset Types</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage asset types within each family
            </p>
          </div>
          <button
            onClick={() => openAddModal()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            + Add Type
          </button>
        </div>

        {/* Family filter */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Filter by Family
          </label>
          <select
            value={familyFilter}
            onChange={(e) => setFamilyFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={ALL_FAMILIES}>All Families</option>
            {families.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Tables grouped by family */}
        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
            Loading…
          </div>
        ) : filteredTypes.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
            No asset types found.
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([fid, ftypes]) => (
              <div
                key={fid}
                className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-3">
                  <h2 className="text-sm font-semibold text-gray-700">
                    {familyName(fid)}
                  </h2>
                  <button
                    onClick={() => openAddModal(fid)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    + Add type
                  </button>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        Description
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {ftypes.map((type) => (
                      <tr
                        key={type.id}
                        className={type.isActive ? "" : "bg-gray-50 opacity-60"}
                      >
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {type.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {type.description ?? (
                            <span className="italic text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {type.isActive ? (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right text-sm">
                          <button
                            onClick={() => openEditModal(type)}
                            className="mr-3 font-medium text-blue-600 hover:text-blue-800"
                          >
                            Edit
                          </button>
                          {type.isActive ? (
                            <button
                              onClick={() => handleToggleActive(type, false)}
                              className="font-medium text-red-600 hover:text-red-800"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleActive(type, true)}
                              className="font-medium text-green-600 hover:text-green-800"
                            >
                              Activate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editTarget ? "Edit Asset Type" : "Add Asset Type"}
              </h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              {/* Family (only for new) */}
              {!editTarget && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Family <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.assetFamilyId}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, assetFamilyId: e.target.value }));
                      if (formErrors.assetFamilyId)
                        setFormErrors((fe) => ({ ...fe, assetFamilyId: undefined }));
                    }}
                    className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formErrors.assetFamilyId ? "border-red-400" : "border-gray-300"
                    }`}
                  >
                    <option value="">Select a family…</option>
                    {families.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  {formErrors.assetFamilyId && (
                    <p className="mt-1 text-xs text-red-600">
                      {formErrors.assetFamilyId}
                    </p>
                  )}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, name: e.target.value }));
                    if (formErrors.name)
                      setFormErrors((fe) => ({ ...fe, name: undefined }));
                  }}
                  maxLength={120}
                  className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.name ? "border-red-400" : "border-gray-300"
                  }`}
                  placeholder="e.g. Community Center"
                />
                {formErrors.name && (
                  <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional description"
                />
              </div>

              {submitError && (
                <p className="text-sm text-red-600">{submitError}</p>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={closeModal}
                disabled={submitting}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Saving…" : editTarget ? "Save Changes" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
