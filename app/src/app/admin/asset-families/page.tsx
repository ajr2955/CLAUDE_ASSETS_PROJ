"use client";

import { useCallback, useEffect, useState } from "react";

interface AssetFamily {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  _count?: { assetTypes: number };
}

interface ApiResponse<T> {
  data: T;
  error: string | null;
}

const emptyForm = { name: "", description: "" };

export default function AssetFamiliesPage() {
  const [families, setFamilies] = useState<AssetFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AssetFamily | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<typeof emptyForm>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchFamilies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/asset-families");
      const json: ApiResponse<AssetFamily[]> = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setFamilies(json.data ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFamilies();
  }, [fetchFamilies]);

  const openAddModal = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setFormErrors({});
    setSubmitError(null);
    setModalOpen(true);
  };

  const openEditModal = (family: AssetFamily) => {
    setEditTarget(family);
    setForm({ name: family.name, description: family.description ?? "" });
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
      const url = isEdit ? `/api/asset-families/${editTarget.id}` : "/api/asset-families";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
        }),
      });
      const json: ApiResponse<AssetFamily> = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      closeModal();
      await fetchFamilies();
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (family: AssetFamily) => {
    if (!confirm(`Deactivate "${family.name}"?`)) return;
    try {
      const res = await fetch(`/api/asset-families/${family.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: false }),
      });
      const json: ApiResponse<AssetFamily> = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to deactivate");
      await fetchFamilies();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleActivate = async (family: AssetFamily) => {
    try {
      const res = await fetch(`/api/asset-families/${family.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: true }),
      });
      const json: ApiResponse<AssetFamily> = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to activate");
      await fetchFamilies();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Asset Families</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage top-level asset classifications
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            + Add Family
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-gray-500">Loading…</div>
          ) : families.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-gray-500">
              No asset families found.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Description
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500">
                    Types
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
                {families.map((family) => (
                  <tr
                    key={family.id}
                    className={family.isActive ? "" : "bg-gray-50 opacity-60"}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {family.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {family.description ?? (
                        <span className="italic text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-700">
                      {family._count?.assetTypes ?? 0}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {family.isActive ? (
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
                        onClick={() => openEditModal(family)}
                        className="mr-3 font-medium text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      {family.isActive ? (
                        <button
                          onClick={() => handleDeactivate(family)}
                          className="font-medium text-red-600 hover:text-red-800"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivate(family)}
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
          )}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editTarget ? "Edit Asset Family" : "Add Asset Family"}
              </h2>
            </div>
            <div className="px-6 py-4 space-y-4">
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
                    if (formErrors.name) setFormErrors((fe) => ({ ...fe, name: undefined }));
                  }}
                  maxLength={120}
                  className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.name ? "border-red-400" : "border-gray-300"
                  }`}
                  placeholder="e.g. Public Buildings"
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

              {/* Submit error */}
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
