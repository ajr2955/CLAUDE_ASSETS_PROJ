"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const BUDGET_TYPES = [
  "capex", "opex", "renewal_reserve", "external_funding", "developer_funded",
  "lease_income", "service_charges", "maintenance_reserve", "adjustment", "equipment",
] as const;

interface ResponsibleBodyRef {
  id: string;
  name: string;
  bodyType: string;
  isPlaceholder: boolean;
}

interface LifecycleStage {
  id: string;
  name: string;
  displayOrder: number;
}

interface LifecycleTransition {
  id: string;
  fromStageId: string;
  toStageId: string;
  toStage: { id: string; name: string; displayOrder: number };
  requiredDocumentTypes: string[] | null;
  requiredEvents: string[] | null;
  warningMessage: string | null;
}

interface TransitionWarning {
  type: "document" | "event";
  description: string;
}

interface AssetDetail {
  id: string;
  assetCode: string;
  assetName: string;
  currentStatus: string;
  ownershipModel: string | null;
  isPlaceholderBody: boolean;
  assetFamily: { id: string; name: string } | null;
  assetType: { id: string; name: string } | null;
  currentLifecycleStage: { id: string; name: string; displayOrder: number } | null;
  strategicOwnerBody: ResponsibleBodyRef | null;
  responsibleBody: ResponsibleBodyRef | null;
  operationalBody: ResponsibleBodyRef | null;
  maintenanceBody: ResponsibleBodyRef | null;
  dataStewardBody: ResponsibleBodyRef | null;
  address: string | null;
  areaSqm: string | null;
  serviceStartDate: string | null;
  handoverDate: string | null;
  decommissionDate: string | null;
  notes: string | null;
  gisReference: string | null;
  budgetEnvelopes: Array<{ id: string; budgetType: string; isClosed: boolean }>;
  events: unknown[];
  parentAsset: { id: string; assetCode: string; assetName: string } | null;
  childAssets: { id: string; assetCode: string; assetName: string; currentStatus: string }[];
  document_counts: { document_type_id: string; document_type_name: string | null; count: number }[];
}

interface BudgetEnvelope {
  id: string;
  budgetType: string;
  fiscalYear: number | null;
  isMultiYear: boolean;
  multiYearStart: number | null;
  multiYearEnd: number | null;
  approvedAmount: string;
  committedAmount: string;
  actualAmount: string;
  varianceAmount: string;
  isClosed: boolean;
  lifecycleStage: { id: string; name: string } | null;
  responsibleBody: { id: string; name: string } | null;
  notes: string | null;
  externalSourceDescription: string | null;
}

interface BudgetGroup {
  budget_type: string;
  envelopes: BudgetEnvelope[];
  totals: { approved: number; committed: number; actual: number; variance: number };
}

interface BudgetData {
  groups: BudgetGroup[];
  grand_totals: { approved: number; committed: number; actual: number; variance: number };
}

interface DocumentType {
  id: string;
  name: string;
  description: string | null;
}

interface DocumentRecord {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fileName: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  isRequired: boolean;
  isVerified: boolean;
  verifiedAt: string | null;
  expiryDate: string | null;
  isDeleted: boolean;
  createdAt: string;
  documentType: { id: string; name: string } | null;
  lifecycleStage: { id: string; name: string } | null;
}

interface UploadDocForm {
  document_type_id: string;
  title: string;
  lifecycle_stage_id: string;
  expiry_date: string;
  description: string;
}

interface EventType {
  id: string;
  name: string;
  category: string;
  description: string | null;
}

interface EventRecord {
  id: string;
  occurredAt: string;
  createdAt: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  isSystemGenerated: boolean;
  recordedByUserId: string | null;
  eventType: { id: string; name: string; category: string } | null;
  lifecycleStage: { id: string; name: string } | null;
  responsibleBody: { id: string; name: string } | null;
}

interface AddEventForm {
  event_type_id: string;
  occurred_at: string;
  description: string;
  responsible_body_id: string;
}

interface AddEnvelopeForm {
  budget_type: string;
  lifecycle_stage_id: string;
  fiscal_year: string;
  is_multi_year: boolean;
  multi_year_start: string;
  multi_year_end: string;
  approved_amount: string;
  committed_amount: string;
  actual_amount: string;
  notes: string;
}

interface ContractType {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

interface ContractRecord {
  id: string;
  contractReference: string | null;
  counterpartyName: string;
  counterpartyType: string;
  status: string;
  startDate: string;
  endDate: string | null;
  contractValue: string | null;
  periodicAmount: string | null;
  paymentFrequency: string | null;
  renewalOption: boolean;
  autoRenewal: boolean;
  noticePeriodDays: number | null;
  slaDescription: string | null;
  notes: string | null;
  createdAt: string;
  contractType: { id: string; name: string } | null;
  responsibleBody: { id: string; name: string } | null;
}

interface AddContractForm {
  contract_type_id: string;
  counterparty_name: string;
  counterparty_type: string;
  start_date: string;
  end_date: string;
  contract_value: string;
  periodic_amount: string;
  payment_frequency: string;
  renewal_option: boolean;
  auto_renewal: boolean;
  notice_period_days: string;
  notes: string;
}

interface WorkOrderCategoryRef {
  id: string;
  name: string;
}

interface AssetWorkOrder {
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
  category: WorkOrderCategoryRef | null;
  assignedToBody: { id: string; name: string } | null;
  lifecycleStage: { id: string; name: string } | null;
}

interface CreateWOForm {
  category_id: string;
  title: string;
  description: string;
  priority: string;
  target_completion_date: string;
  notes: string;
}

interface ConditionRecord {
  id: string;
  inspectionDate: string;
  conditionScore: number;
  structuralCondition: string | null;
  safetyCondition: string | null;
  maintenancePriority: string | null;
  replacementUrgency: string | null;
  notes: string | null;
  nextInspectionDue: string | null;
  createdAt: string;
  inspectedByBody: { id: string; name: string } | null;
}

interface RecordInspectionForm {
  inspection_date: string;
  condition_score: string;
  structural_condition: string;
  safety_condition: string;
  maintenance_priority: string;
  replacement_urgency: string;
  notes: string;
  next_inspection_due: string;
}

interface HandoverRecord {
  id: string;
  handoverDate: string;
  handoverStatus: string;
  acceptedWithConditionsFlag: boolean;
  conditionsDescription: string | null;
  warrantyExpiryDate: string | null;
  defectsList: Array<{ description: string; severity: string; resolved: boolean }> | null;
  missingDocuments: string[] | null;
  notes: string | null;
  createdAt: string;
  deliveredByBody: { id: string; name: string } | null;
  receivedByBody: { id: string; name: string } | null;
}

interface CreateHandoverForm {
  delivered_by_body_id: string;
  received_by_body_id: string;
  handover_date: string;
  warranty_expiry_date: string;
  notes: string;
  missing_documents: string;
}

interface HandoverDefect {
  description: string;
  severity: string;
  resolved: boolean;
}

interface BodyTransfer {
  id: string;
  transferType: string;
  fromBody: { id: string; name: string } | null;
  toBody: { id: string; name: string } | null;
  reason: string;
  createdAt: string;
}

interface RevenueRecord {
  id: string;
  revenueType: string;
  periodStart: string;
  periodEnd: string;
  expectedAmount: string;
  actualAmount: string;
  paymentDate: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  allocation: { id: string; allocatedToName: string | null; allocatedToBody: { name: string } | null } | null;
  contract: { id: string; contractReference: string | null; counterpartyName: string } | null;
}

interface RevenueSummary {
  total_expected_ytd: number;
  total_received_ytd: number;
  total_overdue_ytd: number;
}

interface AddRevenueForm {
  revenue_type: string;
  period_start: string;
  period_end: string;
  expected_amount: string;
  actual_amount: string;
  allocation_id: string;
  contract_id: string;
  notes: string;
}

interface MarkReceivedForm {
  actual_amount: string;
  payment_date: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-700",
  in_formation: "bg-blue-100 text-blue-800",
  in_construction: "bg-yellow-100 text-yellow-800",
  decommissioned: "bg-orange-100 text-orange-800",
  disposed: "bg-red-100 text-red-800",
};

const OWNERSHIP_COLORS: Record<string, string> = {
  owned: "bg-purple-100 text-purple-800",
  leased_in: "bg-sky-100 text-sky-800",
  leased_out: "bg-teal-100 text-teal-800",
  allocated: "bg-indigo-100 text-indigo-800",
  developer_obligation: "bg-pink-100 text-pink-800",
  partnership: "bg-amber-100 text-amber-800",
};

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

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  );
}

function BodyCard({ role, body }: { role: string; body: ResponsibleBodyRef | null }) {
  return (
    <div className="border rounded p-3 bg-white">
      <p className="text-xs text-gray-500 mb-1">{role}</p>
      {body ? (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800">{body.name}</span>
          {body.isPlaceholder && (
            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
              TBD
            </span>
          )}
        </div>
      ) : (
        <span className="text-sm text-gray-400 italic">Not assigned</span>
      )}
    </div>
  );
}

// Toast notification component
function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded shadow-lg text-sm font-medium text-white flex items-center gap-3 ${
        type === "success" ? "bg-green-600" : "bg-red-600"
      }`}
    >
      <span>{message}</span>
      <button onClick={onClose} className="opacity-70 hover:opacity-100">✕</button>
    </div>
  );
}

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [stages, setStages] = useState<LifecycleStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<"overview" | "budgets" | "documents" | "events" | "contracts" | "work_orders" | "condition" | "handover" | "revenue">("overview");

  // Budget tab state
  const [budgetData, setBudgetData] = useState<BudgetData | null>(null);
  const [budgetsLoading, setBudgetsLoading] = useState(false);
  const [budgetsError, setBudgetsError] = useState<string | null>(null);
  const [showAddEnvelope, setShowAddEnvelope] = useState(false);
  const [addEnvelopeForm, setAddEnvelopeForm] = useState<AddEnvelopeForm>({
    budget_type: "capex",
    lifecycle_stage_id: "",
    fiscal_year: "",
    is_multi_year: false,
    multi_year_start: "",
    multi_year_end: "",
    approved_amount: "0",
    committed_amount: "0",
    actual_amount: "0",
    notes: "",
  });
  const [addEnvelopeErrors, setAddEnvelopeErrors] = useState<Partial<Record<keyof AddEnvelopeForm, string>>>({});
  const [addEnvelopeSubmitting, setAddEnvelopeSubmitting] = useState(false);
  const [addEnvelopeGeneralError, setAddEnvelopeGeneralError] = useState<string | null>(null);
  // Inline edit: key = envelope id, value = { approved, committed, actual }
  const [inlineEdit, setInlineEdit] = useState<Record<string, { approved: string; committed: string; actual: string }>>({});
  const [inlineEditSaving, setInlineEditSaving] = useState<Record<string, boolean>>({});

  // Document tab state
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDragOver, setUploadDragOver] = useState(false);
  const [uploadForm, setUploadForm] = useState<UploadDocForm>({
    document_type_id: "",
    title: "",
    lifecycle_stage_id: "",
    expiry_date: "",
    description: "",
  });
  const [uploadErrors, setUploadErrors] = useState<Partial<Record<keyof UploadDocForm | "file", string>>>({});
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [uploadGeneralError, setUploadGeneralError] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [verifyingDocId, setVerifyingDocId] = useState<string | null>(null);
  const [confirmDeleteDocId, setConfirmDeleteDocId] = useState<string | null>(null);

  // Events tab state
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [eventsFilter, setEventsFilter] = useState<{ category: string; dateFrom: string; dateTo: string }>({ category: "", dateFrom: "", dateTo: "" });
  const [addEventForm, setAddEventForm] = useState<AddEventForm>({ event_type_id: "", occurred_at: "", description: "", responsible_body_id: "" });
  const [addEventErrors, setAddEventErrors] = useState<Partial<Record<keyof AddEventForm, string>>>({});
  const [addEventSubmitting, setAddEventSubmitting] = useState(false);
  const [addEventGeneralError, setAddEventGeneralError] = useState<string | null>(null);

  // Contracts tab state
  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [contractsError, setContractsError] = useState<string | null>(null);
  const [contractTypes, setContractTypes] = useState<ContractType[]>([]);
  const [showAddContractModal, setShowAddContractModal] = useState(false);
  const [addContractForm, setAddContractForm] = useState<AddContractForm>({
    contract_type_id: "",
    counterparty_name: "",
    counterparty_type: "other",
    start_date: "",
    end_date: "",
    contract_value: "",
    periodic_amount: "",
    payment_frequency: "",
    renewal_option: false,
    auto_renewal: false,
    notice_period_days: "",
    notes: "",
  });
  const [addContractErrors, setAddContractErrors] = useState<Partial<Record<keyof AddContractForm, string>>>({});
  const [addContractSubmitting, setAddContractSubmitting] = useState(false);
  const [addContractGeneralError, setAddContractGeneralError] = useState<string | null>(null);
  // Edit contract modal
  const [editContract, setEditContract] = useState<ContractRecord | null>(null);
  const [editContractForm, setEditContractForm] = useState<AddContractForm>({
    contract_type_id: "",
    counterparty_name: "",
    counterparty_type: "other",
    start_date: "",
    end_date: "",
    contract_value: "",
    periodic_amount: "",
    payment_frequency: "",
    renewal_option: false,
    auto_renewal: false,
    notice_period_days: "",
    notes: "",
  });
  const [editContractSubmitting, setEditContractSubmitting] = useState(false);
  const [editContractGeneralError, setEditContractGeneralError] = useState<string | null>(null);
  // Renew contract modal
  const [renewContract, setRenewContract] = useState<ContractRecord | null>(null);
  const [renewStartDate, setRenewStartDate] = useState("");
  const [renewEndDate, setRenewEndDate] = useState("");
  const [renewSubmitting, setRenewSubmitting] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);
  // Expanded history rows
  const [expandedContractIds, setExpandedContractIds] = useState<Set<string>>(new Set());
  const [contractHistory, setContractHistory] = useState<Record<string, ContractRecord[]>>({});

  // Work Orders tab state
  const [assetWorkOrders, setAssetWorkOrders] = useState<AssetWorkOrder[]>([]);
  const [woTotal, setWoTotal] = useState(0);
  const [woLoading, setWoLoading] = useState(false);
  const [woError, setWoError] = useState<string | null>(null);
  const [woCategories, setWoCategories] = useState<WorkOrderCategoryRef[]>([]);
  const [showCreateWO, setShowCreateWO] = useState(false);
  const [createWOForm, setCreateWOForm] = useState<CreateWOForm>({
    category_id: "",
    title: "",
    description: "",
    priority: "medium",
    target_completion_date: "",
    notes: "",
  });
  const [createWOErrors, setCreateWOErrors] = useState<Partial<Record<keyof CreateWOForm, string>>>({});
  const [createWOSubmitting, setCreateWOSubmitting] = useState(false);
  const [createWOGeneralError, setCreateWOGeneralError] = useState<string | null>(null);
  const [selectedWO, setSelectedWO] = useState<AssetWorkOrder | null>(null);

  // Condition tab state
  const [conditionRecords, setConditionRecords] = useState<ConditionRecord[]>([]);
  const [conditionLoading, setConditionLoading] = useState(false);
  const [conditionError, setConditionError] = useState<string | null>(null);
  const [currentCondition, setCurrentCondition] = useState<ConditionRecord | null>(null);
  const [showRecordInspection, setShowRecordInspection] = useState(false);
  const [recordInspectionForm, setRecordInspectionForm] = useState<RecordInspectionForm>({
    inspection_date: "",
    condition_score: "3",
    structural_condition: "",
    safety_condition: "",
    maintenance_priority: "none",
    replacement_urgency: "none",
    notes: "",
    next_inspection_due: "",
  });
  const [recordInspectionErrors, setRecordInspectionErrors] = useState<Partial<Record<keyof RecordInspectionForm, string>>>({});
  const [recordInspectionSubmitting, setRecordInspectionSubmitting] = useState(false);
  const [recordInspectionGeneralError, setRecordInspectionGeneralError] = useState<string | null>(null);

  // Handover tab state
  const [handoverRecords, setHandoverRecords] = useState<HandoverRecord[]>([]);
  const [handoverLoading, setHandoverLoading] = useState(false);
  const [handoverError, setHandoverError] = useState<string | null>(null);
  const [showCreateHandover, setShowCreateHandover] = useState(false);
  const [createHandoverForm, setCreateHandoverForm] = useState<CreateHandoverForm>({
    delivered_by_body_id: "",
    received_by_body_id: "",
    handover_date: "",
    warranty_expiry_date: "",
    notes: "",
    missing_documents: "",
  });
  const [handoverDefects, setHandoverDefects] = useState<HandoverDefect[]>([]);
  const [createHandoverErrors, setCreateHandoverErrors] = useState<Partial<Record<keyof CreateHandoverForm, string>>>({});
  const [createHandoverSubmitting, setCreateHandoverSubmitting] = useState(false);
  const [createHandoverGeneralError, setCreateHandoverGeneralError] = useState<string | null>(null);
  const [expandedHandoverIds, setExpandedHandoverIds] = useState<Set<string>>(new Set());
  // Accept/Reject handover
  const [acceptingHandover, setAcceptingHandover] = useState<HandoverRecord | null>(null);
  const [acceptWithConditions, setAcceptWithConditions] = useState(false);
  const [acceptConditionsText, setAcceptConditionsText] = useState("");
  const [acceptSubmitting, setAcceptSubmitting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [rejectingHandover, setRejectingHandover] = useState<HandoverRecord | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Body assignment edit state
  const [showEditAssignments, setShowEditAssignments] = useState(false);
  const [allBodies, setAllBodies] = useState<ResponsibleBodyRef[]>([]);
  const [bodiesLoaded, setBodiesLoaded] = useState(false);
  const [bodySearchQuery, setBodySearchQuery] = useState<Record<string, string>>({});
  const [bodySearchOpen, setBodySearchOpen] = useState<Record<string, boolean>>({});
  const [pendingBodyTransfer, setPendingBodyTransfer] = useState<{
    transferType: string;
    roleLabel: string;
    fromBody: ResponsibleBodyRef | null;
    toBody: ResponsibleBodyRef;
  } | null>(null);
  const [bodyTransferReason, setBodyTransferReason] = useState("");
  const [bodyTransferSubmitting, setBodyTransferSubmitting] = useState(false);
  const [bodyTransferError, setBodyTransferError] = useState<string | null>(null);
  const [bodyTransferHistory, setBodyTransferHistory] = useState<BodyTransfer[]>([]);
  const [showBodyHistory, setShowBodyHistory] = useState(false);
  const [bodyHistoryLoading, setBodyHistoryLoading] = useState(false);

  // Revenue tab state
  const [revenueRecords, setRevenueRecords] = useState<RevenueRecord[]>([]);
  const [revenueSummary, setRevenueSummary] = useState<RevenueSummary | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [revenueError, setRevenueError] = useState<string | null>(null);
  const [showAddRevenue, setShowAddRevenue] = useState(false);
  const [addRevenueForm, setAddRevenueForm] = useState<AddRevenueForm>({
    revenue_type: "lease_income",
    period_start: "",
    period_end: "",
    expected_amount: "",
    actual_amount: "",
    allocation_id: "",
    contract_id: "",
    notes: "",
  });
  const [addRevenueErrors, setAddRevenueErrors] = useState<Partial<Record<keyof AddRevenueForm, string>>>({});
  const [addRevenueSubmitting, setAddRevenueSubmitting] = useState(false);
  const [addRevenueGeneralError, setAddRevenueGeneralError] = useState<string | null>(null);
  const [markReceivingRecord, setMarkReceivingRecord] = useState<RevenueRecord | null>(null);
  const [markReceivedForm, setMarkReceivedForm] = useState<MarkReceivedForm>({ actual_amount: "", payment_date: "" });
  const [markReceivedSubmitting, setMarkReceivedSubmitting] = useState(false);
  const [markReceivedError, setMarkReceivedError] = useState<string | null>(null);

  // Transition panel state
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [availableTransitions, setAvailableTransitions] = useState<LifecycleTransition[]>([]);
  const [transitionsLoading, setTransitionsLoading] = useState(false);
  const [selectedTransition, setSelectedTransition] = useState<LifecycleTransition | null>(null);
  const [transitionWarnings, setTransitionWarnings] = useState<TransitionWarning[]>([]);
  const [transitionWarningMessage, setTransitionWarningMessage] = useState<string>("");
  const [justification, setJustification] = useState("");
  const [justificationError, setJustificationError] = useState("");
  const [transitionSubmitting, setTransitionSubmitting] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Stable ref so handleTransitionConfirm can call fetchData without circular dep
  const fetchDataRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const closeToast = useCallback(() => setToast(null), []);

  const openTransitionModal = useCallback(async () => {
    if (!asset) return;
    setShowTransitionModal(true);
    setSelectedTransition(null);
    setTransitionWarnings([]);
    setTransitionWarningMessage("");
    setJustification("");
    setJustificationError("");
    setTransitionError(null);
    setTransitionsLoading(true);
    try {
      const qs = new URLSearchParams();
      if (asset.currentLifecycleStage) qs.set("from_stage_id", asset.currentLifecycleStage.id);
      if (asset.assetFamily) qs.set("family_id", asset.assetFamily.id);
      const res = await fetch(`/api/lifecycle-transitions?${qs}`);
      const json = await res.json();
      if (json.data) {
        setAvailableTransitions(json.data);
      }
    } catch {
      setTransitionError("Failed to load available transitions");
    } finally {
      setTransitionsLoading(false);
    }
  }, [asset]);

  const closeTransitionModal = useCallback(() => {
    setShowTransitionModal(false);
    setSelectedTransition(null);
    setTransitionWarnings([]);
    setTransitionWarningMessage("");
    setJustification("");
    setJustificationError("");
    setTransitionError(null);
  }, []);

  const handleTransitionConfirm = useCallback(async () => {
    if (!selectedTransition) return;
    // If warnings exist, justification is required
    if (transitionWarnings.length > 0 && !justification.trim()) {
      setJustificationError("Justification is required when overriding warnings.");
      return;
    }
    setJustificationError("");
    setTransitionSubmitting(true);
    setTransitionError(null);
    try {
      const body: Record<string, unknown> = { to_stage_id: selectedTransition.toStageId };
      if (transitionWarnings.length > 0) {
        body.override_warnings = true;
        body.justification = justification.trim();
      }
      const res = await fetch(`/api/assets/${id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setTransitionError(json.error ?? "Transition failed");
        return;
      }
      // Check if warnings came back (first attempt without override)
      if (json.data?.transition_blocked === false && json.data?.warnings?.length > 0 && !body.override_warnings) {
        setTransitionWarnings(json.data.warnings);
        setTransitionWarningMessage(json.data.message ?? "");
        return;
      }
      // Success
      closeTransitionModal();
      setToast({ message: `Asset transitioned to "${selectedTransition.toStage.name}"`, type: "success" });
      await fetchDataRef.current();
    } catch {
      setTransitionError("Network error during transition");
    } finally {
      setTransitionSubmitting(false);
    }
  }, [selectedTransition, transitionWarnings, justification, id, closeTransitionModal]);

  // Allow selecting a stage and doing first-pass check
  const handleSelectTransition = useCallback((t: LifecycleTransition) => {
    setSelectedTransition(t);
    setTransitionWarnings([]);
    setTransitionWarningMessage("");
    setJustification("");
    setJustificationError("");
    setTransitionError(null);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [assetRes, stagesRes] = await Promise.all([
        fetch(`/api/assets/${id}`),
        fetch("/api/lifecycle-stages"),
      ]);

      const assetJson = await assetRes.json();
      if (!assetRes.ok || assetJson.error) {
        setError(assetJson.error ?? "Failed to load asset");
        return;
      }
      setAsset(assetJson.data);

      const stagesJson = await stagesRes.json();
      if (stagesJson.data) {
        setStages(stagesJson.data);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Keep ref in sync so callbacks can call fetchData without circular deps
  fetchDataRef.current = fetchData;

  const fetchBudgets = useCallback(async () => {
    setBudgetsLoading(true);
    setBudgetsError(null);
    try {
      const res = await fetch(`/api/assets/${id}/budgets`);
      const json = await res.json();
      if (!res.ok || json.error) {
        setBudgetsError(json.error ?? "Failed to load budgets");
      } else {
        setBudgetData(json.data);
      }
    } catch {
      setBudgetsError("Network error loading budgets");
    } finally {
      setBudgetsLoading(false);
    }
  }, [id]);

  const fetchDocuments = useCallback(async () => {
    setDocsLoading(true);
    setDocsError(null);
    try {
      const qs = new URLSearchParams({
        attached_to_entity_type: "asset",
        attached_to_entity_id: id,
        per_page: "200",
      });
      const res = await fetch(`/api/documents?${qs}`);
      const json = await res.json();
      if (!res.ok || json.error) {
        setDocsError(json.error ?? "Failed to load documents");
      } else {
        setDocuments(json.data ?? []);
      }
    } catch {
      setDocsError("Network error loading documents");
    } finally {
      setDocsLoading(false);
    }
  }, [id]);

  const fetchDocumentTypes = useCallback(async () => {
    try {
      const res = await fetch("/api/document-types");
      const json = await res.json();
      if (json.data) setDocumentTypes(json.data);
    } catch {
      // non-critical
    }
  }, []);

  const fetchEvents = useCallback(async (page = 1, filter = { category: "", dateFrom: "", dateTo: "" }) => {
    setEventsLoading(true);
    setEventsError(null);
    try {
      const qs = new URLSearchParams({ page: String(page), per_page: "20" });
      if (filter.category) qs.set("category", filter.category);
      if (filter.dateFrom) qs.set("occurred_at_from", filter.dateFrom);
      if (filter.dateTo) qs.set("occurred_at_to", filter.dateTo);
      const res = await fetch(`/api/assets/${id}/events?${qs}`);
      const json = await res.json();
      if (!res.ok || json.error) {
        setEventsError(json.error ?? "Failed to load events");
      } else {
        setEvents((prev) => page === 1 ? (json.data ?? []) : [...prev, ...(json.data ?? [])]);
        setEventsTotal(json.meta?.total ?? 0);
        setEventsPage(page);
      }
    } catch {
      setEventsError("Network error loading events");
    } finally {
      setEventsLoading(false);
    }
  }, [id]);

  const fetchEventTypes = useCallback(async () => {
    try {
      const res = await fetch("/api/event-types");
      const json = await res.json();
      if (json.data) setEventTypes(json.data);
    } catch {
      // non-critical
    }
  }, []);

  const fetchContracts = useCallback(async () => {
    setContractsLoading(true);
    setContractsError(null);
    try {
      const res = await fetch(`/api/assets/${id}/contracts`);
      const json = await res.json();
      if (!res.ok || json.error) {
        setContractsError(json.error ?? "Failed to load contracts");
      } else {
        setContracts(json.data ?? []);
      }
    } catch {
      setContractsError("Network error loading contracts");
    } finally {
      setContractsLoading(false);
    }
  }, [id]);

  const fetchContractTypes = useCallback(async () => {
    try {
      const res = await fetch("/api/contract-types");
      const json = await res.json();
      if (json.data) setContractTypes(json.data);
    } catch {
      // non-critical
    }
  }, []);

  const fetchContractHistory = useCallback(async (contractRef: string, contractId: string) => {
    // Load contracts with same reference prefix (renewed chain) from assets contracts list
    // For simplicity: fetch all contracts for asset and filter those that are renewed/replaced by this contract
    try {
      const qs = new URLSearchParams({ asset_id: id, per_page: "100" });
      const res = await fetch(`/api/contracts?${qs}`);
      const json = await res.json();
      if (json.data) {
        // History contracts: same counterparty name or reference starts same, excluding current
        const base = (contractRef ?? "").replace(/-R\d+$/, "");
        const history = (json.data as ContractRecord[]).filter(
          (c) => c.id !== contractId && (c.contractReference ?? "").startsWith(base) && c.status === "renewed"
        );
        setContractHistory((prev) => ({ ...prev, [contractId]: history }));
      }
    } catch {
      // non-critical
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === "budgets") {
      fetchBudgets();
    } else if (activeTab === "documents") {
      fetchDocuments();
      if (documentTypes.length === 0) fetchDocumentTypes();
    } else if (activeTab === "events") {
      fetchEvents(1, eventsFilter);
      if (eventTypes.length === 0) fetchEventTypes();
    } else if (activeTab === "contracts") {
      fetchContracts();
      if (contractTypes.length === 0) fetchContractTypes();
    } else if (activeTab === "work_orders") {
      fetchAssetWorkOrders();
      if (woCategories.length === 0) fetchWoCategories();
    } else if (activeTab === "condition") {
      fetchConditionRecords();
    } else if (activeTab === "handover") {
      fetchHandoverRecords();
    } else if (activeTab === "revenue") {
      fetchRevenueData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleAddContractSubmit = useCallback(async () => {
    const errors: Partial<Record<keyof AddContractForm, string>> = {};
    if (!addContractForm.contract_type_id) errors.contract_type_id = "Required";
    if (!addContractForm.counterparty_name.trim()) errors.counterparty_name = "Required";
    if (!addContractForm.start_date) errors.start_date = "Required";
    setAddContractErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setAddContractSubmitting(true);
    setAddContractGeneralError(null);
    try {
      const body: Record<string, unknown> = {
        asset_id: id,
        contract_type_id: addContractForm.contract_type_id,
        counterparty_name: addContractForm.counterparty_name.trim(),
        counterparty_type: addContractForm.counterparty_type || "other",
        start_date: addContractForm.start_date,
      };
      if (addContractForm.end_date) body.end_date = addContractForm.end_date;
      if (addContractForm.contract_value) body.contract_value = parseFloat(addContractForm.contract_value);
      if (addContractForm.periodic_amount) body.periodic_amount = parseFloat(addContractForm.periodic_amount);
      if (addContractForm.payment_frequency) body.payment_frequency = addContractForm.payment_frequency;
      if (addContractForm.notice_period_days) body.notice_period_days = parseInt(addContractForm.notice_period_days, 10);
      body.renewal_option = addContractForm.renewal_option;
      body.auto_renewal = addContractForm.auto_renewal;
      if (addContractForm.notes.trim()) body.notes = addContractForm.notes.trim();

      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setAddContractGeneralError(json.error ?? "Failed to create contract");
        return;
      }
      setShowAddContractModal(false);
      setAddContractForm({
        contract_type_id: "",
        counterparty_name: "",
        counterparty_type: "other",
        start_date: "",
        end_date: "",
        contract_value: "",
        periodic_amount: "",
        payment_frequency: "",
        renewal_option: false,
        auto_renewal: false,
        notice_period_days: "",
        notes: "",
      });
      setToast({ message: "Contract created successfully", type: "success" });
      fetchContracts();
    } catch {
      setAddContractGeneralError("Network error creating contract");
    } finally {
      setAddContractSubmitting(false);
    }
  }, [id, addContractForm, fetchContracts]);

  const openEditContract = useCallback((c: ContractRecord) => {
    setEditContract(c);
    setEditContractForm({
      contract_type_id: c.contractType?.id ?? "",
      counterparty_name: c.counterpartyName,
      counterparty_type: c.counterpartyType,
      start_date: c.startDate ? c.startDate.substring(0, 10) : "",
      end_date: c.endDate ? c.endDate.substring(0, 10) : "",
      contract_value: c.contractValue ?? "",
      periodic_amount: c.periodicAmount ?? "",
      payment_frequency: c.paymentFrequency ?? "",
      renewal_option: c.renewalOption,
      auto_renewal: c.autoRenewal,
      notice_period_days: c.noticePeriodDays != null ? String(c.noticePeriodDays) : "",
      notes: c.notes ?? "",
    });
    setEditContractGeneralError(null);
  }, []);

  const handleEditContractSubmit = useCallback(async () => {
    if (!editContract) return;
    setEditContractSubmitting(true);
    setEditContractGeneralError(null);
    try {
      const body: Record<string, unknown> = {
        counterparty_name: editContractForm.counterparty_name.trim(),
        counterparty_type: editContractForm.counterparty_type || "other",
        start_date: editContractForm.start_date,
        end_date: editContractForm.end_date || null,
        contract_value: editContractForm.contract_value ? parseFloat(editContractForm.contract_value) : null,
        periodic_amount: editContractForm.periodic_amount ? parseFloat(editContractForm.periodic_amount) : null,
        payment_frequency: editContractForm.payment_frequency || null,
        notice_period_days: editContractForm.notice_period_days ? parseInt(editContractForm.notice_period_days, 10) : null,
        renewal_option: editContractForm.renewal_option,
        auto_renewal: editContractForm.auto_renewal,
        notes: editContractForm.notes.trim() || null,
      };
      const res = await fetch(`/api/contracts/${editContract.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setEditContractGeneralError(json.error ?? "Failed to update contract");
        return;
      }
      setEditContract(null);
      setToast({ message: "Contract updated successfully", type: "success" });
      fetchContracts();
    } catch {
      setEditContractGeneralError("Network error updating contract");
    } finally {
      setEditContractSubmitting(false);
    }
  }, [editContract, editContractForm, fetchContracts]);

  const openRenewContract = useCallback((c: ContractRecord) => {
    setRenewContract(c);
    setRenewStartDate(c.endDate ? c.endDate.substring(0, 10) : "");
    setRenewEndDate("");
    setRenewError(null);
  }, []);

  const handleRenewSubmit = useCallback(async () => {
    if (!renewContract) return;
    if (!renewStartDate) { setRenewError("New start date is required"); return; }
    setRenewSubmitting(true);
    setRenewError(null);
    try {
      const body: Record<string, unknown> = { new_start_date: renewStartDate };
      if (renewEndDate) body.new_end_date = renewEndDate;
      const res = await fetch(`/api/contracts/${renewContract.id}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setRenewError(json.error ?? "Failed to renew contract");
        return;
      }
      setRenewContract(null);
      setToast({ message: "Contract renewed successfully", type: "success" });
      fetchContracts();
    } catch {
      setRenewError("Network error renewing contract");
    } finally {
      setRenewSubmitting(false);
    }
  }, [renewContract, renewStartDate, renewEndDate, fetchContracts]);

  const toggleContractHistory = useCallback((c: ContractRecord) => {
    setExpandedContractIds((prev) => {
      const next = new Set(prev);
      if (next.has(c.id)) {
        next.delete(c.id);
      } else {
        next.add(c.id);
        if (!contractHistory[c.id]) {
          fetchContractHistory(c.contractReference ?? c.id, c.id);
        }
      }
      return next;
    });
  }, [contractHistory, fetchContractHistory]);

  const fetchAssetWorkOrders = useCallback(async () => {
    if (!id) return;
    setWoLoading(true);
    setWoError(null);
    try {
      const res = await fetch(`/api/work-orders?asset_id=${id}&per_page=50`);
      const json = await res.json();
      if (!res.ok) {
        setWoError(json.error ?? "Failed to load work orders");
        return;
      }
      setAssetWorkOrders(json.data ?? []);
      setWoTotal(json.meta?.total ?? 0);
    } catch {
      setWoError("Network error. Please try again.");
    } finally {
      setWoLoading(false);
    }
  }, [id]);

  const fetchWoCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/work-order-categories");
      const json = await res.json();
      if (json.data) setWoCategories(json.data);
    } catch {
      // non-critical
    }
  }, []);

  const fetchConditionRecords = useCallback(async () => {
    if (!id) return;
    setConditionLoading(true);
    setConditionError(null);
    try {
      const res = await fetch(`/api/assets/${id}/condition-records?per_page=50`);
      const json = await res.json();
      if (!res.ok || json.error) {
        setConditionError(json.error ?? "Failed to load condition records");
      } else {
        const records: ConditionRecord[] = json.data ?? [];
        setConditionRecords(records);
        setCurrentCondition(records.length > 0 ? records[0] : null);
      }
    } catch {
      setConditionError("Network error loading condition records");
    } finally {
      setConditionLoading(false);
    }
  }, [id]);

  const fetchHandoverRecords = useCallback(async () => {
    if (!id) return;
    setHandoverLoading(true);
    setHandoverError(null);
    try {
      const res = await fetch(`/api/assets/${id}/handover-records?per_page=50`);
      const json = await res.json();
      if (!res.ok || json.error) {
        setHandoverError(json.error ?? "Failed to load handover records");
      } else {
        setHandoverRecords(json.data ?? []);
      }
    } catch {
      setHandoverError("Network error loading handover records");
    } finally {
      setHandoverLoading(false);
    }
  }, [id]);

  const handleCreateHandoverSubmit = useCallback(async () => {
    const errors: Partial<Record<keyof CreateHandoverForm, string>> = {};
    if (!createHandoverForm.delivered_by_body_id.trim()) errors.delivered_by_body_id = "Required";
    if (!createHandoverForm.received_by_body_id.trim()) errors.received_by_body_id = "Required";
    if (!createHandoverForm.handover_date) errors.handover_date = "Required";
    setCreateHandoverErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setCreateHandoverSubmitting(true);
    setCreateHandoverGeneralError(null);
    try {
      const missingDocs = createHandoverForm.missing_documents
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload: Record<string, unknown> = {
        asset_id: id,
        delivered_by_body_id: createHandoverForm.delivered_by_body_id.trim(),
        received_by_body_id: createHandoverForm.received_by_body_id.trim(),
        handover_date: createHandoverForm.handover_date,
        defects_list: handoverDefects.length > 0 ? handoverDefects : null,
        missing_documents: missingDocs.length > 0 ? missingDocs : null,
      };
      if (createHandoverForm.warranty_expiry_date) payload.warranty_expiry_date = createHandoverForm.warranty_expiry_date;
      if (createHandoverForm.notes.trim()) payload.notes = createHandoverForm.notes.trim();

      const res = await fetch("/api/handover-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setCreateHandoverGeneralError(json.error ?? "Failed to create handover record");
        return;
      }
      setShowCreateHandover(false);
      setCreateHandoverForm({ delivered_by_body_id: "", received_by_body_id: "", handover_date: "", warranty_expiry_date: "", notes: "", missing_documents: "" });
      setHandoverDefects([]);
      setCreateHandoverErrors({});
      setCreateHandoverGeneralError(null);
      await fetchHandoverRecords();
      setToast({ message: "Handover record created", type: "success" });
    } catch {
      setCreateHandoverGeneralError("Network error. Please try again.");
    } finally {
      setCreateHandoverSubmitting(false);
    }
  }, [id, createHandoverForm, handoverDefects, fetchHandoverRecords]);

  const handleAcceptHandover = useCallback(async () => {
    if (!acceptingHandover) return;
    if (acceptWithConditions && !acceptConditionsText.trim()) {
      setAcceptError("Conditions description is required when accepting with conditions");
      return;
    }
    setAcceptSubmitting(true);
    setAcceptError(null);
    try {
      const payload: Record<string, unknown> = {
        accepted_with_conditions: acceptWithConditions,
      };
      if (acceptWithConditions) payload.conditions_description = acceptConditionsText.trim();
      const res = await fetch(`/api/handover-records/${acceptingHandover.id}/accept`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setAcceptError(json.error ?? "Failed to accept handover");
        return;
      }
      setAcceptingHandover(null);
      setAcceptWithConditions(false);
      setAcceptConditionsText("");
      await fetchHandoverRecords();
      setToast({ message: "Handover accepted", type: "success" });
    } catch {
      setAcceptError("Network error. Please try again.");
    } finally {
      setAcceptSubmitting(false);
    }
  }, [acceptingHandover, acceptWithConditions, acceptConditionsText, fetchHandoverRecords]);

  const handleRejectHandover = useCallback(async () => {
    if (!rejectingHandover) return;
    if (!rejectReason.trim()) {
      setRejectError("Rejection reason is required");
      return;
    }
    setRejectSubmitting(true);
    setRejectError(null);
    try {
      const res = await fetch(`/api/handover-records/${rejectingHandover.id}/reject`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejection_reason: rejectReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setRejectError(json.error ?? "Failed to reject handover");
        return;
      }
      setRejectingHandover(null);
      setRejectReason("");
      await fetchHandoverRecords();
      setToast({ message: "Handover rejected", type: "success" });
    } catch {
      setRejectError("Network error. Please try again.");
    } finally {
      setRejectSubmitting(false);
    }
  }, [rejectingHandover, rejectReason, fetchHandoverRecords]);

  const handleRecordInspectionSubmit = useCallback(async () => {
    const errors: Partial<Record<keyof RecordInspectionForm, string>> = {};
    if (!recordInspectionForm.inspection_date) errors.inspection_date = "Required";
    const score = parseInt(recordInspectionForm.condition_score, 10);
    if (isNaN(score) || score < 1 || score > 5) errors.condition_score = "Score must be 1–5";
    setRecordInspectionErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setRecordInspectionSubmitting(true);
    setRecordInspectionGeneralError(null);
    try {
      const payload: Record<string, unknown> = {
        asset_id: id,
        inspection_date: recordInspectionForm.inspection_date,
        condition_score: score,
      };
      if (recordInspectionForm.structural_condition) payload.structural_condition = recordInspectionForm.structural_condition;
      if (recordInspectionForm.safety_condition) payload.safety_condition = recordInspectionForm.safety_condition;
      if (recordInspectionForm.maintenance_priority) payload.maintenance_priority = recordInspectionForm.maintenance_priority;
      if (recordInspectionForm.replacement_urgency) payload.replacement_urgency = recordInspectionForm.replacement_urgency;
      if (recordInspectionForm.notes.trim()) payload.notes = recordInspectionForm.notes.trim();
      if (recordInspectionForm.next_inspection_due) payload.next_inspection_due = recordInspectionForm.next_inspection_due;

      const res = await fetch("/api/condition-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setRecordInspectionGeneralError(json.error ?? "Failed to record inspection");
        return;
      }
      setShowRecordInspection(false);
      setRecordInspectionForm({
        inspection_date: "", condition_score: "3", structural_condition: "",
        safety_condition: "", maintenance_priority: "none", replacement_urgency: "none",
        notes: "", next_inspection_due: "",
      });
      setRecordInspectionErrors({});
      setRecordInspectionGeneralError(null);
      await fetchConditionRecords();
      setToast({ message: "Inspection recorded successfully", type: "success" });
    } catch {
      setRecordInspectionGeneralError("Network error. Please try again.");
    } finally {
      setRecordInspectionSubmitting(false);
    }
  }, [id, recordInspectionForm, fetchConditionRecords]);

  const handleCreateWOSubmit = useCallback(async () => {
    const errors: Partial<Record<keyof CreateWOForm, string>> = {};
    if (!createWOForm.category_id) errors.category_id = "Required";
    if (!createWOForm.title.trim()) errors.title = "Required";
    setCreateWOErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setCreateWOSubmitting(true);
    setCreateWOGeneralError(null);
    try {
      const payload: Record<string, unknown> = {
        asset_id: id,
        category_id: createWOForm.category_id,
        title: createWOForm.title.trim(),
        priority: createWOForm.priority,
      };
      if (createWOForm.description.trim()) payload.description = createWOForm.description.trim();
      if (createWOForm.target_completion_date) payload.target_completion_date = createWOForm.target_completion_date;
      if (createWOForm.notes.trim()) payload.notes = createWOForm.notes.trim();

      const res = await fetch("/api/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setCreateWOGeneralError(json.error ?? "Failed to create work order");
        return;
      }
      setShowCreateWO(false);
      setCreateWOForm({ category_id: "", title: "", description: "", priority: "medium", target_completion_date: "", notes: "" });
      setCreateWOErrors({});
      setCreateWOGeneralError(null);
      fetchAssetWorkOrders();
      setToast({ message: "Work order created", type: "success" });
    } catch {
      setCreateWOGeneralError("Network error. Please try again.");
    } finally {
      setCreateWOSubmitting(false);
    }
  }, [id, createWOForm, fetchAssetWorkOrders]);

  const fetchAllBodies = useCallback(async () => {
    if (bodiesLoaded) return;
    try {
      const res = await fetch("/api/responsible-bodies?per_page=200");
      const json = await res.json();
      if (json.data) {
        setAllBodies(json.data);
        setBodiesLoaded(true);
      }
    } catch {
      // non-critical
    }
  }, [bodiesLoaded]);

  const fetchBodyTransferHistory = useCallback(async () => {
    setBodyHistoryLoading(true);
    try {
      const res = await fetch(`/api/assets/${id}/body-transfers`);
      const json = await res.json();
      if (json.data) setBodyTransferHistory(json.data);
    } catch {
      // non-critical
    } finally {
      setBodyHistoryLoading(false);
    }
  }, [id]);

  const handleBodyTransferConfirm = useCallback(async () => {
    if (!pendingBodyTransfer || !bodyTransferReason.trim()) return;
    setBodyTransferSubmitting(true);
    setBodyTransferError(null);
    try {
      const payload: Record<string, unknown> = {
        asset_id: id,
        transfer_type: pendingBodyTransfer.transferType,
        to_body_id: pendingBodyTransfer.toBody.id,
        reason: bodyTransferReason.trim(),
      };
      if (pendingBodyTransfer.fromBody?.id) payload.from_body_id = pendingBodyTransfer.fromBody.id;
      const res = await fetch("/api/body-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setBodyTransferError(json.error ?? "Transfer failed");
        return;
      }
      const roleLabel = pendingBodyTransfer.roleLabel;
      setPendingBodyTransfer(null);
      setBodyTransferReason("");
      setBodyTransferError(null);
      await fetchDataRef.current();
      setToast({ message: `${roleLabel} transferred successfully`, type: "success" });
      if (showBodyHistory) fetchBodyTransferHistory();
    } catch {
      setBodyTransferError("Network error. Please try again.");
    } finally {
      setBodyTransferSubmitting(false);
    }
  }, [id, pendingBodyTransfer, bodyTransferReason, showBodyHistory, fetchBodyTransferHistory]);

  const fetchRevenueData = useCallback(async () => {
    if (!id) return;
    setRevenueLoading(true);
    setRevenueError(null);
    try {
      const [summaryRes, recordsRes] = await Promise.all([
        fetch(`/api/assets/${id}/revenue-summary`),
        fetch(`/api/revenue-records?asset_id=${id}&per_page=100`),
      ]);
      const summaryJson = await summaryRes.json();
      const recordsJson = await recordsRes.json();
      if (summaryJson.data) setRevenueSummary(summaryJson.data);
      if (recordsJson.data) setRevenueRecords(recordsJson.data);
    } catch {
      setRevenueError("Failed to load revenue data");
    } finally {
      setRevenueLoading(false);
    }
  }, [id]);

  const handleAddRevenueSubmit = useCallback(async () => {
    const errors: Partial<Record<keyof AddRevenueForm, string>> = {};
    if (!addRevenueForm.revenue_type) errors.revenue_type = "Required";
    if (!addRevenueForm.period_start) errors.period_start = "Required";
    if (!addRevenueForm.period_end) errors.period_end = "Required";
    if (!addRevenueForm.expected_amount) errors.expected_amount = "Required";
    setAddRevenueErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setAddRevenueSubmitting(true);
    setAddRevenueGeneralError(null);
    try {
      const payload: Record<string, unknown> = {
        asset_id: id,
        revenue_type: addRevenueForm.revenue_type,
        period_start: addRevenueForm.period_start,
        period_end: addRevenueForm.period_end,
        expected_amount: Number(addRevenueForm.expected_amount),
        notes: addRevenueForm.notes || undefined,
      };
      if (addRevenueForm.actual_amount) payload.actual_amount = Number(addRevenueForm.actual_amount);
      if (addRevenueForm.allocation_id) payload.allocation_id = addRevenueForm.allocation_id;
      if (addRevenueForm.contract_id) payload.contract_id = addRevenueForm.contract_id;

      const res = await fetch("/api/revenue-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setAddRevenueGeneralError(json.error ?? "Failed to create revenue record");
        return;
      }
      setShowAddRevenue(false);
      setAddRevenueForm({
        revenue_type: "lease_income", period_start: "", period_end: "",
        expected_amount: "", actual_amount: "", allocation_id: "", contract_id: "", notes: "",
      });
      fetchRevenueData();
    } catch {
      setAddRevenueGeneralError("Network error");
    } finally {
      setAddRevenueSubmitting(false);
    }
  }, [id, addRevenueForm, fetchRevenueData]);

  const handleMarkReceived = useCallback(async () => {
    if (!markReceivingRecord) return;
    if (!markReceivedForm.actual_amount) {
      setMarkReceivedError("Actual amount is required");
      return;
    }
    setMarkReceivedSubmitting(true);
    setMarkReceivedError(null);
    try {
      const res = await fetch(`/api/revenue-records/${markReceivingRecord.id}/mark-received`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actual_amount: Number(markReceivedForm.actual_amount),
          payment_date: markReceivedForm.payment_date || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMarkReceivedError(json.error ?? "Failed to mark received");
        return;
      }
      setMarkReceivingRecord(null);
      setMarkReceivedForm({ actual_amount: "", payment_date: "" });
      fetchRevenueData();
    } catch {
      setMarkReceivedError("Network error");
    } finally {
      setMarkReceivedSubmitting(false);
    }
  }, [markReceivingRecord, markReceivedForm, fetchRevenueData]);

  const handleAddEnvelopeSubmit = useCallback(async () => {
    const errors: Partial<Record<keyof AddEnvelopeForm, string>> = {};
    if (!addEnvelopeForm.budget_type) errors.budget_type = "Required";
    if (!addEnvelopeForm.is_multi_year && !addEnvelopeForm.fiscal_year) {
      errors.fiscal_year = "Fiscal year is required unless multi-year";
    }
    if (addEnvelopeForm.is_multi_year) {
      if (!addEnvelopeForm.multi_year_start) errors.multi_year_start = "Required";
      if (!addEnvelopeForm.multi_year_end) errors.multi_year_end = "Required";
      if (addEnvelopeForm.multi_year_start && addEnvelopeForm.multi_year_end &&
          Number(addEnvelopeForm.multi_year_end) < Number(addEnvelopeForm.multi_year_start)) {
        errors.multi_year_end = "End year must be ≥ start year";
      }
    }
    setAddEnvelopeErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setAddEnvelopeSubmitting(true);
    setAddEnvelopeGeneralError(null);
    try {
      const payload: Record<string, unknown> = {
        asset_id: id,
        budget_type: addEnvelopeForm.budget_type,
        approved_amount: Number(addEnvelopeForm.approved_amount) || 0,
        committed_amount: Number(addEnvelopeForm.committed_amount) || 0,
        actual_amount: Number(addEnvelopeForm.actual_amount) || 0,
        notes: addEnvelopeForm.notes || undefined,
      };
      if (addEnvelopeForm.lifecycle_stage_id) payload.lifecycle_stage_id = addEnvelopeForm.lifecycle_stage_id;
      if (addEnvelopeForm.is_multi_year) {
        payload.is_multi_year = true;
        payload.multi_year_start = Number(addEnvelopeForm.multi_year_start);
        payload.multi_year_end = Number(addEnvelopeForm.multi_year_end);
      } else {
        payload.fiscal_year = Number(addEnvelopeForm.fiscal_year);
      }

      const res = await fetch("/api/budget-envelopes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setAddEnvelopeGeneralError(json.error ?? "Failed to create budget envelope");
        return;
      }
      setShowAddEnvelope(false);
      setAddEnvelopeForm({
        budget_type: "capex", lifecycle_stage_id: "", fiscal_year: "",
        is_multi_year: false, multi_year_start: "", multi_year_end: "",
        approved_amount: "0", committed_amount: "0", actual_amount: "0", notes: "",
      });
      await fetchBudgets();
    } catch {
      setAddEnvelopeGeneralError("Network error");
    } finally {
      setAddEnvelopeSubmitting(false);
    }
  }, [id, addEnvelopeForm, fetchBudgets]);

  const startInlineEdit = useCallback((env: BudgetEnvelope) => {
    setInlineEdit((prev) => ({
      ...prev,
      [env.id]: {
        approved: String(Number(env.approvedAmount)),
        committed: String(Number(env.committedAmount)),
        actual: String(Number(env.actualAmount)),
      },
    }));
  }, []);

  const cancelInlineEdit = useCallback((envId: string) => {
    setInlineEdit((prev) => { const next = { ...prev }; delete next[envId]; return next; });
  }, []);

  const saveInlineEdit = useCallback(async (envId: string) => {
    const vals = inlineEdit[envId];
    if (!vals) return;
    setInlineEditSaving((prev) => ({ ...prev, [envId]: true }));
    try {
      const res = await fetch(`/api/budget-envelopes/${envId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approved_amount: Number(vals.approved) || 0,
          committed_amount: Number(vals.committed) || 0,
          actual_amount: Number(vals.actual) || 0,
        }),
      });
      const json = await res.json();
      if (res.ok && !json.error) {
        cancelInlineEdit(envId);
        await fetchBudgets();
      }
    } finally {
      setInlineEditSaving((prev) => ({ ...prev, [envId]: false }));
    }
  }, [inlineEdit, cancelInlineEdit, fetchBudgets]);

  const handleUploadSubmit = useCallback(async () => {
    const errors: Partial<Record<keyof UploadDocForm | "file", string>> = {};
    if (!uploadForm.document_type_id) errors.document_type_id = "Required";
    if (!uploadForm.title.trim()) errors.title = "Required";
    if (!uploadFile) errors.file = "Please select a file";
    setUploadErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setUploadSubmitting(true);
    setUploadGeneralError(null);
    try {
      // Step 1: upload the file
      const formData = new FormData();
      formData.append("file", uploadFile!);
      const uploadRes = await fetch("/api/documents/upload", { method: "POST", body: formData });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok || uploadJson.error) {
        setUploadGeneralError(uploadJson.error ?? "File upload failed");
        return;
      }
      const { file_url, file_name, file_size_bytes, mime_type } = uploadJson.data;

      // Step 2: create the document record
      const payload: Record<string, unknown> = {
        document_type_id: uploadForm.document_type_id,
        title: uploadForm.title.trim(),
        file_url,
        file_name,
        file_size_bytes,
        mime_type,
        attached_to_entity_type: "asset",
        attached_to_entity_id: id,
      };
      if (uploadForm.lifecycle_stage_id) payload.lifecycle_stage_id = uploadForm.lifecycle_stage_id;
      if (uploadForm.expiry_date) payload.expiry_date = uploadForm.expiry_date;
      if (uploadForm.description.trim()) payload.description = uploadForm.description.trim();

      const docRes = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const docJson = await docRes.json();
      if (!docRes.ok || docJson.error) {
        setUploadGeneralError(docJson.error ?? "Failed to create document record");
        return;
      }
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadForm({ document_type_id: "", title: "", lifecycle_stage_id: "", expiry_date: "", description: "" });
      await fetchDocuments();
    } catch {
      setUploadGeneralError("Network error during upload");
    } finally {
      setUploadSubmitting(false);
    }
  }, [uploadForm, uploadFile, id, fetchDocuments]);

  const handleDeleteDoc = useCallback(async (docId: string) => {
    setDeletingDocId(docId);
    try {
      await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      setConfirmDeleteDocId(null);
      await fetchDocuments();
    } finally {
      setDeletingDocId(null);
    }
  }, [fetchDocuments]);

  const handleVerifyDoc = useCallback(async (docId: string) => {
    setVerifyingDocId(docId);
    try {
      await fetch(`/api/documents/${docId}/verify`, { method: "PUT" });
      await fetchDocuments();
    } finally {
      setVerifyingDocId(null);
    }
  }, [fetchDocuments]);

  const handleAddEventSubmit = useCallback(async () => {
    const errors: Partial<Record<keyof AddEventForm, string>> = {};
    if (!addEventForm.event_type_id) errors.event_type_id = "Required";
    setAddEventErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setAddEventSubmitting(true);
    setAddEventGeneralError(null);
    try {
      const payload: Record<string, unknown> = {
        event_type_id: addEventForm.event_type_id,
        asset_id: id,
      };
      if (addEventForm.occurred_at) payload.occurred_at = addEventForm.occurred_at;
      if (addEventForm.description.trim()) payload.description = addEventForm.description.trim();
      if (addEventForm.responsible_body_id) payload.responsible_body_id = addEventForm.responsible_body_id;

      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setAddEventGeneralError(json.error ?? "Failed to create event");
        return;
      }
      setShowAddEventModal(false);
      setAddEventForm({ event_type_id: "", occurred_at: "", description: "", responsible_body_id: "" });
      await fetchEvents(1, eventsFilter);
    } catch {
      setAddEventGeneralError("Network error");
    } finally {
      setAddEventSubmitting(false);
    }
  }, [addEventForm, id, fetchEvents, eventsFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 text-sm">Loading asset...</div>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-4">
          {error ?? "Asset not found"}
        </div>
        <button
          onClick={() => router.back()}
          className="mt-4 text-sm text-blue-600 hover:underline"
        >
          ← Go back
        </button>
      </div>
    );
  }

  const hasPlaceholderBody = [
    asset.strategicOwnerBody,
    asset.responsibleBody,
    asset.operationalBody,
    asset.maintenanceBody,
    asset.dataStewardBody,
  ].some((b) => b?.isPlaceholder);

  const currentStageOrder = asset.currentLifecycleStage?.displayOrder ?? 0;

  function fmtCurrency(val: number) {
    return val.toLocaleString("en-IL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function varianceClass(v: number) {
    return v >= 0 ? "text-green-700 font-medium" : "text-red-600 font-medium";
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Back link */}
      <Link href="/assets" className="text-sm text-blue-600 hover:underline">
        ← Back to Assets
      </Link>

      {/* Placeholder body warning banner */}
      {hasPlaceholderBody && (
        <div className="bg-amber-50 border border-amber-300 text-amber-800 rounded p-3 text-sm font-medium">
          ⚠ This asset is assigned to a placeholder body — organizational ownership not yet resolved
        </div>
      )}

      {/* Safety hazard banner */}
      {currentCondition && (currentCondition.safetyCondition === "unsafe" || currentCondition.safetyCondition === "major_hazard") && (
        <div className="bg-red-50 border border-red-400 text-red-800 rounded p-3 text-sm font-semibold flex items-center gap-2">
          🚨 Safety Issue — Immediate attention required
          <span className="font-normal text-red-700 ml-1">
            (Current safety status: {formatLabel(currentCondition.safetyCondition)})
          </span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border rounded-lg p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                {asset.assetCode}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 truncate">{asset.assetName}</h1>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {asset.assetFamily && (
              <Badge label={asset.assetFamily.name} colorClass="bg-violet-100 text-violet-800" />
            )}
            {asset.assetType && (
              <Badge label={asset.assetType.name} colorClass="bg-blue-100 text-blue-800" />
            )}
            <Badge
              label={formatLabel(asset.currentStatus)}
              colorClass={STATUS_COLORS[asset.currentStatus] ?? "bg-gray-100 text-gray-700"}
            />
            {asset.ownershipModel && (
              <Badge
                label={formatLabel(asset.ownershipModel)}
                colorClass={OWNERSHIP_COLORS[asset.ownershipModel] ?? "bg-gray-100 text-gray-700"}
              />
            )}
            <button
              onClick={() => router.push(`/assets/${id}/edit`)}
              className="ml-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Edit
            </button>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      {(() => {
        const REVENUE_BUDGET_TYPES = ["lease_income", "service_charges"];
        const showRevenueTab = asset
          ? asset.budgetEnvelopes.some((e) => REVENUE_BUDGET_TYPES.includes(e.budgetType))
          : false;
        const tabs = ["overview", "budgets", "documents", "events", "contracts", "work_orders", "condition", "handover", ...(showRevenueTab ? ["revenue"] : [])] as const;
        return (
          <div className="border-b border-gray-200">
            <nav className="flex gap-1 -mb-px flex-wrap">
              {(tabs as unknown as string[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as typeof activeTab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? "border-blue-600 text-blue-700"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab === "overview" ? "Overview"
                    : tab === "budgets" ? "Budgets"
                    : tab === "documents" ? "Documents"
                    : tab === "events" ? "Events"
                    : tab === "contracts" ? "Contracts"
                    : tab === "work_orders" ? "Work Orders"
                    : tab === "condition" ? "Condition"
                    : tab === "handover" ? "Handover"
                    : "Revenue"}
                </button>
              ))}
            </nav>
          </div>
        );
      })()}

      {activeTab === "budgets" && (
        <div className="bg-white border rounded-lg shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-sm font-semibold text-gray-700">Budget Envelopes</h2>
            <button
              onClick={() => setShowAddEnvelope(true)}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              + Add Budget Envelope
            </button>
          </div>

          {budgetsLoading && (
            <div className="px-6 py-8 text-center text-sm text-gray-500">Loading budgets...</div>
          )}
          {budgetsError && (
            <div className="px-6 py-4 text-sm text-red-600">{budgetsError}</div>
          )}

          {!budgetsLoading && !budgetsError && budgetData && (
            <div className="overflow-x-auto">
              {budgetData.groups.length === 0 ? (
                <p className="px-6 py-8 text-sm text-gray-500 text-center">No budget envelopes yet. Add one above.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                      <th className="text-left px-4 py-2">Type</th>
                      <th className="text-left px-4 py-2">Stage</th>
                      <th className="text-left px-4 py-2">Period</th>
                      <th className="text-right px-4 py-2">Approved</th>
                      <th className="text-right px-4 py-2">Committed</th>
                      <th className="text-right px-4 py-2">Actual</th>
                      <th className="text-right px-4 py-2">Variance</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetData.groups.map((group) => {
                      const groupVariance = group.totals.variance;
                      return (
                        <Fragment key={group.budget_type}>
                          {group.envelopes.map((env) => {
                            const editing = inlineEdit[env.id];
                            const saving = inlineEditSaving[env.id];
                            const variance = Number(env.varianceAmount);
                            const period = env.isMultiYear
                              ? `${env.multiYearStart}–${env.multiYearEnd}`
                              : env.fiscalYear ? String(env.fiscalYear) : "—";

                            return (
                              <tr
                                key={env.id}
                                className={`border-b ${env.isClosed ? "opacity-50 bg-gray-50" : "hover:bg-gray-50"}`}
                              >
                                <td className="px-4 py-2 font-medium text-gray-700 capitalize">
                                  {formatLabel(env.budgetType)}
                                  {env.isClosed && (
                                    <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">Closed</span>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-gray-600">{env.lifecycleStage?.name ?? "—"}</td>
                                <td className="px-4 py-2 text-gray-600">{period}</td>
                                {editing ? (
                                  <>
                                    <td className="px-4 py-2">
                                      <input
                                        type="number"
                                        value={editing.approved}
                                        onChange={(e) => setInlineEdit((p) => ({ ...p, [env.id]: { ...p[env.id], approved: e.target.value } }))}
                                        className="w-24 border rounded px-1.5 py-0.5 text-right text-xs"
                                      />
                                    </td>
                                    <td className="px-4 py-2">
                                      <input
                                        type="number"
                                        value={editing.committed}
                                        onChange={(e) => setInlineEdit((p) => ({ ...p, [env.id]: { ...p[env.id], committed: e.target.value } }))}
                                        className="w-24 border rounded px-1.5 py-0.5 text-right text-xs"
                                      />
                                    </td>
                                    <td className="px-4 py-2">
                                      <input
                                        type="number"
                                        value={editing.actual}
                                        onChange={(e) => setInlineEdit((p) => ({ ...p, [env.id]: { ...p[env.id], actual: e.target.value } }))}
                                        className="w-24 border rounded px-1.5 py-0.5 text-right text-xs"
                                      />
                                    </td>
                                    <td className="px-4 py-2 text-right text-gray-400 text-xs">—</td>
                                    <td className="px-4 py-2 text-right whitespace-nowrap">
                                      <button
                                        onClick={() => saveInlineEdit(env.id)}
                                        disabled={saving}
                                        className="text-xs text-green-700 hover:underline mr-2 disabled:opacity-50"
                                      >
                                        {saving ? "Saving…" : "Save"}
                                      </button>
                                      <button onClick={() => cancelInlineEdit(env.id)} className="text-xs text-gray-500 hover:underline">
                                        Cancel
                                      </button>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="px-4 py-2 text-right text-gray-800">{fmtCurrency(Number(env.approvedAmount))}</td>
                                    <td className="px-4 py-2 text-right text-gray-800">{fmtCurrency(Number(env.committedAmount))}</td>
                                    <td className="px-4 py-2 text-right text-gray-800">{fmtCurrency(Number(env.actualAmount))}</td>
                                    <td className={`px-4 py-2 text-right ${varianceClass(variance)}`}>
                                      {variance >= 0 ? "+" : ""}{fmtCurrency(variance)}
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                      {!env.isClosed && (
                                        <button
                                          onClick={() => startInlineEdit(env)}
                                          className="text-xs text-blue-600 hover:underline"
                                        >
                                          Edit
                                        </button>
                                      )}
                                    </td>
                                  </>
                                )}
                              </tr>
                            );
                          })}
                          {/* Group total row */}
                          <tr className="bg-gray-50 border-b font-semibold text-xs text-gray-700">
                            <td colSpan={3} className="px-4 py-2 capitalize">
                              {formatLabel(group.budget_type)} — Total
                            </td>
                            <td className="px-4 py-2 text-right">{fmtCurrency(group.totals.approved)}</td>
                            <td className="px-4 py-2 text-right">{fmtCurrency(group.totals.committed)}</td>
                            <td className="px-4 py-2 text-right">{fmtCurrency(group.totals.actual)}</td>
                            <td className={`px-4 py-2 text-right ${varianceClass(groupVariance)}`}>
                              {groupVariance >= 0 ? "+" : ""}{fmtCurrency(groupVariance)}
                            </td>
                            <td />
                          </tr>
                        </Fragment>
                      );
                    })}
                    {/* Grand total row */}
                    <tr className="bg-blue-50 font-bold text-sm text-gray-800 border-t-2 border-blue-200">
                      <td colSpan={3} className="px-4 py-3">Grand Total</td>
                      <td className="px-4 py-3 text-right">{fmtCurrency(budgetData.grand_totals.approved)}</td>
                      <td className="px-4 py-3 text-right">{fmtCurrency(budgetData.grand_totals.committed)}</td>
                      <td className="px-4 py-3 text-right">{fmtCurrency(budgetData.grand_totals.actual)}</td>
                      <td className={`px-4 py-3 text-right ${varianceClass(budgetData.grand_totals.variance)}`}>
                        {budgetData.grand_totals.variance >= 0 ? "+" : ""}{fmtCurrency(budgetData.grand_totals.variance)}
                      </td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add Budget Envelope Modal */}
      {showAddEnvelope && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-800">Add Budget Envelope</h3>
              <button onClick={() => setShowAddEnvelope(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            {addEnvelopeGeneralError && (
              <div className="mb-3 bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">{addEnvelopeGeneralError}</div>
            )}

            <div className="space-y-4">
              {/* Budget type */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Budget Type *</label>
                <select
                  value={addEnvelopeForm.budget_type}
                  onChange={(e) => setAddEnvelopeForm((p) => ({ ...p, budget_type: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  {BUDGET_TYPES.map((t) => (
                    <option key={t} value={t}>{formatLabel(t)}</option>
                  ))}
                </select>
                {addEnvelopeErrors.budget_type && <p className="text-xs text-red-600 mt-1">{addEnvelopeErrors.budget_type}</p>}
              </div>

              {/* Lifecycle stage */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Lifecycle Stage (optional)</label>
                <select
                  value={addEnvelopeForm.lifecycle_stage_id}
                  onChange={(e) => setAddEnvelopeForm((p) => ({ ...p, lifecycle_stage_id: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  <option value="">— All stages —</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Multi-year toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isMultiYear"
                  checked={addEnvelopeForm.is_multi_year}
                  onChange={(e) => setAddEnvelopeForm((p) => ({ ...p, is_multi_year: e.target.checked, fiscal_year: "" }))}
                  className="rounded"
                />
                <label htmlFor="isMultiYear" className="text-sm text-gray-700">Multi-year envelope</label>
              </div>

              {addEnvelopeForm.is_multi_year ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Start Year *</label>
                    <input
                      type="number"
                      value={addEnvelopeForm.multi_year_start}
                      onChange={(e) => setAddEnvelopeForm((p) => ({ ...p, multi_year_start: e.target.value }))}
                      className="w-full border rounded px-2 py-1.5 text-sm"
                      placeholder="2025"
                    />
                    {addEnvelopeErrors.multi_year_start && <p className="text-xs text-red-600 mt-1">{addEnvelopeErrors.multi_year_start}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">End Year *</label>
                    <input
                      type="number"
                      value={addEnvelopeForm.multi_year_end}
                      onChange={(e) => setAddEnvelopeForm((p) => ({ ...p, multi_year_end: e.target.value }))}
                      className="w-full border rounded px-2 py-1.5 text-sm"
                      placeholder="2027"
                    />
                    {addEnvelopeErrors.multi_year_end && <p className="text-xs text-red-600 mt-1">{addEnvelopeErrors.multi_year_end}</p>}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fiscal Year *</label>
                  <input
                    type="number"
                    value={addEnvelopeForm.fiscal_year}
                    onChange={(e) => setAddEnvelopeForm((p) => ({ ...p, fiscal_year: e.target.value }))}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                    placeholder="2026"
                  />
                  {addEnvelopeErrors.fiscal_year && <p className="text-xs text-red-600 mt-1">{addEnvelopeErrors.fiscal_year}</p>}
                </div>
              )}

              {/* Amounts */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Approved</label>
                  <input
                    type="number"
                    value={addEnvelopeForm.approved_amount}
                    onChange={(e) => setAddEnvelopeForm((p) => ({ ...p, approved_amount: e.target.value }))}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Committed</label>
                  <input
                    type="number"
                    value={addEnvelopeForm.committed_amount}
                    onChange={(e) => setAddEnvelopeForm((p) => ({ ...p, committed_amount: e.target.value }))}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Actual</label>
                  <input
                    type="number"
                    value={addEnvelopeForm.actual_amount}
                    onChange={(e) => setAddEnvelopeForm((p) => ({ ...p, actual_amount: e.target.value }))}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={addEnvelopeForm.notes}
                  onChange={(e) => setAddEnvelopeForm((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowAddEnvelope(false)}
                className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddEnvelopeSubmit}
                disabled={addEnvelopeSubmitting}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {addEnvelopeSubmitting ? "Saving…" : "Add Envelope"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Documents Tab ── */}
      {activeTab === "documents" && (
        <div className="bg-white border rounded-lg shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-sm font-semibold text-gray-700">Documents</h2>
            <button
              onClick={() => { setShowUploadModal(true); setUploadGeneralError(null); setUploadErrors({}); }}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              + Upload Document
            </button>
          </div>

          {docsLoading && (
            <div className="px-6 py-8 text-center text-sm text-gray-500">Loading documents...</div>
          )}
          {docsError && (
            <div className="px-6 py-4 text-sm text-red-600">{docsError}</div>
          )}

          {!docsLoading && !docsError && (() => {
            if (documents.length === 0) {
              return (
                <p className="px-6 py-8 text-sm text-gray-500 text-center">
                  No documents attached yet. Upload one above.
                </p>
              );
            }
            // Group by document type name
            const grouped: Record<string, DocumentRecord[]> = {};
            for (const doc of documents) {
              const typeName = doc.documentType?.name ?? "Uncategorised";
              if (!grouped[typeName]) grouped[typeName] = [];
              grouped[typeName].push(doc);
            }
            return (
              <div className="divide-y">
                {Object.entries(grouped).map(([typeName, docs]) => (
                  <div key={typeName}>
                    <div className="px-6 py-2 bg-gray-50 flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{typeName}</span>
                      <span className="text-xs text-gray-400">({docs.length})</span>
                    </div>
                    <ul className="divide-y">
                      {docs.map((doc) => (
                        <li key={doc.id} className="px-6 py-3 flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-gray-800 truncate">{doc.title}</span>
                              {doc.isVerified && (
                                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">✓ Verified</span>
                              )}
                              {doc.isRequired && !doc.isVerified && (
                                <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Required</span>
                              )}
                              {doc.expiryDate && (
                                <span className="text-xs text-amber-600">Expires {formatDate(doc.expiryDate)}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                              {doc.fileName && <span>{doc.fileName}</span>}
                              {doc.fileSizeBytes && <span>{(doc.fileSizeBytes / 1024).toFixed(0)} KB</span>}
                              <span>Uploaded {formatDate(doc.createdAt)}</span>
                              {doc.lifecycleStage && (
                                <span className="text-blue-500">{doc.lifecycleStage.name}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Download
                            </a>
                            {!doc.isVerified && (
                              <button
                                onClick={() => handleVerifyDoc(doc.id)}
                                disabled={verifyingDocId === doc.id}
                                className="text-xs text-green-700 hover:underline disabled:opacity-50"
                              >
                                {verifyingDocId === doc.id ? "Verifying…" : "Verify"}
                              </button>
                            )}
                            {confirmDeleteDocId === doc.id ? (
                              <span className="flex items-center gap-1">
                                <span className="text-xs text-gray-600">Delete?</span>
                                <button
                                  onClick={() => handleDeleteDoc(doc.id)}
                                  disabled={deletingDocId === doc.id}
                                  className="text-xs text-red-600 hover:underline disabled:opacity-50 font-medium"
                                >
                                  {deletingDocId === doc.id ? "…" : "Yes"}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteDocId(null)}
                                  className="text-xs text-gray-400 hover:underline"
                                >
                                  No
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteDocId(doc.id)}
                                className="text-xs text-red-500 hover:underline"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Upload Document Modal ── */}
      {showUploadModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-800">Upload Document</h3>
              <button
                onClick={() => { setShowUploadModal(false); setUploadFile(null); }}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                ✕
              </button>
            </div>

            {uploadGeneralError && (
              <div className="mb-3 bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">{uploadGeneralError}</div>
            )}

            <div className="space-y-4">
              {/* File drop zone */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">File *</label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setUploadDragOver(true); }}
                  onDragLeave={() => setUploadDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setUploadDragOver(false);
                    const file = e.dataTransfer.files[0];
                    if (file) {
                      setUploadFile(file);
                      if (!uploadForm.title) setUploadForm((p) => ({ ...p, title: file.name.replace(/\.[^.]+$/, "") }));
                    }
                  }}
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                    uploadDragOver ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-blue-300"
                  }`}
                  onClick={() => document.getElementById("doc-file-input")?.click()}
                >
                  {uploadFile ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-700">
                      <span>📄</span>
                      <span className="font-medium truncate max-w-xs">{uploadFile.name}</span>
                      <span className="text-gray-400 text-xs">({(uploadFile.size / 1024).toFixed(0)} KB)</span>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">
                      Drag &amp; drop a file here, or click to browse
                    </p>
                  )}
                  <input
                    id="doc-file-input"
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setUploadFile(file);
                        if (!uploadForm.title) setUploadForm((p) => ({ ...p, title: file.name.replace(/\.[^.]+$/, "") }));
                      }
                    }}
                  />
                </div>
                {uploadErrors.file && <p className="text-xs text-red-600 mt-1">{uploadErrors.file}</p>}
              </div>

              {/* Document type */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Document Type *</label>
                <select
                  value={uploadForm.document_type_id}
                  onChange={(e) => setUploadForm((p) => ({ ...p, document_type_id: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  <option value="">— Select type —</option>
                  {documentTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {uploadErrors.document_type_id && <p className="text-xs text-red-600 mt-1">{uploadErrors.document_type_id}</p>}
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  placeholder="Document title"
                />
                {uploadErrors.title && <p className="text-xs text-red-600 mt-1">{uploadErrors.title}</p>}
              </div>

              {/* Lifecycle stage (optional) */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Lifecycle Stage (optional)</label>
                <select
                  value={uploadForm.lifecycle_stage_id}
                  onChange={(e) => setUploadForm((p) => ({ ...p, lifecycle_stage_id: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  <option value="">— Not linked to a stage —</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Expiry date (optional) */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Expiry Date (optional)</label>
                <input
                  type="date"
                  value={uploadForm.expiry_date}
                  onChange={(e) => setUploadForm((p) => ({ ...p, expiry_date: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                />
              </div>

              {/* Description (optional) */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea
                  rows={2}
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => { setShowUploadModal(false); setUploadFile(null); }}
                className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadSubmit}
                disabled={uploadSubmitting}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {uploadSubmitting ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "overview" && <>
      {/* Lifecycle Stage Stepper */}
      <div className="bg-white border rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Lifecycle Stage</h2>
          <button
            onClick={openTransitionModal}
            className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Transition Stage
          </button>
        </div>
        <div className="overflow-x-auto">
          <div className="flex items-center min-w-max gap-0">
            {stages.map((stage, idx) => {
              const isCompleted = stage.displayOrder < currentStageOrder;
              const isCurrent = stage.displayOrder === currentStageOrder;
              const isLast = idx === stages.length - 1;

              return (
                <div key={stage.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
                        ${isCurrent
                          ? "bg-blue-600 border-blue-600 text-white"
                          : isCompleted
                          ? "bg-green-500 border-green-500 text-white"
                          : "bg-white border-gray-300 text-gray-400"
                        }`}
                    >
                      {isCompleted ? "✓" : stage.displayOrder}
                    </div>
                    <span
                      className={`mt-1 text-center text-xs max-w-16 leading-tight
                        ${isCurrent ? "text-blue-700 font-semibold" : isCompleted ? "text-green-700" : "text-gray-400"}`}
                      style={{ maxWidth: "64px" }}
                    >
                      {stage.name}
                    </span>
                  </div>
                  {!isLast && (
                    <div
                      className={`h-0.5 w-8 mx-1 ${
                        isCompleted ? "bg-green-400" : "bg-gray-200"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Core Fields */}
      <div className="bg-white border rounded-lg p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Core Fields</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-gray-500">Address</dt>
            <dd className="text-sm text-gray-800 mt-0.5">{asset.address ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Area (sqm)</dt>
            <dd className="text-sm text-gray-800 mt-0.5">
              {asset.areaSqm ? `${Number(asset.areaSqm).toLocaleString()} m²` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Service Start Date</dt>
            <dd className="text-sm text-gray-800 mt-0.5">{formatDate(asset.serviceStartDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Handover Date</dt>
            <dd className="text-sm text-gray-800 mt-0.5">{formatDate(asset.handoverDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Decommission Date</dt>
            <dd className="text-sm text-gray-800 mt-0.5">{formatDate(asset.decommissionDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">GIS Reference</dt>
            <dd className="text-sm text-gray-800 mt-0.5">{asset.gisReference ?? "—"}</dd>
          </div>
          {asset.parentAsset && (
            <div>
              <dt className="text-xs text-gray-500">Parent Asset</dt>
              <dd className="text-sm mt-0.5">
                <Link
                  href={`/assets/${asset.parentAsset.id}`}
                  className="text-blue-600 hover:underline"
                >
                  {asset.parentAsset.assetCode} — {asset.parentAsset.assetName}
                </Link>
              </dd>
            </div>
          )}
          {asset.notes && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-gray-500">Notes</dt>
              <dd className="text-sm text-gray-800 mt-0.5 whitespace-pre-wrap">{asset.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Responsible Bodies */}
      <div className="bg-white border rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Responsible Bodies</h2>
          <button
            onClick={() => {
              setShowEditAssignments(!showEditAssignments);
              if (!bodiesLoaded) fetchAllBodies();
            }}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            {showEditAssignments ? "Done Editing" : "Edit Assignments"}
          </button>
        </div>

        {(() => {
          const BODY_ROLES: Array<{ transferType: string; roleLabel: string; currentBody: ResponsibleBodyRef | null }> = [
            { transferType: "strategic_owner", roleLabel: "Strategic Owner", currentBody: asset.strategicOwnerBody },
            { transferType: "responsible_body", roleLabel: "Responsible Body", currentBody: asset.responsibleBody },
            { transferType: "operational_body", roleLabel: "Operational Body", currentBody: asset.operationalBody },
            { transferType: "maintenance_body", roleLabel: "Maintenance Body", currentBody: asset.maintenanceBody },
            { transferType: "data_steward", roleLabel: "Data Steward", currentBody: asset.dataStewardBody },
          ];

          if (!showEditAssignments) {
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {BODY_ROLES.map(({ roleLabel, currentBody }) => (
                  <BodyCard key={roleLabel} role={roleLabel} body={currentBody} />
                ))}
              </div>
            );
          }

          return (
            <div className="space-y-3">
              {BODY_ROLES.map(({ transferType, roleLabel, currentBody }) => {
                const query = bodySearchQuery[transferType] ?? "";
                const isOpen = bodySearchOpen[transferType] ?? false;
                const filtered = allBodies.filter(b =>
                  b.name.toLowerCase().includes(query.toLowerCase())
                );
                return (
                  <div key={transferType} className="border rounded p-3 bg-gray-50">
                    <p className="text-xs font-medium text-gray-600 mb-1">{roleLabel}</p>
                    <p className="text-xs text-gray-400 mb-2">
                      Current:{" "}
                      <span className="text-gray-700 font-medium">
                        {currentBody ? currentBody.name : "Not assigned"}
                      </span>
                      {currentBody?.isPlaceholder && (
                        <span className="ml-1 text-xs bg-amber-100 text-amber-700 px-1 rounded">TBD</span>
                      )}
                    </p>
                    <div className="relative">
                      <input
                        type="text"
                        className="w-full border rounded px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                        placeholder="Search for a body to assign..."
                        value={query}
                        onFocus={() => {
                          setBodySearchOpen(prev => ({ ...prev, [transferType]: true }));
                          if (!bodiesLoaded) fetchAllBodies();
                        }}
                        onChange={e => setBodySearchQuery(prev => ({ ...prev, [transferType]: e.target.value }))}
                        onBlur={() => setTimeout(() => setBodySearchOpen(prev => ({ ...prev, [transferType]: false })), 200)}
                      />
                      {isOpen && filtered.length > 0 && (
                        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border rounded shadow-lg max-h-48 overflow-y-auto">
                          {filtered.slice(0, 20).map(b => (
                            <div
                              key={b.id}
                              onMouseDown={() => {
                                setPendingBodyTransfer({ transferType, roleLabel, fromBody: currentBody, toBody: b });
                                setBodyTransferReason("");
                                setBodyTransferError(null);
                                setBodySearchOpen(prev => ({ ...prev, [transferType]: false }));
                                setBodySearchQuery(prev => ({ ...prev, [transferType]: "" }));
                              }}
                              className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer flex items-center gap-2"
                            >
                              <span>{b.name}</span>
                              {b.isPlaceholder && (
                                <span className="text-xs bg-amber-100 text-amber-700 px-1 rounded">⚠ TBD</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Body Transfer History collapsible */}
        <div className="mt-4 border-t pt-3">
          <button
            onClick={() => {
              if (!showBodyHistory) fetchBodyTransferHistory();
              setShowBodyHistory(v => !v);
            }}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <span>{showBodyHistory ? "▼" : "▶"}</span>
            Body Transfer History
          </button>
          {showBodyHistory && (
            <div className="mt-3">
              {bodyHistoryLoading ? (
                <p className="text-xs text-gray-400">Loading...</p>
              ) : bodyTransferHistory.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No body transfers recorded.</p>
              ) : (
                <ul className="space-y-2">
                  {bodyTransferHistory.map(t => (
                    <li key={t.id} className="text-xs bg-gray-50 rounded p-2 border">
                      <span className="font-medium text-gray-700">{formatLabel(t.transferType)}</span>
                      {" "}transferred from{" "}
                      <span className="text-gray-800">{t.fromBody?.name ?? "—"}</span>
                      {" "}to{" "}
                      <span className="text-gray-800">{t.toBody?.name ?? "—"}</span>
                      <span className="text-gray-400 ml-2">{formatDate(t.createdAt)}</span>
                      {t.reason && (
                        <p className="text-gray-500 mt-0.5 italic">&ldquo;{t.reason}&rdquo;</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Child Assets */}
      {asset.childAssets.length > 0 && (
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Child Assets ({asset.childAssets.length})
          </h2>
          <ul className="divide-y">
            {asset.childAssets.map((child) => (
              <li key={child.id} className="py-2 flex items-center justify-between">
                <Link
                  href={`/assets/${child.id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {child.assetCode} — {child.assetName}
                </Link>
                <Badge
                  label={formatLabel(child.currentStatus)}
                  colorClass={STATUS_COLORS[child.currentStatus] ?? "bg-gray-100 text-gray-700"}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      </> /* end activeTab === "overview" */}

      {/* ── Events Tab ── */}
      {activeTab === "events" && (() => {
        const CATEGORY_COLORS: Record<string, string> = {
          business: "bg-blue-100 text-blue-700",
          operational: "bg-green-100 text-green-700",
          governance: "bg-purple-100 text-purple-700",
        };

        const handleApplyFilter = () => {
          setEvents([]);
          fetchEvents(1, eventsFilter);
        };

        const handleLoadMore = () => {
          fetchEvents(eventsPage + 1, eventsFilter);
        };

        const groupedEventTypes: Record<string, EventType[]> = {};
        for (const et of eventTypes) {
          if (!groupedEventTypes[et.category]) groupedEventTypes[et.category] = [];
          groupedEventTypes[et.category].push(et);
        }

        return (
          <div className="space-y-4">
            {/* Filter bar */}
            <div className="bg-white border rounded-lg p-4 shadow-sm">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                  <select
                    value={eventsFilter.category}
                    onChange={(e) => setEventsFilter((p) => ({ ...p, category: e.target.value }))}
                    className="border rounded px-2 py-1.5 text-sm"
                  >
                    <option value="">All categories</option>
                    <option value="business">Business</option>
                    <option value="operational">Operational</option>
                    <option value="governance">Governance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                  <input
                    type="date"
                    value={eventsFilter.dateFrom}
                    onChange={(e) => setEventsFilter((p) => ({ ...p, dateFrom: e.target.value }))}
                    className="border rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                  <input
                    type="date"
                    value={eventsFilter.dateTo}
                    onChange={(e) => setEventsFilter((p) => ({ ...p, dateTo: e.target.value }))}
                    className="border rounded px-2 py-1.5 text-sm"
                  />
                </div>
                <button
                  onClick={handleApplyFilter}
                  className="px-3 py-1.5 text-sm bg-gray-700 text-white rounded hover:bg-gray-800"
                >
                  Apply
                </button>
                <button
                  onClick={() => {
                    const cleared = { category: "", dateFrom: "", dateTo: "" };
                    setEventsFilter(cleared);
                    setEvents([]);
                    fetchEvents(1, cleared);
                  }}
                  className="px-3 py-1.5 text-sm text-gray-500 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Clear
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => { setShowAddEventModal(true); setAddEventGeneralError(null); setAddEventErrors({}); }}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  + Add Event
                </button>
              </div>
            </div>

            {/* Event list */}
            <div className="bg-white border rounded-lg shadow-sm">
              {eventsLoading && events.length === 0 && (
                <div className="px-6 py-8 text-center text-sm text-gray-500">Loading events...</div>
              )}
              {eventsError && (
                <div className="px-6 py-4 text-sm text-red-600">{eventsError}</div>
              )}
              {!eventsLoading && !eventsError && events.length === 0 && (
                <p className="px-6 py-8 text-sm text-gray-500 text-center">
                  No events recorded yet. Add one above.
                </p>
              )}

              {events.length > 0 && (
                <>
                  <div className="px-6 py-3 border-b text-xs text-gray-400 flex justify-between">
                    <span>Showing {events.length} of {eventsTotal} events</span>
                  </div>
                  <ul className="divide-y">
                    {events.map((event) => {
                      const meta = event.metadata ?? {};
                      const warningsOverridden = meta.warnings_overridden === true;
                      const justificationText = typeof meta.justification === "string" ? meta.justification : null;
                      const catColor = CATEGORY_COLORS[event.eventType?.category ?? ""] ?? "bg-gray-100 text-gray-600";

                      return (
                        <li key={event.id} className="px-6 py-4">
                          <div className="flex items-start gap-3">
                            {/* Icon */}
                            <div className="flex-shrink-0 mt-0.5 text-base">
                              {event.isSystemGenerated ? "🤖" : "📋"}
                            </div>

                            <div className="flex-1 min-w-0">
                              {/* Header row */}
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-sm font-medium text-gray-800">
                                  {event.eventType?.name ?? "Unknown Event"}
                                </span>
                                {event.eventType?.category && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${catColor}`}>
                                    {event.eventType.category}
                                  </span>
                                )}
                                {warningsOverridden && (
                                  <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-medium">
                                    ⚠ Warnings overridden
                                  </span>
                                )}
                              </div>

                              {/* Meta row */}
                              <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap mb-1">
                                <span>{formatDate(event.occurredAt)}</span>
                                {event.responsibleBody && (
                                  <span className="text-blue-500">{event.responsibleBody.name}</span>
                                )}
                                {event.lifecycleStage && (
                                  <span className="italic">{event.lifecycleStage.name}</span>
                                )}
                              </div>

                              {/* Description */}
                              {event.description && (
                                <p className="text-sm text-gray-700 mt-1">{event.description}</p>
                              )}

                              {/* Justification for overridden warnings */}
                              {warningsOverridden && justificationText && (
                                <div className="mt-1 bg-yellow-50 border border-yellow-200 rounded px-2 py-1 text-xs text-yellow-800">
                                  <span className="font-medium">Justification: </span>{justificationText}
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {events.length < eventsTotal && (
                    <div className="px-6 py-4 border-t text-center">
                      <button
                        onClick={handleLoadMore}
                        disabled={eventsLoading}
                        className="text-sm text-blue-600 hover:underline disabled:opacity-50"
                      >
                        {eventsLoading ? "Loading…" : `Load more (${eventsTotal - events.length} remaining)`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Add Event Modal */}
            {showAddEventModal && (
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-gray-800">Add Event</h3>
                    <button
                      onClick={() => setShowAddEventModal(false)}
                      className="text-gray-400 hover:text-gray-600 text-lg"
                    >
                      ✕
                    </button>
                  </div>

                  {addEventGeneralError && (
                    <div className="mb-3 bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">
                      {addEventGeneralError}
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Event type — grouped by category */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Event Type *</label>
                      <select
                        value={addEventForm.event_type_id}
                        onChange={(e) => setAddEventForm((p) => ({ ...p, event_type_id: e.target.value }))}
                        className="w-full border rounded px-2 py-1.5 text-sm"
                      >
                        <option value="">— Select event type —</option>
                        {Object.entries(groupedEventTypes).map(([cat, types]) => (
                          <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                            {types.map((et) => (
                              <option key={et.id} value={et.id}>{et.name.replace(/_/g, " ")}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      {addEventErrors.event_type_id && (
                        <p className="text-xs text-red-600 mt-1">{addEventErrors.event_type_id}</p>
                      )}
                    </div>

                    {/* Occurred at */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Occurred At (optional — defaults to now)</label>
                      <input
                        type="datetime-local"
                        value={addEventForm.occurred_at}
                        onChange={(e) => setAddEventForm((p) => ({ ...p, occurred_at: e.target.value }))}
                        className="w-full border rounded px-2 py-1.5 text-sm"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Description (optional)</label>
                      <textarea
                        rows={3}
                        value={addEventForm.description}
                        onChange={(e) => setAddEventForm((p) => ({ ...p, description: e.target.value }))}
                        className="w-full border rounded px-2 py-1.5 text-sm"
                        placeholder="Describe what happened..."
                      />
                    </div>

                    {/* Responsible body */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Responsible Body (optional)</label>
                      <input
                        type="text"
                        value={addEventForm.responsible_body_id}
                        onChange={(e) => setAddEventForm((p) => ({ ...p, responsible_body_id: e.target.value }))}
                        className="w-full border rounded px-2 py-1.5 text-sm"
                        placeholder="Body ID (if applicable)"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-5">
                    <button
                      onClick={() => setShowAddEventModal(false)}
                      className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddEventSubmit}
                      disabled={addEventSubmitting}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {addEventSubmitting ? "Saving…" : "Add Event"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Contracts Tab ── */}
      {activeTab === "contracts" && (() => {
        const now = new Date();
        const in90 = new Date();
        in90.setDate(in90.getDate() + 90);

        function contractStatusColor(status: string): string {
          if (status === "active") return "bg-green-100 text-green-800";
          if (status === "draft") return "bg-gray-100 text-gray-700";
          if (status === "expired") return "bg-red-100 text-red-700";
          if (status === "terminated") return "bg-orange-100 text-orange-700";
          if (status === "renewed") return "bg-blue-100 text-blue-700";
          return "bg-gray-100 text-gray-700";
        }

        function getExpiryBadge(endDate: string | null, status: string): { label: string; color: string } | null {
          if (!endDate || status === "expired" || status === "terminated" || status === "renewed") return null;
          const end = new Date(endDate);
          if (end < now) return { label: "Expired", color: "bg-red-100 text-red-700" };
          if (end <= in90) return { label: "Expiring soon", color: "bg-amber-100 text-amber-700" };
          return null;
        }

        const PAYMENT_FREQ_OPTIONS = ["monthly", "quarterly", "annually", "one_off", "other"];
        const COUNTERPARTY_TYPES = ["tenant", "supplier", "operator", "developer", "authority", "other"];

        function ContractFormFields({ form, setForm, errors }: {
          form: AddContractForm;
          setForm: React.Dispatch<React.SetStateAction<AddContractForm>>;
          errors?: Partial<Record<keyof AddContractForm, string>>;
        }) {
          return (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Contract Type *</label>
                <select
                  value={form.contract_type_id}
                  onChange={(e) => setForm((p) => ({ ...p, contract_type_id: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  <option value="">— Select type —</option>
                  {contractTypes.map((ct) => (
                    <option key={ct.id} value={ct.id}>{ct.name}</option>
                  ))}
                </select>
                {errors?.contract_type_id && <p className="text-xs text-red-600 mt-1">{errors.contract_type_id}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Counterparty Name *</label>
                <input
                  type="text"
                  value={form.counterparty_name}
                  onChange={(e) => setForm((p) => ({ ...p, counterparty_name: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  placeholder="Company or individual name"
                />
                {errors?.counterparty_name && <p className="text-xs text-red-600 mt-1">{errors.counterparty_name}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Counterparty Type</label>
                <select
                  value={form.counterparty_type}
                  onChange={(e) => setForm((p) => ({ ...p, counterparty_type: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                >
                  {COUNTERPARTY_TYPES.map((t) => (
                    <option key={t} value={t}>{formatLabel(t)}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                  {errors?.start_date && <p className="text-xs text-red-600 mt-1">{errors.start_date}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Contract Value</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.contract_value}
                    onChange={(e) => setForm((p) => ({ ...p, contract_value: e.target.value }))}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Periodic Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.periodic_amount}
                    onChange={(e) => setForm((p) => ({ ...p, periodic_amount: e.target.value }))}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Payment Frequency</label>
                  <select
                    value={form.payment_frequency}
                    onChange={(e) => setForm((p) => ({ ...p, payment_frequency: e.target.value }))}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  >
                    <option value="">— None —</option>
                    {PAYMENT_FREQ_OPTIONS.map((f) => (
                      <option key={f} value={f}>{formatLabel(f)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notice Period (days)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.notice_period_days}
                    onChange={(e) => setForm((p) => ({ ...p, notice_period_days: e.target.value }))}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                    placeholder="e.g. 30"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.renewal_option}
                    onChange={(e) => setForm((p) => ({ ...p, renewal_option: e.target.checked }))}
                    className="rounded"
                  />
                  Renewal Option
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.auto_renewal}
                    onChange={(e) => setForm((p) => ({ ...p, auto_renewal: e.target.checked }))}
                    className="rounded"
                  />
                  Auto Renewal
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full border rounded px-2 py-1.5 text-sm"
                  placeholder="Optional notes..."
                />
              </div>
            </div>
          );
        }

        return (
          <div className="bg-white border rounded-lg shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-sm font-semibold text-gray-700">Contracts</h2>
              <button
                onClick={() => { setShowAddContractModal(true); setAddContractGeneralError(null); setAddContractErrors({}); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <span className="text-base leading-none">+</span> Add Contract
              </button>
            </div>

            {contractsLoading ? (
              <div className="px-6 py-8 text-center text-sm text-gray-500">Loading contracts…</div>
            ) : contractsError ? (
              <div className="px-6 py-4 text-sm text-red-600">{contractsError}</div>
            ) : contracts.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-400">No contracts found for this asset.</div>
            ) : (
              <div className="divide-y">
                {contracts.map((c) => {
                  const expiryBadge = getExpiryBadge(c.endDate, c.status);
                  const isExpanded = expandedContractIds.has(c.id);
                  const history = contractHistory[c.id] ?? [];

                  return (
                    <Fragment key={c.id}>
                      <div className="px-6 py-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-gray-900">
                                {c.contractReference ?? "—"}
                              </span>
                              {c.contractType && (
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                  {c.contractType.name}
                                </span>
                              )}
                              <Badge label={formatLabel(c.status)} colorClass={contractStatusColor(c.status)} />
                              {expiryBadge && (
                                <Badge label={expiryBadge.label} colorClass={expiryBadge.color} />
                              )}
                            </div>
                            <p className="text-sm text-gray-700">{c.counterpartyName}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{formatLabel(c.counterpartyType)}</p>
                            <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
                              <span>Start: <span className="text-gray-700">{formatDate(c.startDate)}</span></span>
                              <span>End: <span className="text-gray-700">{formatDate(c.endDate)}</span></span>
                              {c.contractValue && (
                                <span>Value: <span className="text-gray-700">₪{parseFloat(c.contractValue).toLocaleString()}</span></span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => openEditContract(c)}
                              className="px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => openRenewContract(c)}
                              disabled={c.status === "terminated" || c.status === "renewed"}
                              className="px-2 py-1 text-xs text-blue-600 border border-blue-300 rounded hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Renew
                            </button>
                            <Link
                              href={`/documents?entity_type=contract&entity_id=${c.id}`}
                              className="px-2 py-1 text-xs text-purple-600 border border-purple-300 rounded hover:bg-purple-50"
                            >
                              Docs
                            </Link>
                            <button
                              onClick={() => toggleContractHistory(c)}
                              className="px-2 py-1 text-xs text-gray-500 border border-gray-200 rounded hover:bg-gray-50"
                            >
                              {isExpanded ? "Hide history" : "History"}
                            </button>
                          </div>
                        </div>

                        {/* Collapsible history */}
                        {isExpanded && (
                          <div className="mt-3 ml-4 border-l-2 border-gray-200 pl-4">
                            {history.length === 0 ? (
                              <p className="text-xs text-gray-400 italic">No renewal history found.</p>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Renewal History</p>
                                {history.map((h) => (
                                  <div key={h.id} className="flex items-center gap-3 text-xs text-gray-600">
                                    <span className="font-medium">{h.contractReference ?? "—"}</span>
                                    <Badge label={formatLabel(h.status)} colorClass={contractStatusColor(h.status)} />
                                    <span>{formatDate(h.startDate)} → {formatDate(h.endDate)}</span>
                                    {h.contractValue && <span>₪{parseFloat(h.contractValue).toLocaleString()}</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            )}

            {/* Add Contract Modal */}
            {showAddContractModal && (
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-gray-800">Add Contract</h3>
                    <button onClick={() => setShowAddContractModal(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                  </div>
                  {addContractGeneralError && (
                    <div className="mb-3 bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">{addContractGeneralError}</div>
                  )}
                  <ContractFormFields form={addContractForm} setForm={setAddContractForm} errors={addContractErrors} />
                  <div className="flex justify-end gap-2 mt-5">
                    <button onClick={() => setShowAddContractModal(false)} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                    <button onClick={handleAddContractSubmit} disabled={addContractSubmitting} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                      {addContractSubmitting ? "Saving…" : "Create Contract"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Contract Modal */}
            {editContract && (
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-gray-800">Edit Contract — {editContract.contractReference ?? editContract.id.substring(0, 8)}</h3>
                    <button onClick={() => setEditContract(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                  </div>
                  {editContractGeneralError && (
                    <div className="mb-3 bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">{editContractGeneralError}</div>
                  )}
                  <ContractFormFields form={editContractForm} setForm={setEditContractForm} />
                  <div className="flex justify-end gap-2 mt-5">
                    <button onClick={() => setEditContract(null)} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                    <button onClick={handleEditContractSubmit} disabled={editContractSubmitting} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                      {editContractSubmitting ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Renew Contract Modal */}
            {renewContract && (
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-gray-800">Renew Contract</h3>
                    <button onClick={() => setRenewContract(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Renewing: <span className="font-medium">{renewContract.contractReference ?? renewContract.id.substring(0, 8)}</span>
                    {" "}with <span className="font-medium">{renewContract.counterpartyName}</span>
                  </p>
                  {renewError && (
                    <div className="mb-3 bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">{renewError}</div>
                  )}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">New Start Date *</label>
                      <input
                        type="date"
                        value={renewStartDate}
                        onChange={(e) => setRenewStartDate(e.target.value)}
                        className="w-full border rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">New End Date (optional)</label>
                      <input
                        type="date"
                        value={renewEndDate}
                        onChange={(e) => setRenewEndDate(e.target.value)}
                        className="w-full border rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-5">
                    <button onClick={() => setRenewContract(null)} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                    <button onClick={handleRenewSubmit} disabled={renewSubmitting} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                      {renewSubmitting ? "Renewing…" : "Confirm Renewal"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Work Orders Tab ── */}
      {activeTab === "work_orders" && (() => {
        const WO_PRIORITY_COLORS: Record<string, string> = {
          critical: "bg-red-100 text-red-800",
          high: "bg-orange-100 text-orange-800",
          medium: "bg-yellow-100 text-yellow-800",
          low: "bg-green-100 text-green-800",
        };
        const WO_STATUS_COLORS: Record<string, string> = {
          open: "bg-blue-100 text-blue-800",
          assigned: "bg-indigo-100 text-indigo-800",
          in_progress: "bg-purple-100 text-purple-800",
          pending_approval: "bg-amber-100 text-amber-800",
          closed: "bg-green-100 text-green-800",
          cancelled: "bg-gray-100 text-gray-700",
        };
        const STATUS_PIPELINE_STEPS = ["open", "assigned", "in_progress", "pending_approval", "closed"] as const;

        function woIsOverdue(wo: AssetWorkOrder): boolean {
          if (!wo.targetCompletionDate) return false;
          if (wo.status === "closed" || wo.status === "cancelled") return false;
          return new Date(wo.targetCompletionDate) < new Date();
        }

        return (
          <div className="bg-white border rounded-lg shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-sm font-semibold text-gray-700">
                Work Orders {woTotal > 0 && <span className="text-gray-400 font-normal">({woTotal})</span>}
              </h2>
              <button
                onClick={() => {
                  setCreateWOForm({ category_id: "", title: "", description: "", priority: "medium", target_completion_date: "", notes: "" });
                  setCreateWOErrors({});
                  setCreateWOGeneralError(null);
                  setShowCreateWO(true);
                }}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                + Create Work Order
              </button>
            </div>

            {woLoading && (
              <div className="px-6 py-8 text-center text-sm text-gray-500">Loading work orders...</div>
            )}
            {!woLoading && woError && (
              <div className="px-6 py-8 text-center text-sm text-red-600">{woError}</div>
            )}
            {!woLoading && !woError && assetWorkOrders.length === 0 && (
              <div className="px-6 py-8 text-center text-sm text-gray-500">
                No work orders for this asset yet.
              </div>
            )}
            {!woLoading && !woError && assetWorkOrders.length > 0 && (
              <div className="divide-y">
                {assetWorkOrders.map((wo) => {
                  const overdue = woIsOverdue(wo);
                  const currentIdx = STATUS_PIPELINE_STEPS.indexOf(wo.status as typeof STATUS_PIPELINE_STEPS[number]);
                  return (
                    <div
                      key={wo.id}
                      className="px-6 py-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedWO(wo)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-mono text-xs text-gray-400">{wo.workOrderNumber}</span>
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${WO_PRIORITY_COLORS[wo.priority] ?? "bg-gray-100 text-gray-700"}`}
                            >
                              {wo.priority.charAt(0).toUpperCase() + wo.priority.slice(1)}
                            </span>
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${WO_STATUS_COLORS[wo.status] ?? "bg-gray-100 text-gray-700"}`}
                            >
                              {formatLabel(wo.status)}
                            </span>
                            {overdue && (
                              <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                                Overdue
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-medium text-gray-900 truncate">{wo.title}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-gray-500">
                            {wo.category && <span>{wo.category.name}</span>}
                            {wo.assignedToBody && <span>Assigned: {wo.assignedToBody.name}</span>}
                            {wo.targetCompletionDate && (
                              <span className={overdue ? "text-red-600 font-medium" : ""}>
                                Due: {formatDate(wo.targetCompletionDate)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Status pipeline */}
                      <div className="flex items-center gap-1 mt-2 flex-wrap">
                        {STATUS_PIPELINE_STEPS.map((s, idx) => {
                          const isActive = s === wo.status;
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
                              {idx < STATUS_PIPELINE_STEPS.length - 1 && (
                                <span className="text-gray-300 text-xs">→</span>
                              )}
                            </Fragment>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Create Work Order modal */}
            {showCreateWO && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h3 className="text-base font-semibold text-gray-900">Create Work Order</h3>
                    <button
                      onClick={() => setShowCreateWO(false)}
                      className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                    >✕</button>
                  </div>
                  <div className="px-6 py-4 space-y-3">
                    {createWOGeneralError && (
                      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                        {createWOGeneralError}
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Category *</label>
                      <select
                        value={createWOForm.category_id}
                        onChange={(e) => setCreateWOForm((p) => ({ ...p, category_id: e.target.value }))}
                        className="w-full border rounded px-2 py-1.5 text-sm"
                      >
                        <option value="">— Select category —</option>
                        {woCategories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      {createWOErrors.category_id && (
                        <p className="text-xs text-red-600 mt-1">{createWOErrors.category_id}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
                      <input
                        type="text"
                        value={createWOForm.title}
                        onChange={(e) => setCreateWOForm((p) => ({ ...p, title: e.target.value }))}
                        className="w-full border rounded px-2 py-1.5 text-sm"
                        placeholder="Brief description of the work"
                      />
                      {createWOErrors.title && (
                        <p className="text-xs text-red-600 mt-1">{createWOErrors.title}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
                      <select
                        value={createWOForm.priority}
                        onChange={(e) => setCreateWOForm((p) => ({ ...p, priority: e.target.value }))}
                        className="w-full border rounded px-2 py-1.5 text-sm"
                      >
                        {["critical", "high", "medium", "low"].map((pr) => (
                          <option key={pr} value={pr}>{formatLabel(pr)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Target Completion Date</label>
                      <input
                        type="date"
                        value={createWOForm.target_completion_date}
                        onChange={(e) => setCreateWOForm((p) => ({ ...p, target_completion_date: e.target.value }))}
                        className="w-full border rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={createWOForm.description}
                        onChange={(e) => setCreateWOForm((p) => ({ ...p, description: e.target.value }))}
                        rows={3}
                        className="w-full border rounded px-2 py-1.5 text-sm resize-none"
                        placeholder="Detailed description..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                      <textarea
                        value={createWOForm.notes}
                        onChange={(e) => setCreateWOForm((p) => ({ ...p, notes: e.target.value }))}
                        rows={2}
                        className="w-full border rounded px-2 py-1.5 text-sm resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 px-6 py-4 border-t">
                    <button
                      onClick={() => setShowCreateWO(false)}
                      className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateWOSubmit}
                      disabled={createWOSubmitting}
                      className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {createWOSubmitting ? "Creating..." : "Create Work Order"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Work Order Detail Modal */}
            {selectedWO && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between px-6 py-4 border-b">
                    <div>
                      <p className="text-xs text-gray-500 font-mono">{selectedWO.workOrderNumber}</p>
                      <h3 className="text-lg font-semibold text-gray-900">{selectedWO.title}</h3>
                    </div>
                    <button
                      onClick={() => setSelectedWO(null)}
                      className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                    >✕</button>
                  </div>
                  <div className="px-6 py-4 space-y-4">
                    {/* Status pipeline */}
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Status Pipeline</p>
                      <div className="flex items-center gap-1 flex-wrap">
                        {STATUS_PIPELINE_STEPS.map((s, idx) => {
                          const isActive = s === selectedWO.status;
                          const isDone = STATUS_PIPELINE_STEPS.indexOf(selectedWO.status as typeof STATUS_PIPELINE_STEPS[number]) > idx;
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
                              {idx < STATUS_PIPELINE_STEPS.length - 1 && (
                                <span className="text-gray-300 text-xs">→</span>
                              )}
                            </Fragment>
                          );
                        })}
                      </div>
                    </div>
                    {/* Badges */}
                    <div className="flex flex-wrap gap-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${WO_PRIORITY_COLORS[selectedWO.priority] ?? "bg-gray-100 text-gray-700"}`}>
                        {formatLabel(selectedWO.priority)}
                      </span>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${WO_STATUS_COLORS[selectedWO.status] ?? "bg-gray-100 text-gray-700"}`}>
                        {formatLabel(selectedWO.status)}
                      </span>
                      {woIsOverdue(selectedWO) && (
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Overdue</span>
                      )}
                    </div>
                    {/* Info grid */}
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                      <div>
                        <dt className="text-xs text-gray-500">Category</dt>
                        <dd className="font-medium text-gray-800">{selectedWO.category?.name ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500">Assigned Body</dt>
                        <dd className="font-medium text-gray-800">{selectedWO.assignedToBody?.name ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500">Target Completion</dt>
                        <dd className={`font-medium ${woIsOverdue(selectedWO) ? "text-red-700" : "text-gray-800"}`}>
                          {formatDate(selectedWO.targetCompletionDate)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500">Actual Completion</dt>
                        <dd className="font-medium text-gray-800">{formatDate(selectedWO.actualCompletionDate)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500">Estimated Cost</dt>
                        <dd className="font-medium text-gray-800">
                          {selectedWO.estimatedCost ? `₪${Number(selectedWO.estimatedCost).toLocaleString()}` : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500">Lifecycle Stage</dt>
                        <dd className="font-medium text-gray-800">{selectedWO.lifecycleStage?.name ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500">Created</dt>
                        <dd className="font-medium text-gray-800">{formatDate(selectedWO.createdAt)}</dd>
                      </div>
                    </dl>
                    {selectedWO.description && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Description</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedWO.description}</p>
                      </div>
                    )}
                    {selectedWO.notes && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedWO.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Condition Tab */}
      {activeTab === "condition" && (() => {
        const SCORE_COLORS: Record<number, string> = {
          5: "bg-green-100 text-green-800 border-green-300",
          4: "bg-lime-100 text-lime-800 border-lime-300",
          3: "bg-amber-100 text-amber-800 border-amber-300",
          2: "bg-orange-100 text-orange-800 border-orange-300",
          1: "bg-red-100 text-red-800 border-red-300",
        };
        const SCORE_LABELS: Record<number, string> = {
          5: "Excellent", 4: "Good", 3: "Fair", 2: "Poor", 1: "Critical",
        };

        return (
          <div className="space-y-6">
            {/* Current Condition Card */}
            <div className="bg-white border rounded-lg shadow-sm">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h2 className="text-sm font-semibold text-gray-700">Current Condition</h2>
                <button
                  onClick={() => {
                    setRecordInspectionForm({
                      inspection_date: new Date().toISOString().substring(0, 10),
                      condition_score: "3",
                      structural_condition: "",
                      safety_condition: "",
                      maintenance_priority: "none",
                      replacement_urgency: "none",
                      notes: "",
                      next_inspection_due: "",
                    });
                    setRecordInspectionErrors({});
                    setRecordInspectionGeneralError(null);
                    setShowRecordInspection(true);
                  }}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  + Record Inspection
                </button>
              </div>

              {conditionLoading && (
                <div className="px-6 py-8 text-center text-sm text-gray-500">Loading condition records...</div>
              )}
              {!conditionLoading && conditionError && (
                <div className="px-6 py-4 text-sm text-red-600">{conditionError}</div>
              )}
              {!conditionLoading && !conditionError && !currentCondition && (
                <div className="px-6 py-8 text-center text-sm text-gray-500">
                  No condition records yet. Record the first inspection above.
                </div>
              )}
              {!conditionLoading && !conditionError && currentCondition && (
                <div className="px-6 py-6">
                  {/* Score card */}
                  <div className={`inline-flex flex-col items-center justify-center w-28 h-28 rounded-xl border-2 text-center mb-6 ${SCORE_COLORS[currentCondition.conditionScore] ?? "bg-gray-100 text-gray-700 border-gray-300"}`}>
                    <span className="text-4xl font-bold">{currentCondition.conditionScore}</span>
                    <span className="text-xs font-semibold mt-1">{SCORE_LABELS[currentCondition.conditionScore] ?? "—"}</span>
                  </div>

                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                    <div>
                      <dt className="text-xs text-gray-500">Structural Condition</dt>
                      <dd className="font-medium text-gray-800">{currentCondition.structuralCondition ? formatLabel(currentCondition.structuralCondition) : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Safety Condition</dt>
                      <dd className={`font-medium ${currentCondition.safetyCondition === "unsafe" || currentCondition.safetyCondition === "major_hazard" ? "text-red-700" : "text-gray-800"}`}>
                        {currentCondition.safetyCondition ? formatLabel(currentCondition.safetyCondition) : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Maintenance Priority</dt>
                      <dd className="font-medium text-gray-800">{currentCondition.maintenancePriority ? formatLabel(currentCondition.maintenancePriority) : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Replacement Urgency</dt>
                      <dd className="font-medium text-gray-800">{currentCondition.replacementUrgency ? formatLabel(currentCondition.replacementUrgency) : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Inspection Date</dt>
                      <dd className="font-medium text-gray-800">{formatDate(currentCondition.inspectionDate)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">Next Inspection Due</dt>
                      <dd className={`font-medium ${currentCondition.nextInspectionDue && new Date(currentCondition.nextInspectionDue) < new Date() ? "text-red-700" : "text-gray-800"}`}>
                        {formatDate(currentCondition.nextInspectionDue)}
                      </dd>
                    </div>
                    {currentCondition.inspectedByBody && (
                      <div>
                        <dt className="text-xs text-gray-500">Inspected By</dt>
                        <dd className="font-medium text-gray-800">{currentCondition.inspectedByBody.name}</dd>
                      </div>
                    )}
                    {currentCondition.notes && (
                      <div className="col-span-2 sm:col-span-3">
                        <dt className="text-xs text-gray-500">Notes</dt>
                        <dd className="text-gray-700 text-sm whitespace-pre-wrap">{currentCondition.notes}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}
            </div>

            {/* Condition History */}
            {!conditionLoading && !conditionError && conditionRecords.length > 1 && (
              <div className="bg-white border rounded-lg shadow-sm">
                <div className="px-6 py-4 border-b">
                  <h2 className="text-sm font-semibold text-gray-700">Condition History</h2>
                </div>
                <div className="px-6 py-4">
                  <ol className="relative border-l border-gray-200 space-y-6">
                    {conditionRecords.slice(1).map((rec) => (
                      <li key={rec.id} className="ml-4">
                        <div className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full border border-white bg-gray-400"></div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border text-sm font-bold ${SCORE_COLORS[rec.conditionScore] ?? "bg-gray-100 text-gray-700 border-gray-300"}`}>
                            {rec.conditionScore}
                          </span>
                          <span className="text-sm font-medium text-gray-800">{SCORE_LABELS[rec.conditionScore] ?? "—"}</span>
                          <span className="text-xs text-gray-500">{formatDate(rec.inspectionDate)}</span>
                          {rec.safetyCondition && rec.safetyCondition !== "safe" && (
                            <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{formatLabel(rec.safetyCondition)}</span>
                          )}
                          {rec.inspectedByBody && (
                            <span className="text-xs text-gray-500">— {rec.inspectedByBody.name}</span>
                          )}
                        </div>
                        {rec.notes && (
                          <p className="mt-1 text-xs text-gray-600 ml-11">{rec.notes}</p>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}

            {/* Record Inspection Modal */}
            {showRecordInspection && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h3 className="text-base font-semibold text-gray-900">Record Inspection</h3>
                    <button
                      onClick={() => setShowRecordInspection(false)}
                      className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                    >✕</button>
                  </div>
                  <div className="px-6 py-4 space-y-3">
                    {recordInspectionGeneralError && (
                      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                        {recordInspectionGeneralError}
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Inspection Date *</label>
                      <input
                        type="date"
                        value={recordInspectionForm.inspection_date}
                        onChange={(e) => setRecordInspectionForm((p) => ({ ...p, inspection_date: e.target.value }))}
                        className="w-full border rounded px-2 py-1.5 text-sm"
                      />
                      {recordInspectionErrors.inspection_date && (
                        <p className="text-xs text-red-600 mt-1">{recordInspectionErrors.inspection_date}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Condition Score (1=Critical, 5=Excellent) *</label>
                      <select
                        value={recordInspectionForm.condition_score}
                        onChange={(e) => setRecordInspectionForm((p) => ({ ...p, condition_score: e.target.value }))}
                        className="w-full border rounded px-2 py-1.5 text-sm"
                      >
                        {[5, 4, 3, 2, 1].map((s) => (
                          <option key={s} value={String(s)}>{s} — {SCORE_LABELS[s]}</option>
                        ))}
                      </select>
                      {recordInspectionErrors.condition_score && (
                        <p className="text-xs text-red-600 mt-1">{recordInspectionErrors.condition_score}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Structural Condition</label>
                      <select
                        value={recordInspectionForm.structural_condition}
                        onChange={(e) => setRecordInspectionForm((p) => ({ ...p, structural_condition: e.target.value }))}
                        className="w-full border rounded px-2 py-1.5 text-sm"
                      >
                        <option value="">— Not assessed —</option>
                        {["good", "fair", "poor", "critical"].map((v) => (
                          <option key={v} value={v}>{formatLabel(v)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Safety Condition</label>
                      <select
                        value={recordInspectionForm.safety_condition}
                        onChange={(e) => setRecordInspectionForm((p) => ({ ...p, safety_condition: e.target.value }))}
                        className="w-full border rounded px-2 py-1.5 text-sm"
                      >
                        <option value="">— Not assessed —</option>
                        {["safe", "minor_hazard", "major_hazard", "unsafe"].map((v) => (
                          <option key={v} value={v}>{formatLabel(v)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Maintenance Priority</label>
                      <select
                        value={recordInspectionForm.maintenance_priority}
                        onChange={(e) => setRecordInspectionForm((p) => ({ ...p, maintenance_priority: e.target.value }))}
                        className="w-full border rounded px-2 py-1.5 text-sm"
                      >
                        {["none", "low", "medium", "high", "urgent"].map((v) => (
                          <option key={v} value={v}>{formatLabel(v)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Replacement Urgency</label>
                      <select
                        value={recordInspectionForm.replacement_urgency}
                        onChange={(e) => setRecordInspectionForm((p) => ({ ...p, replacement_urgency: e.target.value }))}
                        className="w-full border rounded px-2 py-1.5 text-sm"
                      >
                        {["none", "within_5_years", "within_2_years", "within_1_year", "immediate"].map((v) => (
                          <option key={v} value={v}>{formatLabel(v)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Next Inspection Due</label>
                      <input
                        type="date"
                        value={recordInspectionForm.next_inspection_due}
                        onChange={(e) => setRecordInspectionForm((p) => ({ ...p, next_inspection_due: e.target.value }))}
                        className="w-full border rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                      <textarea
                        value={recordInspectionForm.notes}
                        onChange={(e) => setRecordInspectionForm((p) => ({ ...p, notes: e.target.value }))}
                        rows={3}
                        className="w-full border rounded px-2 py-1.5 text-sm resize-none"
                        placeholder="Observations and findings..."
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 px-6 py-4 border-t">
                    <button
                      onClick={() => setShowRecordInspection(false)}
                      className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRecordInspectionSubmit}
                      disabled={recordInspectionSubmitting}
                      className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {recordInspectionSubmitting ? "Saving..." : "Save Inspection"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Handover Tab */}
      {activeTab === "handover" && (() => {
        const HANDOVER_STATUS_COLORS: Record<string, string> = {
          pending: "bg-yellow-100 text-yellow-800",
          accepted: "bg-green-100 text-green-800",
          accepted_with_conditions: "bg-amber-100 text-amber-800",
          rejected: "bg-red-100 text-red-800",
        };

        return (
          <div className="bg-white border rounded-lg shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-sm font-semibold text-gray-700">Handover Records</h2>
              <button
                onClick={() => {
                  setShowCreateHandover(true);
                  setCreateHandoverErrors({});
                  setCreateHandoverGeneralError(null);
                  setHandoverDefects([]);
                }}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                + Record Handover
              </button>
            </div>

            {handoverLoading && (
              <div className="px-6 py-8 text-center text-sm text-gray-500">Loading handover records...</div>
            )}
            {!handoverLoading && handoverError && (
              <div className="px-6 py-4 text-sm text-red-600">{handoverError}</div>
            )}
            {!handoverLoading && !handoverError && handoverRecords.length === 0 && (
              <p className="px-6 py-8 text-sm text-gray-500 text-center">No handover records yet.</p>
            )}

            {!handoverLoading && !handoverError && handoverRecords.length > 0 && (
              <div className="divide-y">
                {handoverRecords.map((rec) => {
                  const isPending = rec.handoverStatus === "pending";
                  const isExpanded = expandedHandoverIds.has(rec.id);
                  const defects = (rec.defectsList ?? []) as HandoverDefect[];
                  const missingDocs = rec.missingDocuments ?? [];

                  return (
                    <div key={rec.id} className={`px-6 py-4 ${isPending ? "bg-yellow-50" : ""}`}>
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${HANDOVER_STATUS_COLORS[rec.handoverStatus] ?? "bg-gray-100 text-gray-700"}`}>
                              {isPending ? (
                                <span className="flex items-center gap-1">
                                  <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                                  Pending
                                </span>
                              ) : formatLabel(rec.handoverStatus)}
                            </span>
                            <span className="text-sm text-gray-700 font-medium">{formatDate(rec.handoverDate)}</span>
                          </div>
                          <div className="text-xs text-gray-500 flex flex-wrap gap-3">
                            <span>From: <span className="text-gray-700">{rec.deliveredByBody?.name ?? "—"}</span></span>
                            <span>To: <span className="text-gray-700">{rec.receivedByBody?.name ?? "—"}</span></span>
                            {rec.warrantyExpiryDate && (
                              <span>Warranty: <span className="text-gray-700">{formatDate(rec.warrantyExpiryDate)}</span></span>
                            )}
                          </div>
                          {rec.handoverStatus === "accepted_with_conditions" && rec.conditionsDescription && (
                            <div className="mt-2 text-xs bg-amber-50 border border-amber-200 rounded px-2 py-1.5 text-amber-800">
                              <strong>Conditions:</strong> {rec.conditionsDescription}
                            </div>
                          )}
                          {missingDocs.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-red-700 mb-1">Missing Documents:</p>
                              <ul className="space-y-0.5">
                                {missingDocs.map((doc, i) => (
                                  <li key={i} className="text-xs flex items-center gap-1 text-red-700">
                                    <span>✗</span> {doc}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          {isPending && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setAcceptingHandover(rec);
                                  setAcceptWithConditions(false);
                                  setAcceptConditionsText("");
                                  setAcceptError(null);
                                }}
                                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => {
                                  setRejectingHandover(rec);
                                  setRejectReason("");
                                  setRejectError(null);
                                }}
                                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                          {defects.length > 0 && (
                            <button
                              onClick={() => {
                                setExpandedHandoverIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(rec.id)) next.delete(rec.id);
                                  else next.add(rec.id);
                                  return next;
                                });
                              }}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              {isExpanded ? "Hide defects" : `Show defects (${defects.length})`}
                            </button>
                          )}
                        </div>
                      </div>

                      {isExpanded && defects.length > 0 && (
                        <div className="mt-3 bg-gray-50 rounded p-3">
                          <p className="text-xs font-medium text-gray-700 mb-2">Defects List</p>
                          <div className="space-y-1">
                            {defects.map((d, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs">
                                <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${
                                  d.severity === "critical" ? "bg-red-100 text-red-700"
                                    : d.severity === "major" ? "bg-orange-100 text-orange-700"
                                    : "bg-gray-100 text-gray-600"
                                }`}>{formatLabel(d.severity || "minor")}</span>
                                <span className={`flex-1 ${d.resolved ? "line-through text-gray-400" : "text-gray-700"}`}>{d.description}</span>
                                {d.resolved && <span className="text-green-600">✓ Resolved</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {rec.notes && (
                        <p className="mt-2 text-xs text-gray-500 italic">{rec.notes}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Create Handover Modal */}
            {showCreateHandover && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h3 className="text-base font-semibold text-gray-900">Record Handover</h3>
                    <button
                      onClick={() => setShowCreateHandover(false)}
                      className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                    >✕</button>
                  </div>
                  <div className="px-6 py-4 space-y-3">
                    {createHandoverGeneralError && (
                      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                        {createHandoverGeneralError}
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Delivered By Body ID *</label>
                      <input
                        type="text"
                        value={createHandoverForm.delivered_by_body_id}
                        onChange={(e) => setCreateHandoverForm((p) => ({ ...p, delivered_by_body_id: e.target.value }))}
                        className="w-full border rounded px-2 py-1.5 text-sm"
                        placeholder="UUID of the delivering body"
                      />
                      {createHandoverErrors.delivered_by_body_id && (
                        <p className="text-xs text-red-600 mt-1">{createHandoverErrors.delivered_by_body_id}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Received By Body ID *</label>
                      <input
                        type="text"
                        value={createHandoverForm.received_by_body_id}
                        onChange={(e) => setCreateHandoverForm((p) => ({ ...p, received_by_body_id: e.target.value }))}
                        className="w-full border rounded px-2 py-1.5 text-sm"
                        placeholder="UUID of the receiving body"
                      />
                      {createHandoverErrors.received_by_body_id && (
                        <p className="text-xs text-red-600 mt-1">{createHandoverErrors.received_by_body_id}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Handover Date *</label>
                      <input
                        type="date"
                        value={createHandoverForm.handover_date}
                        onChange={(e) => setCreateHandoverForm((p) => ({ ...p, handover_date: e.target.value }))}
                        className="w-full border rounded px-2 py-1.5 text-sm"
                      />
                      {createHandoverErrors.handover_date && (
                        <p className="text-xs text-red-600 mt-1">{createHandoverErrors.handover_date}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Warranty Expiry Date</label>
                      <input
                        type="date"
                        value={createHandoverForm.warranty_expiry_date}
                        onChange={(e) => setCreateHandoverForm((p) => ({ ...p, warranty_expiry_date: e.target.value }))}
                        className="w-full border rounded px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Missing Documents (one per line)</label>
                      <textarea
                        value={createHandoverForm.missing_documents}
                        onChange={(e) => setCreateHandoverForm((p) => ({ ...p, missing_documents: e.target.value }))}
                        rows={3}
                        className="w-full border rounded px-2 py-1.5 text-sm resize-none"
                        placeholder="as-made document&#10;occupancy protocol&#10;..."
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-gray-700">Defects List</label>
                        <button
                          onClick={() => setHandoverDefects((prev) => [...prev, { description: "", severity: "minor", resolved: false }])}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          + Add defect
                        </button>
                      </div>
                      {handoverDefects.map((d, i) => (
                        <div key={i} className="flex gap-2 items-start mb-2">
                          <input
                            type="text"
                            value={d.description}
                            onChange={(e) => setHandoverDefects((prev) => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                            className="flex-1 border rounded px-2 py-1.5 text-sm"
                            placeholder="Defect description"
                          />
                          <select
                            value={d.severity}
                            onChange={(e) => setHandoverDefects((prev) => prev.map((x, j) => j === i ? { ...x, severity: e.target.value } : x))}
                            className="border rounded px-2 py-1.5 text-sm"
                          >
                            <option value="minor">Minor</option>
                            <option value="major">Major</option>
                            <option value="critical">Critical</option>
                          </select>
                          <button
                            onClick={() => setHandoverDefects((prev) => prev.filter((_, j) => j !== i))}
                            className="text-red-500 hover:text-red-700 px-1 py-1 text-sm"
                          >✕</button>
                        </div>
                      ))}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                      <textarea
                        value={createHandoverForm.notes}
                        onChange={(e) => setCreateHandoverForm((p) => ({ ...p, notes: e.target.value }))}
                        rows={2}
                        className="w-full border rounded px-2 py-1.5 text-sm resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 px-6 py-4 border-t">
                    <button
                      onClick={() => setShowCreateHandover(false)}
                      className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateHandoverSubmit}
                      disabled={createHandoverSubmitting}
                      className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {createHandoverSubmitting ? "Saving..." : "Record Handover"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Accept Handover Modal */}
            {acceptingHandover && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                  <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h3 className="text-base font-semibold text-gray-900">Accept Handover</h3>
                    <button onClick={() => setAcceptingHandover(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
                  </div>
                  <div className="px-6 py-4 space-y-3">
                    {acceptError && (
                      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{acceptError}</div>
                    )}
                    <p className="text-sm text-gray-700">
                      Accept handover from <strong>{acceptingHandover.deliveredByBody?.name ?? "—"}</strong> to <strong>{acceptingHandover.receivedByBody?.name ?? "—"}</strong> dated <strong>{formatDate(acceptingHandover.handoverDate)}</strong>?
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="accept-conditions"
                        checked={acceptWithConditions}
                        onChange={(e) => setAcceptWithConditions(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <label htmlFor="accept-conditions" className="text-sm text-gray-700">Accept with conditions</label>
                    </div>
                    {acceptWithConditions && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Conditions Description *</label>
                        <textarea
                          value={acceptConditionsText}
                          onChange={(e) => setAcceptConditionsText(e.target.value)}
                          rows={3}
                          className="w-full border rounded px-2 py-1.5 text-sm resize-none"
                          placeholder="Describe the conditions under which this handover is accepted..."
                        />
                      </div>
                    )}
                    {acceptingHandover.missingDocuments && acceptingHandover.missingDocuments.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded p-3">
                        <p className="text-xs font-medium text-amber-800 mb-1">⚠ Missing documents will be flagged:</p>
                        <ul className="space-y-0.5">
                          {acceptingHandover.missingDocuments.map((doc, i) => (
                            <li key={i} className="text-xs text-amber-700">• {doc}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 px-6 py-4 border-t">
                    <button
                      onClick={() => setAcceptingHandover(null)}
                      className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAcceptHandover}
                      disabled={acceptSubmitting}
                      className="px-4 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {acceptSubmitting ? "Accepting..." : "Confirm Accept"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Reject Handover Modal */}
            {rejectingHandover && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                  <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h3 className="text-base font-semibold text-gray-900">Reject Handover</h3>
                    <button onClick={() => setRejectingHandover(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
                  </div>
                  <div className="px-6 py-4 space-y-3">
                    {rejectError && (
                      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{rejectError}</div>
                    )}
                    <p className="text-sm text-gray-700">
                      Reject handover from <strong>{rejectingHandover.deliveredByBody?.name ?? "—"}</strong>?
                    </p>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Rejection Reason *</label>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={3}
                        className="w-full border rounded px-2 py-1.5 text-sm resize-none"
                        placeholder="Explain why the handover is being rejected..."
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 px-6 py-4 border-t">
                    <button
                      onClick={() => setRejectingHandover(null)}
                      className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRejectHandover}
                      disabled={rejectSubmitting}
                      className="px-4 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {rejectSubmitting ? "Rejecting..." : "Confirm Reject"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Lifecycle Transition Modal */}
      {showTransitionModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-800">Transition Lifecycle Stage</h3>
              <button onClick={closeTransitionModal} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>

            {transitionError && (
              <div className="mb-3 bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">
                {transitionError}
              </div>
            )}

            {transitionsLoading ? (
              <p className="text-sm text-gray-500">Loading available stages...</p>
            ) : availableTransitions.length === 0 ? (
              <p className="text-sm text-gray-500">No valid next stages available for this asset from its current stage.</p>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-3">
                  Current stage: <span className="font-medium">{asset.currentLifecycleStage?.name ?? "—"}</span>
                </p>
                <p className="text-xs text-gray-500 mb-3">Select the next lifecycle stage:</p>

                <div className="space-y-2 mb-4">
                  {availableTransitions.map((t) => {
                    const isSelected = selectedTransition?.id === t.id;
                    const requiredDocs = t.requiredDocumentTypes ?? [];
                    const requiredEvts = t.requiredEvents ?? [];
                    const docCounts = asset.document_counts ?? [];
                    const docNames = new Set(docCounts.filter(d => d.count > 0).map(d => d.document_type_name?.toLowerCase() ?? ""));
                    return (
                      <div
                        key={t.id}
                        onClick={() => handleSelectTransition(t)}
                        className={`border rounded p-3 cursor-pointer transition-colors ${
                          isSelected ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${isSelected ? "border-indigo-600 bg-indigo-600" : "border-gray-300"}`} />
                          <span className="text-sm font-medium text-gray-800">{t.toStage.name}</span>
                        </div>

                        {(requiredDocs.length > 0 || requiredEvts.length > 0) && (
                          <div className="mt-2 ml-6 space-y-1">
                            {requiredDocs.length > 0 && (
                              <div>
                                <p className="text-xs text-gray-500 font-medium mb-0.5">Required documents:</p>
                                <ul className="space-y-0.5">
                                  {requiredDocs.map((name) => {
                                    const present = docNames.has(name.toLowerCase());
                                    return (
                                      <li key={name} className={`text-xs flex items-center gap-1 ${present ? "text-green-700" : "text-red-600"}`}>
                                        <span>{present ? "✓" : "✗"}</span>
                                        <span>{name}</span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            )}
                            {requiredEvts.length > 0 && (
                              <div>
                                <p className="text-xs text-gray-500 font-medium mb-0.5">Required events:</p>
                                <ul className="space-y-0.5">
                                  {requiredEvts.map((name) => (
                                    <li key={name} className="text-xs text-gray-600 flex items-center gap-1">
                                      <span className="text-gray-400">•</span>
                                      <span>{name}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Warnings step — shown after first POST attempt returns warnings */}
                {transitionWarnings.length > 0 && (
                  <div className="mb-4 bg-amber-50 border border-amber-300 rounded p-3">
                    <p className="text-sm font-medium text-amber-800 mb-2">
                      ⚠ Unmet requirements — {transitionWarningMessage || "Some conditions are not met"}
                    </p>
                    <ul className="space-y-1 mb-3">
                      {transitionWarnings.map((w, i) => (
                        <li key={i} className={`text-xs flex items-start gap-1 ${w.type === "document" ? "text-red-700" : "text-orange-700"}`}>
                          <span className="font-bold flex-shrink-0">{w.type === "document" ? "Doc:" : "Event:"}</span>
                          <span>{w.description}</span>
                        </li>
                      ))}
                    </ul>
                    <div>
                      <label className="block text-xs font-medium text-amber-800 mb-1">
                        Justification (required to proceed) *
                      </label>
                      <textarea
                        rows={2}
                        value={justification}
                        onChange={(e) => { setJustification(e.target.value); setJustificationError(""); }}
                        placeholder="Explain why you are overriding the warnings..."
                        className="w-full border border-amber-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      {justificationError && (
                        <p className="text-xs text-red-600 mt-1">{justificationError}</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    onClick={closeTransitionModal}
                    className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTransitionConfirm}
                    disabled={!selectedTransition || transitionSubmitting}
                    className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {transitionSubmitting
                      ? "Transitioning..."
                      : transitionWarnings.length > 0
                      ? "Proceed Anyway"
                      : "Confirm Transition"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Revenue Tab */}
      {activeTab === "revenue" && (() => {
        const REVENUE_STATUS_COLORS: Record<string, string> = {
          expected: "bg-blue-100 text-blue-800",
          received: "bg-green-100 text-green-800",
          partial: "bg-yellow-100 text-yellow-800",
          overdue: "bg-red-100 text-red-800",
          waived: "bg-gray-100 text-gray-600",
        };

        const now = new Date();
        const isOverdue = (rec: RevenueRecord) =>
          rec.status === "expected" && new Date(rec.periodEnd) < now;

        const REVENUE_TYPES = ["lease_income", "booking_fee", "service_charge", "operator_fee", "other"];

        return (
          <div className="bg-white border rounded-lg shadow-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-sm font-semibold text-gray-700">Revenue &amp; Collections</h2>
              <button
                onClick={() => {
                  setShowAddRevenue(true);
                  setAddRevenueErrors({});
                  setAddRevenueGeneralError(null);
                }}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                + Add Revenue Record
              </button>
            </div>

            {revenueLoading && (
              <div className="px-6 py-8 text-center text-sm text-gray-500">Loading revenue data...</div>
            )}
            {!revenueLoading && revenueError && (
              <div className="px-6 py-4 text-sm text-red-600">{revenueError}</div>
            )}

            {!revenueLoading && !revenueError && revenueSummary && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-6 py-4 border-b bg-gray-50">
                <div className="bg-white border rounded p-3">
                  <p className="text-xs text-gray-500 mb-1">Expected YTD</p>
                  <p className="text-lg font-semibold text-gray-800">
                    ₪{revenueSummary.total_expected_ytd.toLocaleString()}
                  </p>
                </div>
                <div className="bg-white border rounded p-3">
                  <p className="text-xs text-gray-500 mb-1">Received YTD</p>
                  <p className="text-lg font-semibold text-green-700">
                    ₪{revenueSummary.total_received_ytd.toLocaleString()}
                  </p>
                </div>
                <div className="bg-white border rounded p-3">
                  <p className="text-xs text-gray-500 mb-1">Overdue YTD</p>
                  <p className={`text-lg font-semibold ${revenueSummary.total_overdue_ytd > 0 ? "text-red-600" : "text-gray-800"}`}>
                    ₪{revenueSummary.total_overdue_ytd.toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {!revenueLoading && !revenueError && revenueRecords.length === 0 && (
              <p className="px-6 py-8 text-sm text-gray-500 text-center">No revenue records yet.</p>
            )}

            {!revenueLoading && !revenueError && revenueRecords.length > 0 && (() => {
              // Group records by period (year + month)
              const grouped: Record<string, RevenueRecord[]> = {};
              revenueRecords.forEach((rec) => {
                const key = rec.periodStart.slice(0, 7); // YYYY-MM
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(rec);
              });
              const sortedKeys = Object.keys(grouped).sort().reverse();

              return (
                <div className="divide-y">
                  {sortedKeys.map((periodKey) => (
                    <div key={periodKey} className="px-6 py-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                        {new Date(periodKey + "-01").toLocaleDateString("en-IL", { year: "numeric", month: "long" })}
                      </p>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-500 border-b">
                            <th className="text-left py-1">Type</th>
                            <th className="text-left py-1">Period</th>
                            <th className="text-right py-1">Expected</th>
                            <th className="text-right py-1">Actual</th>
                            <th className="text-left py-1 pl-3">Status</th>
                            <th className="text-left py-1">Link</th>
                            <th className="py-1"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {grouped[periodKey].map((rec) => {
                            const overdue = isOverdue(rec);
                            return (
                              <tr key={rec.id} className={overdue ? "bg-red-50" : ""}>
                                <td className="py-1.5 pr-3">
                                  <span className="text-xs font-medium text-gray-700">
                                    {formatLabel(rec.revenueType)}
                                  </span>
                                </td>
                                <td className="py-1.5 pr-3 text-xs text-gray-600">
                                  {formatDate(rec.periodStart)} – {formatDate(rec.periodEnd)}
                                </td>
                                <td className="py-1.5 pr-3 text-right text-xs text-gray-700">
                                  ₪{Number(rec.expectedAmount).toLocaleString()}
                                </td>
                                <td className="py-1.5 pr-3 text-right text-xs text-gray-700">
                                  {Number(rec.actualAmount) > 0
                                    ? `₪${Number(rec.actualAmount).toLocaleString()}`
                                    : "—"}
                                </td>
                                <td className="py-1.5 pl-3 pr-3">
                                  {overdue ? (
                                    <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                      Overdue
                                    </span>
                                  ) : (
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${REVENUE_STATUS_COLORS[rec.status] ?? "bg-gray-100 text-gray-700"}`}>
                                      {formatLabel(rec.status)}
                                    </span>
                                  )}
                                </td>
                                <td className="py-1.5 pr-3 text-xs text-gray-500">
                                  {rec.allocation?.allocatedToName
                                    ?? rec.allocation?.allocatedToBody?.name
                                    ?? rec.contract?.counterpartyName
                                    ?? "—"}
                                </td>
                                <td className="py-1.5 text-right">
                                  {rec.status !== "received" && rec.status !== "waived" && (
                                    <button
                                      onClick={() => {
                                        setMarkReceivingRecord(rec);
                                        setMarkReceivedForm({
                                          actual_amount: rec.actualAmount ?? "",
                                          payment_date: "",
                                        });
                                        setMarkReceivedError(null);
                                      }}
                                      className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                                    >
                                      Mark Received
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Add Revenue Record Modal */}
            {showAddRevenue && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
                  <h3 className="text-base font-semibold text-gray-800 mb-4">Add Revenue Record</h3>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Revenue Type <span className="text-red-500">*</span></label>
                      <select
                        value={addRevenueForm.revenue_type}
                        onChange={e => setAddRevenueForm(f => ({ ...f, revenue_type: e.target.value }))}
                        className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        {REVENUE_TYPES.map(t => (
                          <option key={t} value={t}>{formatLabel(t)}</option>
                        ))}
                      </select>
                      {addRevenueErrors.revenue_type && <p className="text-xs text-red-600 mt-1">{addRevenueErrors.revenue_type}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Period Start <span className="text-red-500">*</span></label>
                        <input
                          type="date"
                          value={addRevenueForm.period_start}
                          onChange={e => setAddRevenueForm(f => ({ ...f, period_start: e.target.value }))}
                          className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        {addRevenueErrors.period_start && <p className="text-xs text-red-600 mt-1">{addRevenueErrors.period_start}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Period End <span className="text-red-500">*</span></label>
                        <input
                          type="date"
                          value={addRevenueForm.period_end}
                          onChange={e => setAddRevenueForm(f => ({ ...f, period_end: e.target.value }))}
                          className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        {addRevenueErrors.period_end && <p className="text-xs text-red-600 mt-1">{addRevenueErrors.period_end}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Expected Amount (₪) <span className="text-red-500">*</span></label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={addRevenueForm.expected_amount}
                          onChange={e => setAddRevenueForm(f => ({ ...f, expected_amount: e.target.value }))}
                          className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          placeholder="0.00"
                        />
                        {addRevenueErrors.expected_amount && <p className="text-xs text-red-600 mt-1">{addRevenueErrors.expected_amount}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Actual Amount (₪)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={addRevenueForm.actual_amount}
                          onChange={e => setAddRevenueForm(f => ({ ...f, actual_amount: e.target.value }))}
                          className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Allocation ID (optional)</label>
                      <input
                        type="text"
                        value={addRevenueForm.allocation_id}
                        onChange={e => setAddRevenueForm(f => ({ ...f, allocation_id: e.target.value }))}
                        className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        placeholder="UUID of linked allocation"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Contract ID (optional)</label>
                      <input
                        type="text"
                        value={addRevenueForm.contract_id}
                        onChange={e => setAddRevenueForm(f => ({ ...f, contract_id: e.target.value }))}
                        className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        placeholder="UUID of linked contract"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                      <textarea
                        rows={2}
                        value={addRevenueForm.notes}
                        onChange={e => setAddRevenueForm(f => ({ ...f, notes: e.target.value }))}
                        className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                  </div>

                  {addRevenueGeneralError && (
                    <p className="text-sm text-red-600 mt-3">{addRevenueGeneralError}</p>
                  )}

                  <div className="flex justify-end gap-2 mt-5">
                    <button
                      onClick={() => setShowAddRevenue(false)}
                      className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                      disabled={addRevenueSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddRevenueSubmit}
                      disabled={addRevenueSubmitting}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {addRevenueSubmitting ? "Saving..." : "Save Record"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Mark Received Modal */}
            {markReceivingRecord && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
                  <h3 className="text-base font-semibold text-gray-800 mb-1">Mark as Received</h3>
                  <p className="text-xs text-gray-500 mb-4">
                    {formatLabel(markReceivingRecord.revenueType)} — {formatDate(markReceivingRecord.periodStart)} to {formatDate(markReceivingRecord.periodEnd)}
                  </p>
                  <p className="text-xs text-gray-600 mb-3">
                    Expected: ₪{Number(markReceivingRecord.expectedAmount).toLocaleString()}
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Actual Amount (₪) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={markReceivedForm.actual_amount}
                        onChange={e => setMarkReceivedForm(f => ({ ...f, actual_amount: e.target.value }))}
                        className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Payment Date</label>
                      <input
                        type="date"
                        value={markReceivedForm.payment_date}
                        onChange={e => setMarkReceivedForm(f => ({ ...f, payment_date: e.target.value }))}
                        className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                  </div>

                  {markReceivedError && (
                    <p className="text-sm text-red-600 mt-2">{markReceivedError}</p>
                  )}

                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      onClick={() => setMarkReceivingRecord(null)}
                      className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                      disabled={markReceivedSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleMarkReceived}
                      disabled={markReceivedSubmitting}
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      {markReceivedSubmitting ? "Saving..." : "Confirm Received"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Body Transfer Confirmation Dialog */}
      {pendingBodyTransfer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-gray-800 mb-1">Confirm Body Transfer</h3>
            <p className="text-sm text-gray-600 mb-4">This will be recorded permanently.</p>

            <div className="bg-gray-50 rounded p-3 text-sm mb-4 space-y-1">
              <p>
                <span className="text-gray-500">Role:</span>{" "}
                <span className="font-medium">{pendingBodyTransfer.roleLabel}</span>
              </p>
              <p>
                <span className="text-gray-500">From:</span>{" "}
                <span className="text-gray-700">{pendingBodyTransfer.fromBody?.name ?? "Not assigned"}</span>
              </p>
              <p>
                <span className="text-gray-500">To:</span>{" "}
                <span className="font-medium text-gray-800">{pendingBodyTransfer.toBody.name}</span>
                {pendingBodyTransfer.toBody.isPlaceholder && (
                  <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                    ⚠ This body is a placeholder — organizational ownership decision pending
                  </span>
                )}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={bodyTransferReason}
                onChange={e => setBodyTransferReason(e.target.value)}
                placeholder="Enter reason for this transfer..."
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              {bodyTransferSubmitting && !bodyTransferReason.trim() && (
                <p className="text-xs text-red-600 mt-1">Reason is required</p>
              )}
            </div>

            {bodyTransferError && (
              <p className="text-sm text-red-600 mb-3">{bodyTransferError}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setPendingBodyTransfer(null); setBodyTransferReason(""); setBodyTransferError(null); }}
                className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                disabled={bodyTransferSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleBodyTransferConfirm}
                disabled={bodyTransferSubmitting || !bodyTransferReason.trim()}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bodyTransferSubmitting ? "Transferring..." : "Confirm Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
    </div>
  );
}
