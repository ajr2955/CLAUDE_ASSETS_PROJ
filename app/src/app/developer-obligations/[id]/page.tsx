"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Milestone {
  milestone_name: string;
  target_date: string | null;
  actual_date: string | null;
  status: string;
}

interface ObligationDetail {
  id: string;
  obligationReference: string;
  relatedProjectName: string;
  developerName: string;
  status: string;
  fundingModel: string | null;
  committedFundingAmount: number | null;
  committedAreaSqm: number | null;
  committedDeliveryDate: string | null;
  actualDeliveryDate: string | null;
  gapsIdentified: string | null;
  receivingBodyIsPlaceholder: boolean;
  deliveryMilestones: Milestone[] | null;
  notes: string | null;
  createdAt: string;
  promisedAssetFamily: { id: string; name: string };
  promisedAssetType: { id: string; name: string };
  receivingBody: { id: string; name: string; isPlaceholder: boolean } | null;
  planningEntity: { id: string; name: string; planningCode: string; status: string } | null;
}

interface DocumentRecord {
  id: string;
  title: string;
  fileName: string;
  fileUrl: string;
  createdAt: string;
  isVerified: boolean;
  documentType: { name: string };
}

interface EventRecord {
  id: string;
  occurredAt: string;
  description: string | null;
  isSystemGenerated: boolean;
  eventType: { name: string; category: string };
  responsibleBody: { name: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  delivered: "Delivered",
  partially_delivered: "Partially Delivered",
  in_dispute: "In Dispute",
  closed_gap_identified: "Closed - Gap Identified",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  delivered: "bg-green-100 text-green-700",
  partially_delivered: "bg-orange-100 text-orange-700",
  in_dispute: "bg-red-100 text-red-700",
  closed_gap_identified: "bg-gray-100 text-gray-700",
};

const FUNDING_LABELS: Record<string, string> = {
  developer_builds: "Developer Builds",
  developer_funds_municipality_builds: "Developer Funds - Municipality Builds",
  combined: "Combined",
  land_only: "Land Only",
};

const CATEGORY_COLORS: Record<string, string> = {
  business: "bg-blue-100 text-blue-700",
  operational: "bg-green-100 text-green-700",
  governance: "bg-purple-100 text-purple-700",
};

function fmtDate(d: string | null) {
  if (!d) return "N/A";
  return new Date(d).toLocaleDateString();
}

type ActiveTab = "overview" | "milestones" | "documents" | "events";

export default function DeveloperObligationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [obligation, setObligation] = useState<ObligationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [showFlagGap, setShowFlagGap] = useState(false);
  const [gapText, setGapText] = useState("");
  const [gapSubmitting, setGapSubmitting] = useState(false);
  const [gapError, setGapError] = useState<string | null>(null);

  const fetchObligation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/developer-obligations/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setObligation(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading obligation");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchDocuments = useCallback(async () => {
    setDocsLoading(true);
    try {
      const res = await fetch(`/api/documents?attached_to_entity_type=developer_obligation&attached_to_entity_id=${id}&per_page=50`);
      const json = await res.json();
      setDocuments(json.data ?? []);
    } catch {
      // silent
    } finally {
      setDocsLoading(false);
    }
  }, [id]);

  const fetchEvents = useCallback(async (pg: number) => {
    setEventsLoading(true);
    try {
      const sp = new URLSearchParams({ page: String(pg), per_page: "20" });
      const res = await fetch(`/api/events?${sp}`);
      const json = await res.json();
      if (pg === 1) {
        setEvents(json.data ?? []);
      } else {
        setEvents(prev => [...prev, ...(json.data ?? [])]);
      }
      setEventsTotal(json.meta?.total ?? 0);
    } catch {
      // silent
    } finally {
      setEventsLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchObligation(); }, [fetchObligation]);

  useEffect(() => {
    if (activeTab === "documents") fetchDocuments();
    if (activeTab === "events") { setEventsPage(1); fetchEvents(1); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleFlagGap = async () => {
    if (!gapText.trim()) return;
    setGapSubmitting(true);
    setGapError(null);
    try {
      const res = await fetch(`/api/developer-obligations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gaps_identified: gapText.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to flag gap");
      setShowFlagGap(false);
      setGapText("");
      fetchObligation();
    } catch (e) {
      setGapError(e instanceof Error ? e.message : "Error");
    } finally {
      setGapSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (error || !obligation) return (
    <div className="p-8">
      <div className="bg-red-50 text-red-700 border border-red-200 rounded p-4">{error ?? "Obligation not found"}</div>
      <Link href="/developer-obligations" className="mt-4 inline-block text-blue-600 hover:underline text-sm">Back to list</Link>
    </div>
  );

  const milestones: Milestone[] = Array.isArray(obligation.deliveryMilestones) ? obligation.deliveryMilestones : [];

  const getMilestoneStatus = (m: Milestone): "completed" | "overdue" | "pending" => {
    if (m.actual_date) return "completed";
    if (m.target_date && new Date(m.target_date) < new Date()) return "overdue";
    return "pending";
  };

  const TABS: { key: ActiveTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "milestones", label: `Milestones (${milestones.length})` },
    { key: "documents", label: "Documents" },
    { key: "events", label: "Events" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/developer-obligations" className="text-blue-600 hover:underline text-sm mb-4 inline-block">
        Back to Developer Obligations
      </Link>

      {obligation.receivingBodyIsPlaceholder && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 flex items-start gap-3">
          <span className="text-amber-500 font-bold text-lg mt-0.5">!</span>
          <div>
            <p className="font-semibold text-amber-800">Open Decision: Receiving Body Not Yet Resolved</p>
            <p className="text-amber-700 text-sm mt-1">
              This obligation is assigned to a placeholder receiving body.
              The organizational ownership decision is pending formal resolution.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white border rounded-lg p-6 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-gray-500 text-sm">{obligation.obligationReference}</span>
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[obligation.status] ?? "bg-gray-100 text-gray-700"}`}>
                {STATUS_LABELS[obligation.status] ?? obligation.status}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900">{obligation.relatedProjectName}</h1>
            <p className="text-gray-500 text-sm mt-1">{obligation.developerName}</p>
          </div>
          <button
            onClick={() => { setShowFlagGap(true); setGapText(obligation.gapsIdentified ?? ""); }}
            className="px-3 py-2 border border-red-300 text-red-600 rounded text-sm hover:bg-red-50"
          >
            Flag Gap
          </button>
        </div>

        {obligation.gapsIdentified && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
            <strong>Gap Identified:</strong> {obligation.gapsIdentified}
          </div>
        )}
      </div>

      <div className="border-b mb-4 flex gap-4">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${activeTab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Obligation Details</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="w-44 text-gray-500 shrink-0">Promised Asset Type</dt>
                <dd className="text-gray-900">{obligation.promisedAssetType.name} ({obligation.promisedAssetFamily.name})</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-44 text-gray-500 shrink-0">Funding Model</dt>
                <dd className="text-gray-900">{obligation.fundingModel ? FUNDING_LABELS[obligation.fundingModel] ?? obligation.fundingModel : "N/A"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-44 text-gray-500 shrink-0">Committed Funding</dt>
                <dd className="text-gray-900">{obligation.committedFundingAmount != null ? obligation.committedFundingAmount.toLocaleString() : "N/A"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-44 text-gray-500 shrink-0">Committed Area (sqm)</dt>
                <dd className="text-gray-900">{obligation.committedAreaSqm != null ? String(obligation.committedAreaSqm) : "N/A"}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-44 text-gray-500 shrink-0">Committed Delivery</dt>
                <dd className={obligation.committedDeliveryDate && new Date(obligation.committedDeliveryDate) < new Date() && obligation.status !== "delivered" ? "text-red-600 font-medium" : "text-gray-900"}>
                  {fmtDate(obligation.committedDeliveryDate)}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-44 text-gray-500 shrink-0">Actual Delivery</dt>
                <dd className="text-gray-900">{fmtDate(obligation.actualDeliveryDate)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-44 text-gray-500 shrink-0">Created</dt>
                <dd className="text-gray-900">{fmtDate(obligation.createdAt)}</dd>
              </div>
            </dl>
          </div>

          <div className="space-y-4">
            <div className="bg-white border rounded-lg p-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Receiving Body</h2>
              {obligation.receivingBody ? (
                <div className="text-sm">
                  <p className="text-gray-900 font-medium">{obligation.receivingBody.name}</p>
                  {obligation.receivingBody.isPlaceholder && (
                    <span className="mt-1 inline-block text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Placeholder</span>
                  )}
                </div>
              ) : (
                <p className="text-gray-400 text-sm italic">Not assigned</p>
              )}
            </div>

            {obligation.planningEntity && (
              <div className="bg-white border rounded-lg p-4">
                <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Linked Planning Entity</h2>
                <Link href={`/planning/${obligation.planningEntity.id}`} className="text-blue-600 hover:underline text-sm font-medium">
                  {obligation.planningEntity.planningCode} - {obligation.planningEntity.name}
                </Link>
                <p className="text-xs text-gray-500 mt-1">Status: {obligation.planningEntity.status}</p>
              </div>
            )}

            {obligation.notes && (
              <div className="bg-white border rounded-lg p-4">
                <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Notes</h2>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{obligation.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "milestones" && (
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-4">Delivery Milestones</h2>
          {milestones.length === 0 ? (
            <p className="text-gray-400 text-sm italic">No milestones defined.</p>
          ) : (
            <div className="relative">
              {milestones.map((m, idx) => {
                const ms = getMilestoneStatus(m);
                return (
                  <div key={idx} className="flex gap-4 mb-6 relative">
                    {idx < milestones.length - 1 && (
                      <div className="absolute left-4 top-8 bottom-0 w-px bg-gray-200" />
                    )}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 text-white text-sm font-bold ${ms === "completed" ? "bg-green-500" : ms === "overdue" ? "bg-red-500" : "bg-gray-300"}`}>
                      {ms === "completed" ? "v" : ms === "overdue" ? "!" : String(idx + 1)}
                    </div>
                    <div className="flex-1 bg-gray-50 border rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <p className="font-medium text-sm text-gray-900">{m.milestone_name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ms === "completed" ? "bg-green-100 text-green-700" : ms === "overdue" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                          {ms === "completed" ? "Completed" : ms === "overdue" ? "Overdue" : "Pending"}
                        </span>
                      </div>
                      <div className="mt-2 flex gap-6 text-xs text-gray-500">
                        <span>Target: <span className={ms === "overdue" ? "text-red-600 font-medium" : "text-gray-700"}>{fmtDate(m.target_date)}</span></span>
                        <span>Actual: <span className={m.actual_date ? "text-green-600 font-medium" : "text-gray-400"}>{fmtDate(m.actual_date)}</span></span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "documents" && (
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-4">Documents</h2>
          {docsLoading ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : documents.length === 0 ? (
            <p className="text-gray-400 text-sm italic">No documents attached.</p>
          ) : (
            <div className="space-y-2">
              {documents.map(doc => (
                <div key={doc.id} className="flex items-center justify-between border rounded p-3 text-sm">
                  <div>
                    <span className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded mr-2">{doc.documentType.name}</span>
                    <span className="text-gray-900">{doc.title}</span>
                    {doc.isVerified && <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Verified</span>}
                  </div>
                  <div className="flex items-center gap-3 text-gray-400 text-xs">
                    <span>{doc.fileName}</span>
                    <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                    <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Download</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "events" && (
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-4">Events</h2>
          {eventsLoading && events.length === 0 ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : events.length === 0 ? (
            <p className="text-gray-400 text-sm italic">No events found.</p>
          ) : (
            <>
              <div className="space-y-3">
                {events.map(ev => (
                  <div key={ev.id} className="border rounded p-3 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      {ev.isSystemGenerated && <span className="text-gray-400 text-xs">[system]</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[ev.eventType.category] ?? "bg-gray-100 text-gray-700"}`}>
                        {ev.eventType.category}
                      </span>
                      <span className="font-medium text-gray-800">{ev.eventType.name.replace(/_/g, " ")}</span>
                      <span className="ml-auto text-gray-400 text-xs">{new Date(ev.occurredAt).toLocaleDateString()}</span>
                    </div>
                    {ev.description && <p className="text-gray-600 text-xs">{ev.description}</p>}
                  </div>
                ))}
              </div>
              {events.length < eventsTotal && (
                <button
                  onClick={() => { const next = eventsPage + 1; setEventsPage(next); fetchEvents(next); }}
                  className="mt-4 text-sm text-blue-600 hover:underline"
                >
                  Load more ({eventsTotal - events.length} remaining)
                </button>
              )}
            </>
          )}
        </div>
      )}

      {showFlagGap && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Flag Delivery Gap</h2>
            <p className="text-sm text-gray-600 mb-3">Describe the gap between what was promised and what was delivered.</p>
            <textarea
              value={gapText}
              onChange={e => setGapText(e.target.value)}
              rows={4}
              placeholder="Describe the gap..."
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {gapError && <p className="text-red-600 text-sm mt-2">{gapError}</p>}
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => { setShowFlagGap(false); setGapText(""); setGapError(null); }}
                className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleFlagGap}
                disabled={gapSubmitting || !gapText.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {gapSubmitting ? "Saving..." : "Flag Gap"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
