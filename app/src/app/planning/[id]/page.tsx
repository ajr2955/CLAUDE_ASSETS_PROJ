"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface PlanningEntityDetail {
  id: string;
  planningCode: string;
  name: string;
  status: string;
  targetDeliveryDate: string | null;
  intendedReceivingBodyIsPlaceholder: boolean;
  developerObligationId: string | null;
  developerObligations: DeveloperObligation[];
  assetFamily: { id: string; name: string };
  assetType: { id: string; name: string };
  planningBody: { id: string; name: string } | null;
  intendedReceivingBody: { id: string; name: string; isPlaceholder: boolean } | null;
  linkedAssetId: string | null;
  plannedAreaSqm: string | null;
  populationForecastNotes: string | null;
  serviceAreaDescription: string | null;
  currentPlanningMilestone: string | null;
  fundingSourceNotes: string | null;
  notes: string | null;
  createdAt: string;
}

interface DeveloperObligation {
  id: string;
  obligationReference: string;
  developerName: string;
  status: string;
}

interface Document {
  id: string;
  title: string;
  documentType: { name: string };
  createdAt: string;
}

interface Event {
  id: string;
  eventType: { name: string; category: string };
  occurredAt: string;
  description: string | null;
  isSystemGenerated: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  identified: "bg-gray-100 text-gray-700",
  in_planning: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  in_implementation: "bg-yellow-100 text-yellow-700",
  delivered: "bg-emerald-100 text-emerald-700",
  converted_to_asset: "bg-purple-100 text-purple-700",
};

const STATUS_ORDER = ["identified", "in_planning", "approved", "in_implementation", "delivered", "converted_to_asset"];

export default function PlanningEntityDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();

  const [entity, setEntity] = useState<PlanningEntityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "documents" | "events">("overview");

  const [showConvertModal, setShowConvertModal] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  const fetchEntity = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/planning-entities/${id}`);
      if (!res.ok) throw new Error("Not found");
      const json = await res.json();
      setEntity(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchEntity(); }, [fetchEntity]);

  useEffect(() => {
    if (!id) return;
    if (activeTab === "documents") {
      fetch(`/api/documents?attached_to_entity_type=planning_entity&attached_to_entity_id=${id}`)
        .then((r) => r.json()).then((j) => setDocuments(j.data ?? []));
    }
    if (activeTab === "events") {
      fetch(`/api/events?asset_id=${id}`)
        .then((r) => r.json()).then((j) => setEvents(j.data ?? []));
    }
  }, [activeTab, id]);

  const handleConvert = async () => {
    if (!id) return;
    setConverting(true);
    setConvertError(null);
    try {
      const res = await fetch(`/api/planning-entities/${id}/convert-to-asset`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) { setConvertError(json.error ?? "Error"); return; }
      setShowConvertModal(false);
      router.push(`/assets/${json.data.asset_id}`);
    } catch {
      setConvertError("Network error");
    } finally {
      setConverting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-400">Loading...</div>;
  if (error || !entity) return <div className="flex items-center justify-center min-h-screen text-red-500">{error ?? "Not found"}</div>;

  const currentStageIndex = STATUS_ORDER.indexOf(entity.status);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Link href="/" className="hover:text-gray-800">Home</Link>
          <span>/</span>
          <Link href="/planning" className="hover:text-gray-800">Planning Entities</Link>
          <span>/</span>
          <span className="text-gray-800">{entity.planningCode}</span>
        </div>

        {/* Placeholder warning */}
        {entity.intendedReceivingBodyIsPlaceholder && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <span className="text-amber-500 text-lg">⚠</span>
            <div>
              <p className="text-sm font-medium text-amber-800">Placeholder Receiving Body</p>
              <p className="text-xs text-amber-600">The intended receiving body for this planning entity is a placeholder — organizational ownership not yet resolved.</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{entity.planningCode}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[entity.status] ?? "bg-gray-100 text-gray-700"}`}>
                  {entity.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{entity.name}</h1>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="bg-violet-100 text-violet-700 px-2 py-0.5 rounded text-xs">{entity.assetFamily.name}</span>
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">{entity.assetType.name}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {entity.status !== "converted_to_asset" && (
                <button
                  onClick={() => setShowConvertModal(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  Convert to Asset
                </button>
              )}
              {entity.linkedAssetId && (
                <Link href={`/assets/${entity.linkedAssetId}`}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium">
                  View Asset →
                </Link>
              )}
            </div>
          </div>

          {/* Milestone progress bar */}
          <div className="mt-6">
            <div className="flex items-center">
              {STATUS_ORDER.map((s, i) => (
                <div key={s} className="flex items-center flex-1 last:flex-none">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                    ${i < currentStageIndex ? "bg-green-500 text-white" :
                      i === currentStageIndex ? "bg-blue-500 text-white ring-2 ring-blue-200" :
                      "bg-gray-200 text-gray-500"}`}>
                    {i < currentStageIndex ? "✓" : i + 1}
                  </div>
                  <div className={`h-1 flex-1 last:hidden ${i < currentStageIndex ? "bg-green-300" : "bg-gray-200"}`} />
                </div>
              ))}
            </div>
            <div className="flex mt-1">
              {STATUS_ORDER.map((s) => (
                <div key={s} className="flex-1 text-center text-xs text-gray-400 leading-tight px-0.5 truncate">
                  {s.replace(/_/g, " ")}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          {(["overview", "documents", "events"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize ${activeTab === tab ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
              {tab}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Planning Details</h3>
              <dl className="space-y-2">
                {[
                  ["Planning Body", entity.planningBody?.name ?? "—"],
                  ["Intended Receiving Body", entity.intendedReceivingBody ? `${entity.intendedReceivingBody.name}${entity.intendedReceivingBody.isPlaceholder ? " (TBD)" : ""}` : "—"],
                  ["Planned Area", entity.plannedAreaSqm ? `${entity.plannedAreaSqm} sqm` : "—"],
                  ["Target Delivery", entity.targetDeliveryDate ? new Date(entity.targetDeliveryDate).toLocaleDateString() : "—"],
                  ["Current Milestone", entity.currentPlanningMilestone ?? "—"],
                  ["Linked Asset", entity.linkedAssetId ? "Yes" : "—"],
                  ["Developer Obligations", entity.developerObligations.length > 0 ? entity.developerObligations.length.toString() : "None"],
                ].map(([label, value]) => (
                  <div key={label} className="flex">
                    <dt className="text-xs text-gray-500 w-40 flex-shrink-0">{label}</dt>
                    <dd className="text-xs text-gray-800">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Notes & Context</h3>
              <div className="space-y-3">
                {entity.populationForecastNotes && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Population Forecast Notes</p>
                    <p className="text-xs text-gray-700">{entity.populationForecastNotes}</p>
                  </div>
                )}
                {entity.serviceAreaDescription && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Service Area</p>
                    <p className="text-xs text-gray-700">{entity.serviceAreaDescription}</p>
                  </div>
                )}
                {entity.fundingSourceNotes && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Funding Source</p>
                    <p className="text-xs text-gray-700">{entity.fundingSourceNotes}</p>
                  </div>
                )}
                {entity.notes && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
                    <p className="text-xs text-gray-700">{entity.notes}</p>
                  </div>
                )}
                {!entity.populationForecastNotes && !entity.serviceAreaDescription && !entity.fundingSourceNotes && !entity.notes && (
                  <p className="text-xs text-gray-400">No notes</p>
                )}
              </div>
            </div>
            {entity.developerObligations.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-5 md:col-span-2">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Linked Developer Obligations</h3>
                <div className="space-y-2">
                  {entity.developerObligations.map((o) => (
                    <div key={o.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                      <div>
                        <span className="font-mono text-xs text-blue-600">{o.obligationReference}</span>
                        <span className="text-xs text-gray-600 ml-2">{o.developerName}</span>
                      </div>
                      <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">{o.status.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Documents tab */}
        {activeTab === "documents" && (
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            {documents.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No documents attached</p>
            ) : (
              <div className="space-y-2">
                {documents.map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200 text-sm">
                    <div>
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded mr-2">{d.documentType.name}</span>
                      {d.title}
                    </div>
                    <span className="text-xs text-gray-400">{new Date(d.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Events tab */}
        {activeTab === "events" && (
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            {events.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No events</p>
            ) : (
              <div className="space-y-3">
                {events.map((ev) => (
                  <div key={ev.id} className="flex gap-3 text-sm">
                    <div className="text-gray-400 text-xs w-32 flex-shrink-0 pt-0.5">
                      {new Date(ev.occurredAt).toLocaleDateString()}
                    </div>
                    <div>
                      <span className="font-medium text-gray-800">{ev.eventType.name.replace(/_/g, " ")}</span>
                      {ev.description && <p className="text-xs text-gray-500 mt-0.5">{ev.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Convert to Asset Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Convert to Asset</h2>
            <div className="bg-gray-50 rounded-lg p-4 mb-4 text-sm text-gray-700">
              <p className="font-medium mb-2">The following asset will be created:</p>
              <ul className="space-y-1 text-xs text-gray-600">
                <li>• Name: <strong>{entity.name}</strong></li>
                <li>• Family: <strong>{entity.assetFamily.name}</strong></li>
                <li>• Type: <strong>{entity.assetType.name}</strong></li>
                <li>• Lifecycle Stage: <strong>Establishment / Implementation / Intake</strong></li>
                <li>• Status: <strong>In Formation</strong></li>
                {entity.planningBody && <li>• Responsible Body: <strong>{entity.planningBody.name}</strong></li>}
              </ul>
            </div>
            {convertError && <p className="text-red-500 text-sm mb-3">{convertError}</p>}
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowConvertModal(false); setConvertError(null); }}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleConvert} disabled={converting}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                {converting ? "Converting..." : "Confirm Convert"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
