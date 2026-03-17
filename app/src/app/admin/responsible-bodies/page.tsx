"use client";

import { useCallback, useEffect, useState, Fragment } from "react";

interface ResponsibleBody {
  id: string;
  name: string;
  bodyType: string;
  description: string | null;
  isActive: boolean;
  isPlaceholder: boolean;
  resolutionNote: string | null;
  _count?: {
    assetsAsStrategicOwner: number;
    assetsAsResponsible: number;
    assetsAsOperational: number;
    assetsAsMaintenance: number;
    assetsAsDataSteward: number;
  };
}

interface ApiResponse<T> {
  data: T;
  error: string | null;
}

const BODY_TYPE_LABELS: Record<string, string> = {
  headquarters: "Headquarters",
  planning: "Planning",
  assets: "Assets",
  operations: "Operations",
  administration: "Administration",
  department: "Department",
  contractor: "Contractor",
  data_governance: "Data Governance",
  placeholder: "Placeholder",
};

const emptyForm = {
  name: "",
  description: "",
  bodyType: "department",
  resolutionNote: "",
};

export default function ResponsibleBodiesPage() {
  const [bodies, setBodies] = useState<ResponsibleBody[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ResponsibleBody | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<typeof emptyForm>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchBodies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/responsible-bodies?include_placeholders=true");
      const json: ApiResponse<ResponsibleBody[]> = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setBodies(json.data ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBodies();
  }, [fetchBodies]);

  const totalAssets = (body: ResponsibleBody) => {
    const c = body._count;
    if (!c) return 0;
    return (
      c.assetsAsStrategicOwner +
      c.assetsAsResponsible +
      c.assetsAsOperational +
      c.assetsAsMaintenance +
      c.assetsAsDataSteward
    );
  };

  const openAddModal = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setFormErrors({});
    setSubmitError(null);
    setModalOpen(true);
  };

  const openEditModal = (body: ResponsibleBody) => {
    setEditTarget(body);
    setForm({
      name: body.name,
      description: body.description ?? "",
      bodyType: body.bodyType,
      resolutionNote: body.resolutionNote ?? "",
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
    if (!form.bodyType) errors.bodyType = "Body type is required";
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
      const url = isEdit
        ? `/api/responsible-bodies/${editTarget.id}`
        : "/api/responsible-bodies";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          body_type: form.bodyType,
          resolution_note: form.resolutionNote.trim() || null,
        }),
      });
      const json: ApiResponse<ResponsibleBody> = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      closeModal();
      await fetchBodies();
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (body: ResponsibleBody, newActive: boolean) => {
    const confirmMsg = newActive
      ? `Activate "${body.name}"?`
      : `Deactivate "${body.name}"?`;
    if (!confirm(confirmMsg)) return;
    try {
      const payload: Record<string, unknown> = { is_active: newActive };
      if (!newActive && body.isPlaceholder) {
        payload.confirm_deactivate_placeholder = true;
      }
      const res = await fetch(`/api/responsible-bodies/${body.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json: ApiResponse<ResponsibleBody> = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      await fetchBodies();
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
            <h1 className="text-2xl font-bold text-gray-900">Responsible Bodies</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage organizational bodies responsible for assets
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            + Add Body
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
            <div className="px-6 py-12 text-center text-sm text-gray-500">Loading&hellip;</div>
          ) : bodies.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-gray-500">
              No responsible bodies found.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Type
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500">
                    Assets
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
                {bodies.map((body) => (
                  <Fragment key={body.id}>
                    <tr
                      className={body.isActive ? "" : "bg-gray-50 opacity-60"}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {body.name}
                          </span>
                          {body.isPlaceholder && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                              Open Decision
                            </span>
                          )}
                        </div>
                        {body.description && (
                          <p className="mt-0.5 text-xs text-gray-500">{body.description}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {BODY_TYPE_LABELS[body.bodyType] ?? body.bodyType}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-700">
                        {totalAssets(body)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {body.isActive ? (
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
                        {body.isPlaceholder && body.resolutionNote && (
                          <button
                            onClick={() =>
                              setExpandedId(expandedId === body.id ? null : body.id)
                            }
                            className="mr-3 font-medium text-amber-600 hover:text-amber-800"
                          >
                            {expandedId === body.id ? "Hide note" : "View note"}
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(body)}
                          className="mr-3 font-medium text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        {body.isActive ? (
                          <button
                            onClick={() => handleToggleActive(body, false)}
                            className="font-medium text-red-600 hover:text-red-800"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleActive(body, true)}
                            className="font-medium text-green-600 hover:text-green-800"
                          >
                            Activate
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedId === body.id && body.resolutionNote && (
                      <tr className="bg-amber-50">
                        <td colSpan={5} className="px-6 py-3">
                          <p className="text-xs font-medium text-amber-800 mb-1">
                            Resolution Note
                          </p>
                          <p className="text-sm text-amber-900">{body.resolutionNote}</p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
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
                {editTarget ? "Edit Responsible Body" : "Add Responsible Body"}
              </h2>
            </div>
            <div className="space-y-4 px-6 py-4">
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
                  placeholder="e.g. Assets Department"
                />
                {formErrors.name && (
                  <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>
                )}
              </div>

              {/* Body Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Body Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.bodyType}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, bodyType: e.target.value }));
                    if (formErrors.bodyType)
                      setFormErrors((fe) => ({ ...fe, bodyType: undefined }));
                  }}
                  className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    formErrors.bodyType ? "border-red-400" : "border-gray-300"
                  }`}
                >
                  {Object.entries(BODY_TYPE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
                {formErrors.bodyType && (
                  <p className="mt-1 text-xs text-red-600">{formErrors.bodyType}</p>
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
                  rows={2}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional description"
                />
              </div>

              {/* Resolution Note (shown for placeholders or when editing) */}
              {(editTarget?.isPlaceholder || form.bodyType === "placeholder") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Resolution Note
                  </label>
                  <textarea
                    value={form.resolutionNote}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, resolutionNote: e.target.value }))
                    }
                    rows={3}
                    className="mt-1 block w-full rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="Describe the open decision and any progress toward resolution"
                  />
                </div>
              )}

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
                {submitting ? "Saving\u2026" : editTarget ? "Save Changes" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
