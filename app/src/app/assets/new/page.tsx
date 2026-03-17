"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface AssetFamily {
  id: string;
  name: string;
  isActive: boolean;
}

interface AssetType {
  id: string;
  name: string;
  assetFamilyId: string;
  isActive: boolean;
}

interface ResponsibleBody {
  id: string;
  name: string;
  bodyType: string;
  isActive: boolean;
  isPlaceholder: boolean;
}

type Step = 1 | 2 | 3 | 4;

const OWNERSHIP_MODELS = [
  { value: "owned", label: "Owned" },
  { value: "leased_in", label: "Leased In" },
  { value: "leased_out", label: "Leased Out" },
  { value: "allocated", label: "Allocated" },
  { value: "developer_obligation", label: "Developer Obligation" },
  { value: "partnership", label: "Partnership" },
];

interface FormData {
  // Step 1
  assetFamilyId: string;
  assetTypeId: string;
  // Step 2
  assetName: string;
  assetCode: string;
  ownershipModel: string;
  address: string;
  areaSqm: string;
  notes: string;
  // Step 3
  strategicOwnerBodyId: string;
  responsibleBodyId: string;
  operationalBodyId: string;
  maintenanceBodyId: string;
  dataStewardBodyId: string;
}

interface FieldErrors {
  assetFamilyId?: string;
  assetTypeId?: string;
  assetName?: string;
  assetCode?: string;
  ownershipModel?: string;
  address?: string;
  areaSqm?: string;
  strategicOwnerBodyId?: string;
  responsibleBodyId?: string;
  operationalBodyId?: string;
  maintenanceBodyId?: string;
  dataStewardBodyId?: string;
  general?: string;
}

const STEP_TITLES: Record<Step, string> = {
  1: "Classification",
  2: "Identity",
  3: "Responsibility",
  4: "Review & Submit",
};

function BodySelect({
  label,
  value,
  onChange,
  bodies,
  error,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  bodies: ResponsibleBody[];
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = query.trim()
    ? bodies.filter((b) =>
        b.name.toLowerCase().includes(query.toLowerCase())
      )
    : bodies;

  const selected = bodies.find((b) => b.id === value);

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            error ? "border-red-500" : "border-gray-300"
          }`}
          placeholder="Search body..."
          value={open ? query : selected ? selected.name : ""}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
        {open && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
            <div
              className="px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 cursor-pointer"
              onMouseDown={() => {
                onChange("");
                setOpen(false);
              }}
            >
              — Not assigned —
            </div>
            {filtered.map((b) => (
              <div
                key={b.id}
                className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer flex items-center gap-2"
                onMouseDown={() => {
                  onChange(b.id);
                  setOpen(false);
                }}
              >
                {b.isPlaceholder && (
                  <span className="text-amber-500" title="Placeholder body — decision pending">⚠</span>
                )}
                <span>{b.name}</span>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-400">No results</div>
            )}
          </div>
        )}
      </div>
      {selected?.isPlaceholder && (
        <p className="mt-1 text-xs text-amber-600">
          ⚠ This is a placeholder body — organizational ownership not yet resolved.
        </p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function NewAssetPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [families, setFamilies] = useState<AssetFamily[]>([]);
  const [allTypes, setAllTypes] = useState<AssetType[]>([]);
  const [bodies, setBodies] = useState<ResponsibleBody[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const [form, setForm] = useState<FormData>({
    assetFamilyId: "",
    assetTypeId: "",
    assetName: "",
    assetCode: "",
    ownershipModel: "",
    address: "",
    areaSqm: "",
    notes: "",
    strategicOwnerBodyId: "",
    responsibleBodyId: "",
    operationalBodyId: "",
    maintenanceBodyId: "",
    dataStewardBodyId: "",
  });

  const fetchOptions = useCallback(async () => {
    setLoading(true);
    try {
      const [fRes, tRes, bRes] = await Promise.all([
        fetch("/api/asset-families"),
        fetch("/api/asset-types"),
        fetch("/api/responsible-bodies?include_placeholders=true"),
      ]);
      const [fData, tData, bData] = await Promise.all([
        fRes.json(),
        tRes.json(),
        bRes.json(),
      ]);
      setFamilies(fData.data ?? []);
      setAllTypes(tData.data ?? []);
      setBodies(bData.data ?? []);
    } catch {
      setErrors({ general: "Failed to load options. Please refresh." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const availableTypes = form.assetFamilyId
    ? allTypes.filter((t) => t.assetFamilyId === form.assetFamilyId && t.isActive)
    : [];

  function setField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validateStep1(): boolean {
    const errs: FieldErrors = {};
    if (!form.assetFamilyId) errs.assetFamilyId = "Family is required";
    if (!form.assetTypeId) errs.assetTypeId = "Type is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep2(): boolean {
    const errs: FieldErrors = {};
    if (!form.assetName.trim()) errs.assetName = "Asset name is required";
    if (form.areaSqm && isNaN(parseFloat(form.areaSqm))) {
      errs.areaSqm = "Must be a valid number";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function nextStep() {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep((s) => Math.min(s + 1, 4) as Step);
  }

  function prevStep() {
    setStep((s) => Math.max(s - 1, 1) as Step);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setErrors({});
    try {
      const payload: Record<string, unknown> = {
        assetName: form.assetName.trim(),
        assetFamilyId: form.assetFamilyId,
        assetTypeId: form.assetTypeId,
      };
      if (form.assetCode.trim()) payload.assetCode = form.assetCode.trim();
      if (form.ownershipModel) payload.ownershipModel = form.ownershipModel;
      if (form.address.trim()) payload.address = form.address.trim();
      if (form.areaSqm.trim()) payload.areaSqm = parseFloat(form.areaSqm);
      if (form.notes.trim()) payload.notes = form.notes.trim();
      if (form.strategicOwnerBodyId) payload.strategicOwnerBodyId = form.strategicOwnerBodyId;
      if (form.responsibleBodyId) payload.responsibleBodyId = form.responsibleBodyId;
      if (form.operationalBodyId) payload.operationalBodyId = form.operationalBodyId;
      if (form.maintenanceBodyId) payload.maintenanceBodyId = form.maintenanceBodyId;
      if (form.dataStewardBodyId) payload.dataStewardBodyId = form.dataStewardBodyId;

      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrors({ general: json.error ?? "Failed to create asset" });
        return;
      }
      router.push(`/assets/${json.data.id}`);
    } catch {
      setErrors({ general: "An unexpected error occurred" });
    } finally {
      setSubmitting(false);
    }
  }

  const selectedFamily = families.find((f) => f.id === form.assetFamilyId);
  const selectedType = allTypes.find((t) => t.id === form.assetTypeId);

  const bodyById = (id: string) => bodies.find((b) => b.id === id);

  if (loading) {
    return (
      <div className="p-8 text-gray-500">Loading...</div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link href="/assets" className="text-sm text-blue-600 hover:underline mb-4 block">
          ← Back to Assets
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Asset</h1>

        {/* Step progress */}
        <div className="flex items-center mb-8">
          {([1, 2, 3, 4] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold border-2 ${
                  step === s
                    ? "bg-blue-600 border-blue-600 text-white"
                    : step > s
                    ? "bg-green-500 border-green-500 text-white"
                    : "bg-white border-gray-300 text-gray-400"
                }`}
              >
                {step > s ? "✓" : s}
              </div>
              <span
                className={`ml-2 text-xs font-medium hidden sm:block ${
                  step === s ? "text-blue-700" : step > s ? "text-green-700" : "text-gray-400"
                }`}
              >
                {STEP_TITLES[s]}
              </span>
              {i < 3 && (
                <div
                  className={`flex-1 h-0.5 mx-3 ${step > s ? "bg-green-400" : "bg-gray-200"}`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          {/* Step 1: Classification */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Step 1 — Classification</h2>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Asset Family <span className="text-red-500">*</span>
                </label>
                <select
                  className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.assetFamilyId ? "border-red-500" : "border-gray-300"
                  }`}
                  value={form.assetFamilyId}
                  onChange={(e) => {
                    setField("assetFamilyId", e.target.value);
                    setField("assetTypeId", "");
                  }}
                >
                  <option value="">Select a family...</option>
                  {families.filter((f) => f.isActive).map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                {errors.assetFamilyId && (
                  <p className="mt-1 text-xs text-red-600">{errors.assetFamilyId}</p>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Asset Type <span className="text-red-500">*</span>
                </label>
                <select
                  className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.assetTypeId ? "border-red-500" : "border-gray-300"
                  } ${!form.assetFamilyId ? "bg-gray-50 text-gray-400" : ""}`}
                  value={form.assetTypeId}
                  onChange={(e) => setField("assetTypeId", e.target.value)}
                  disabled={!form.assetFamilyId}
                >
                  <option value="">
                    {form.assetFamilyId ? "Select a type..." : "Select a family first"}
                  </option>
                  {availableTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {errors.assetTypeId && (
                  <p className="mt-1 text-xs text-red-600">{errors.assetTypeId}</p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Identity */}
          {step === 2 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Step 2 — Identity</h2>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Asset Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.assetName ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="e.g. Rabin Community Center"
                  value={form.assetName}
                  onChange={(e) => setField("assetName", e.target.value)}
                />
                {errors.assetName && (
                  <p className="mt-1 text-xs text-red-600">{errors.assetName}</p>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Asset Code{" "}
                  <span className="text-gray-400 text-xs font-normal">(auto-generated if blank)</span>
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. PB-2026-00042"
                  value={form.assetCode}
                  onChange={(e) => setField("assetCode", e.target.value)}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Ownership Model</label>
                <select
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={form.ownershipModel}
                  onChange={(e) => setField("ownershipModel", e.target.value)}
                >
                  <option value="">Not specified</option>
                  {OWNERSHIP_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Street address"
                  value={form.address}
                  onChange={(e) => setField("address", e.target.value)}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Area (m²)
                </label>
                <input
                  type="number"
                  className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.areaSqm ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="0.00"
                  value={form.areaSqm}
                  onChange={(e) => setField("areaSqm", e.target.value)}
                  min="0"
                  step="0.01"
                />
                {errors.areaSqm && (
                  <p className="mt-1 text-xs text-red-600">{errors.areaSqm}</p>
                )}
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Any additional notes..."
                  value={form.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 3: Responsibility */}
          {step === 3 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Step 3 — Responsibility</h2>
              <p className="text-sm text-gray-500 mb-4">
                Assign organizational bodies to each role. All fields are optional.
              </p>

              <BodySelect
                label="Strategic Owner"
                value={form.strategicOwnerBodyId}
                onChange={(v) => setField("strategicOwnerBodyId", v)}
                bodies={bodies}
                error={errors.strategicOwnerBodyId}
              />
              <BodySelect
                label="Responsible Body"
                value={form.responsibleBodyId}
                onChange={(v) => setField("responsibleBodyId", v)}
                bodies={bodies}
                error={errors.responsibleBodyId}
              />
              <BodySelect
                label="Operational Body"
                value={form.operationalBodyId}
                onChange={(v) => setField("operationalBodyId", v)}
                bodies={bodies}
                error={errors.operationalBodyId}
              />
              <BodySelect
                label="Maintenance Body"
                value={form.maintenanceBodyId}
                onChange={(v) => setField("maintenanceBodyId", v)}
                bodies={bodies}
                error={errors.maintenanceBodyId}
              />
              <BodySelect
                label="Data Steward"
                value={form.dataStewardBodyId}
                onChange={(v) => setField("dataStewardBodyId", v)}
                bodies={bodies}
                error={errors.dataStewardBodyId}
              />
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Step 4 — Review & Submit</h2>
              <p className="text-sm text-gray-500 mb-4">
                Please review the details before creating the asset.
              </p>

              <div className="space-y-4">
                <section>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Classification</h3>
                  <div className="bg-gray-50 rounded p-3 text-sm space-y-1">
                    <div><span className="text-gray-500">Family:</span>{" "}<span className="font-medium">{selectedFamily?.name ?? "—"}</span></div>
                    <div><span className="text-gray-500">Type:</span>{" "}<span className="font-medium">{selectedType?.name ?? "—"}</span></div>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Identity</h3>
                  <div className="bg-gray-50 rounded p-3 text-sm space-y-1">
                    <div><span className="text-gray-500">Name:</span>{" "}<span className="font-medium">{form.assetName || "—"}</span></div>
                    <div><span className="text-gray-500">Code:</span>{" "}<span className="font-mono">{form.assetCode || "(auto-generated)"}</span></div>
                    <div><span className="text-gray-500">Ownership:</span>{" "}<span>{form.ownershipModel ? OWNERSHIP_MODELS.find((m) => m.value === form.ownershipModel)?.label : "Not specified"}</span></div>
                    <div><span className="text-gray-500">Address:</span>{" "}<span>{form.address || "—"}</span></div>
                    <div><span className="text-gray-500">Area:</span>{" "}<span>{form.areaSqm ? `${form.areaSqm} m²` : "—"}</span></div>
                    {form.notes && <div><span className="text-gray-500">Notes:</span>{" "}<span>{form.notes}</span></div>}
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Responsibility</h3>
                  <div className="bg-gray-50 rounded p-3 text-sm space-y-1">
                    {[
                      { label: "Strategic Owner", id: form.strategicOwnerBodyId },
                      { label: "Responsible Body", id: form.responsibleBodyId },
                      { label: "Operational Body", id: form.operationalBodyId },
                      { label: "Maintenance Body", id: form.maintenanceBodyId },
                      { label: "Data Steward", id: form.dataStewardBodyId },
                    ].map(({ label, id }) => {
                      const body = bodyById(id);
                      return (
                        <div key={label}>
                          <span className="text-gray-500">{label}:</span>{" "}
                          {body ? (
                            <>
                              <span className="font-medium">{body.name}</span>
                              {body.isPlaceholder && (
                                <span className="ml-1 text-xs text-amber-600">⚠ Placeholder</span>
                              )}
                            </>
                          ) : (
                            <span className="italic text-gray-400">Not assigned</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-700">
                  The asset will be created with lifecycle stage <strong>Need Identification</strong> and status <strong>In Formation</strong>.
                </div>

                {errors.general && (
                  <div className="bg-red-50 border border-red-300 rounded p-3 text-sm text-red-700">
                    {errors.general}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
            <div>
              {step > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  ← Back
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <Link
                href="/assets"
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </Link>
              {step < 4 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Next →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-6 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {submitting ? "Creating..." : "Create Asset"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
