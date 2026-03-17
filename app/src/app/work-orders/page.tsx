"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface WorkOrderCategory {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

interface ResponsibleBodyRef {
  id: string;
  name: string;
}

interface WorkOrderRecord {
  id: string;
  workOrderNumber: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  targetCompletionDate: string | null;
  actualCompletionDate: string | null;
  estimatedCost: string | null;
  notes: string | null;
  createdAt: string;
  asset: { id: string; assetName: string; assetCode: string } | null;
  category: WorkOrderCategory | null;
  assignedToBody: ResponsibleBodyRef | null;
  lifecycleStage: { id: string; name: string } | null;
}

interface CreateWorkOrderForm {
  asset_id: string;
  category_id: string;
  title: string;
  description: string;
  priority: string;
  target_completion_date: string;
  notes: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-green-100 text-green-800",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  assigned: "bg-indigo-100 text-indigo-800",
  in_progress: "bg-purple-100 text-purple-800",
  pending_approval: "bg-amber-100 text-amber-800",
  closed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-700",
};

const STATUS_PIPELINE = ["open", "assigned", "in_progress", "pending_approval", "closed"] as const;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-IL", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isOverdue(wo: WorkOrderRecord): boolean {
  if (!wo.targetCompletionDate) return false;
  if (wo.status === "closed" || wo.status === "cancelled") return false;
  return new Date(wo.targetCompletionDate) < new Date();
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  );
}

function StatusPipeline({ currentStatus }: { currentStatus: string }) {
  const currentIdx = STATUS_PIPELINE.indexOf(currentStatus as typeof STATUS_PIPELINE[number]);
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {STATUS_PIPELINE.map((s, idx) => {
        const isActive = s === currentStatus;
        const isDone = currentIdx > idx;
        return (
          <Fragment key={s}>
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium border ${
                isActive
                  ? "bg-blue-600 text-white border-blue-600"
                  : isDone
                  ? "bg-green-100 text-green-700 border-green-200"
                  : "bg-gray-50 text-gray-400 border-gray-200"
              }`}
            >
              {formatLabel(s)}
            </span>
            {idx < STATUS_PIPELINE.length - 1 && (
              <span className="text-gray-300 text-xs">→</span>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

// Work order detail modal
function WorkOrderDetailModal({
  workOrder,
  onClose,
}: {
  workOrder: WorkOrderRecord;
  onClose: () => void;
}) {
  const overdue = isOverdue(workOrder);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <p className="text-xs text-gray-500 font-mono">{workOrder.workOrderNumber}</p>
            <h2 className="text-lg font-semibold text-gray-900">{workOrder.title}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {/* Status pipeline */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Status Pipeline</p>
            <StatusPipeline currentStatus={workOrder.status} />
          </div>

          {/* Badges row */}
          <div className="flex flex-wrap gap-2 items-center">
            <Badge
              label={formatLabel(workOrder.priority)}
              colorClass={PRIORITY_COLORS[workOrder.priority] ?? "bg-gray-100 text-gray-700"}
            />
            <Badge
              label={formatLabel(workOrder.status)}
              colorClass={STATUS_COLORS[workOrder.status] ?? "bg-gray-100 text-gray-700"}
            />
            {overdue && (
              <Badge label="Overdue" colorClass="bg-red-100 text-red-700" />
            )}
          </div>

          {/* Core info grid */}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-gray-500">Asset</dt>
              <dd className="font-medium text-gray-800">
                {workOrder.asset ? (
                  <Link href={`/assets/${workOrder.asset.id}`} className="text-blue-600 hover:underline">
                    {workOrder.asset.assetCode} — {workOrder.asset.assetName}
                  </Link>
                ) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Category</dt>
              <dd className="font-medium text-gray-800">{workOrder.category?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Assigned Body</dt>
              <dd className="font-medium text-gray-800">{workOrder.assignedToBody?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Lifecycle Stage</dt>
              <dd className="font-medium text-gray-800">{workOrder.lifecycleStage?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Target Completion</dt>
              <dd className={`font-medium ${overdue ? "text-red-700" : "text-gray-800"}`}>
                {formatDate(workOrder.targetCompletionDate)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Actual Completion</dt>
              <dd className="font-medium text-gray-800">{formatDate(workOrder.actualCompletionDate)}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Estimated Cost</dt>
              <dd className="font-medium text-gray-800">
                {workOrder.estimatedCost ? `₪${Number(workOrder.estimatedCost).toLocaleString()}` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Created</dt>
              <dd className="font-medium text-gray-800">{formatDate(workOrder.createdAt)}</dd>
            </div>
          </dl>

          {workOrder.description && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Description</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{workOrder.description}</p>
            </div>
          )}

          {workOrder.notes && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{workOrder.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Create Work Order modal (asset pre-filling is optional here)
function CreateWorkOrderModal({
  categories,
  prefilledAssetId,
  prefilledAssetLabel,
  onClose,
  onCreated,
}: {
  categories: WorkOrderCategory[];
  prefilledAssetId?: string;
  prefilledAssetLabel?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<CreateWorkOrderForm>({
    asset_id: prefilledAssetId ?? "",
    category_id: "",
    title: "",
    description: "",
    priority: "medium",
    target_completion_date: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CreateWorkOrderForm, string>>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    const newErrors: Partial<Record<keyof CreateWorkOrderForm, string>> = {};
    if (!form.asset_id.trim()) newErrors.asset_id = "Asset ID is required";
    if (!form.category_id) newErrors.category_id = "Category is required";
    if (!form.title.trim()) newErrors.title = "Title is required";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSubmitting(true);
    setGeneralError(null);
    try {
      const payload: Record<string, unknown> = {
        asset_id: form.asset_id.trim(),
        category_id: form.category_id,
        title: form.title.trim(),
        priority: form.priority,
      };
      if (form.description.trim()) payload.description = form.description.trim();
      if (form.target_completion_date) payload.target_completion_date = form.target_completion_date;
      if (form.notes.trim()) payload.notes = form.notes.trim();

      const res = await fetch("/api/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setGeneralError(json.error ?? "Failed to create work order");
        return;
      }
      onCreated();
      onClose();
    } catch {
      setGeneralError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [form, onClose, onCreated]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">Create Work Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <div className="px-6 py-4 space-y-3">
          {generalError && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {generalError}
            </div>
          )}

          {prefilledAssetLabel ? (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Asset</label>
              <p className="text-sm text-gray-800 border rounded px-2 py-1.5 bg-gray-50">{prefilledAssetLabel}</p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Asset ID *</label>
              <input
                type="text"
                value={form.asset_id}
                onChange={(e) => setForm((p) => ({ ...p, asset_id: e.target.value }))}
                className="w-full border rounded px-2 py-1.5 text-sm"
                placeholder="Paste asset UUID"
              />
              {errors.asset_id && <p className="text-xs text-red-600 mt-1">{errors.asset_id}</p>}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Category *</label>
            <select
              value={form.category_id}
              onChange={(e) => setForm((p) => ({ ...p, category_id: e.target.value }))}
              className="w-full border rounded px-2 py-1.5 text-sm"
            >
              <option value="">— Select category —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.category_id && <p className="text-xs text-red-600 mt-1">{errors.category_id}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className="w-full border rounded px-2 py-1.5 text-sm"
              placeholder="Brief description of the work"
            />
            {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
              className="w-full border rounded px-2 py-1.5 text-sm"
            >
              {["critical", "high", "medium", "low"].map((p) => (
                <option key={p} value={p}>{formatLabel(p)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Target Completion Date</label>
            <input
              type="date"
              value={form.target_completion_date}
              onChange={(e) => setForm((p) => ({ ...p, target_completion_date: e.target.value }))}
              className="w-full border rounded px-2 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              className="w-full border rounded px-2 py-1.5 text-sm resize-none"
              placeholder="Detailed description..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
              className="w-full border rounded px-2 py-1.5 text-sm resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Creating..." : "Create Work Order"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrderRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [categories, setCategories] = useState<WorkOrderCategory[]>([]);

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterOverdue, setFilterOverdue] = useState(false);

  // Modals
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrderRecord | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const PER_PAGE = 25;

  const fetchWorkOrders = useCallback(async (p: number = 1) => {
    setLoading(true);
    setLoadError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("page", String(p));
      qs.set("per_page", String(PER_PAGE));
      if (filterStatus) qs.set("status", filterStatus);
      if (filterPriority) qs.set("priority", filterPriority);
      if (filterCategoryId) qs.set("category_id", filterCategoryId);
      if (filterOverdue) qs.set("overdue", "true");

      const res = await fetch(`/api/work-orders?${qs}`);
      const json = await res.json();
      if (!res.ok) {
        setLoadError(json.error ?? "Failed to load work orders");
        return;
      }
      setWorkOrders(json.data ?? []);
      setTotal(json.meta?.total ?? 0);
      setPage(p);
    } catch {
      setLoadError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPriority, filterCategoryId, filterOverdue]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/work-order-categories");
      const json = await res.json();
      if (json.data) setCategories(json.data);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchWorkOrders(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterPriority, filterCategoryId, filterOverdue]);

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Work Orders</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} total work order{total !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Create Work Order
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded-lg shadow-sm px-4 py-3 mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="">All</option>
            {["open", "assigned", "in_progress", "pending_approval", "closed", "cancelled"].map((s) => (
              <option key={s} value={s}>{formatLabel(s)}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">Priority</label>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="">All</option>
            {["critical", "high", "medium", "low"].map((p) => (
              <option key={p} value={p}>{formatLabel(p)}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">Category</label>
          <select
            value={filterCategoryId}
            onChange={(e) => setFilterCategoryId(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={filterOverdue}
            onChange={(e) => setFilterOverdue(e.target.checked)}
            className="rounded"
          />
          Overdue only
        </label>
        {(filterStatus || filterPriority || filterCategoryId || filterOverdue) && (
          <button
            onClick={() => {
              setFilterStatus("");
              setFilterPriority("");
              setFilterCategoryId("");
              setFilterOverdue(false);
            }}
            className="text-xs text-blue-600 hover:underline ml-auto"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Work order list */}
      <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
        {loading && (
          <div className="px-6 py-10 text-center text-sm text-gray-500">Loading work orders...</div>
        )}
        {!loading && loadError && (
          <div className="px-6 py-10 text-center text-sm text-red-600">{loadError}</div>
        )}
        {!loading && !loadError && workOrders.length === 0 && (
          <div className="px-6 py-10 text-center text-sm text-gray-500">No work orders found.</div>
        )}
        {!loading && !loadError && workOrders.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Number</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Title / Asset</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Category</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Priority</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Assigned Body</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Target Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {workOrders.map((wo) => {
                const overdue = isOverdue(wo);
                return (
                  <tr
                    key={wo.id}
                    onClick={() => setSelectedWorkOrder(wo)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{wo.workOrderNumber}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{wo.title}</p>
                      {wo.asset && (
                        <p className="text-xs text-gray-500 mt-0.5">{wo.asset.assetCode} — {wo.asset.assetName}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{wo.category?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge
                        label={formatLabel(wo.priority)}
                        colorClass={PRIORITY_COLORS[wo.priority] ?? "bg-gray-100 text-gray-700"}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        label={formatLabel(wo.status)}
                        colorClass={STATUS_COLORS[wo.status] ?? "bg-gray-100 text-gray-700"}
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-700">{wo.assignedToBody?.name ?? <span className="text-gray-400 italic">Unassigned</span>}</td>
                    <td className="px-4 py-3">
                      <span className={overdue ? "text-red-700 font-medium" : "text-gray-700"}>
                        {formatDate(wo.targetCompletionDate)}
                      </span>
                      {overdue && (
                        <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Overdue</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>
            Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => fetchWorkOrders(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => fetchWorkOrders(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Work Order Detail Modal */}
      {selectedWorkOrder && (
        <WorkOrderDetailModal
          workOrder={selectedWorkOrder}
          onClose={() => setSelectedWorkOrder(null)}
        />
      )}

      {/* Create Work Order Modal */}
      {showCreateModal && (
        <CreateWorkOrderModal
          categories={categories}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => fetchWorkOrders(1)}
        />
      )}
    </div>
  );
}
