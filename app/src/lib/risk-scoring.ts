/**
 * US-063: Risk Scoring Service
 *
 * Computes a risk score (0–100) for an asset based on:
 * - Condition records
 * - Overdue work orders
 * - Missing required documents for current lifecycle stage
 * - Budget variance
 * - Open governance events in last 90 days
 *
 * Risk band: 0–20 = Low, 21–50 = Medium, 51–80 = High, 81–100 = Critical
 * Scores are capped at 100.
 */

import { prisma } from "@/lib/prisma";
import { RiskBand } from "@/generated/prisma/client";

export interface RiskScoreComponents {
  condition_score_points: number;
  safety_condition_points: number;
  overdue_work_orders_points: number;
  missing_documents_points: number;
  budget_variance_points: number;
  governance_events_points: number;
  details: {
    condition_score: number | null;
    safety_condition: string | null;
    overdue_critical_wos: number;
    overdue_high_wos: number;
    overdue_medium_wos: number;
    missing_mandatory_docs: number;
    max_variance_percent: number;
    governance_events: Record<string, number>;
  };
}

export interface RiskScoreResult {
  asset_id: string;
  risk_score: number;
  risk_band: RiskBand;
  score_components: RiskScoreComponents;
  computed_at: string;
}

function getRiskBand(score: number): RiskBand {
  if (score <= 20) return "Low";
  if (score <= 50) return "Medium";
  if (score <= 80) return "High";
  return "Critical";
}

export async function computeRiskScore(assetId: string): Promise<RiskScoreResult> {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Load asset with current lifecycle stage
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      assetFamilyId: true,
      assetTypeId: true,
      currentLifecycleStageId: true,
    },
  });

  if (!asset) {
    throw new Error(`Asset not found: ${assetId}`);
  }

  const components: RiskScoreComponents = {
    condition_score_points: 0,
    safety_condition_points: 0,
    overdue_work_orders_points: 0,
    missing_documents_points: 0,
    budget_variance_points: 0,
    governance_events_points: 0,
    details: {
      condition_score: null,
      safety_condition: null,
      overdue_critical_wos: 0,
      overdue_high_wos: 0,
      overdue_medium_wos: 0,
      missing_mandatory_docs: 0,
      max_variance_percent: 0,
      governance_events: {},
    },
  };

  // ── 1. Condition record ────────────────────────────────────────────────────
  const latestCondition = await prisma.conditionRecord.findFirst({
    where: { assetId },
    orderBy: [{ inspectionDate: "desc" }, { createdAt: "desc" }],
    select: { conditionScore: true, safetyCondition: true },
  });

  if (latestCondition) {
    const score = latestCondition.conditionScore;
    components.details.condition_score = score;
    if (score <= 2) components.condition_score_points = 30;
    else if (score === 3) components.condition_score_points = 15;

    const safety = latestCondition.safetyCondition;
    components.details.safety_condition = safety;
    if (safety === "unsafe") components.safety_condition_points = 30;
    else if (safety === "major_hazard") components.safety_condition_points = 20;
    else if (safety === "minor_hazard") components.safety_condition_points = 10;
  }

  // ── 2. Overdue work orders ─────────────────────────────────────────────────
  const overdueWOs = await prisma.workOrder.findMany({
    where: {
      assetId,
      targetCompletionDate: { lt: now },
      status: { notIn: ["closed", "cancelled"] },
      priority: { in: ["critical", "high", "medium"] },
    },
    select: { priority: true },
  });

  let overduePoints = 0;
  for (const wo of overdueWOs) {
    if (wo.priority === "critical") {
      overduePoints += 5;
      components.details.overdue_critical_wos++;
    } else if (wo.priority === "high") {
      overduePoints += 3;
      components.details.overdue_high_wos++;
    } else if (wo.priority === "medium") {
      overduePoints += 1;
      components.details.overdue_medium_wos++;
    }
  }
  components.overdue_work_orders_points = overduePoints;

  // ── 3. Missing mandatory documents for current stage ──────────────────────
  const completenessRules = await prisma.documentCompletenessRule.findMany({
    where: {
      isActive: true,
      isMandatory: true,
      lifecycleStageId: asset.currentLifecycleStageId,
      OR: [
        { assetFamilyId: null },
        { assetFamilyId: asset.assetFamilyId },
      ],
    },
    select: { documentTypeId: true, assetTypeId: true },
  });

  // Filter to rules that apply to this asset type
  const applicableRules = completenessRules.filter(
    (r) => r.assetTypeId === null || r.assetTypeId === asset.assetTypeId
  );

  if (applicableRules.length > 0) {
    const requiredTypeIds = applicableRules.map((r) => r.documentTypeId);
    const existingDocs = await prisma.document.findMany({
      where: {
        attachedToEntityType: "asset",
        attachedToEntityId: assetId,
        isDeleted: false,
        documentTypeId: { in: requiredTypeIds },
      },
      select: { documentTypeId: true },
    });
    const satisfiedTypeIds = new Set(existingDocs.map((d) => d.documentTypeId));
    const missingCount = requiredTypeIds.filter((id) => !satisfiedTypeIds.has(id)).length;
    components.details.missing_mandatory_docs = missingCount;
    components.missing_documents_points = missingCount * 5;
  }

  // ── 4. Budget variance ────────────────────────────────────────────────────
  const envelopes = await prisma.budgetEnvelope.findMany({
    where: { assetId, isClosed: false },
    select: { approvedAmount: true, actualAmount: true },
  });

  let maxVariancePct = 0;
  for (const env of envelopes) {
    const approved = Number(env.approvedAmount);
    if (approved <= 0) continue;
    const actual = Number(env.actualAmount);
    const pct = ((actual - approved) / approved) * 100;
    if (pct > maxVariancePct) maxVariancePct = pct;
  }
  components.details.max_variance_percent = Math.round(maxVariancePct * 10) / 10;
  if (maxVariancePct > 20) components.budget_variance_points = 10;
  else if (maxVariancePct > 10) components.budget_variance_points = 5;

  // ── 5. Open governance events in last 90 days ─────────────────────────────
  const governanceEventNames = [
    "asset_at_risk_flagged",
    "overdue_milestone_flagged",
    "missing_document_detected",
    "budget_variance_detected",
  ];

  const pointsMap: Record<string, number> = {
    asset_at_risk_flagged: 15,
    overdue_milestone_flagged: 10,
    missing_document_detected: 5,
    budget_variance_detected: 5,
  };

  const recentGovEvents = await prisma.event.findMany({
    where: {
      assetId,
      isSystemGenerated: true,
      occurredAt: { gte: ninetyDaysAgo },
      eventType: { name: { in: governanceEventNames } },
    },
    select: { eventType: { select: { name: true } } },
  });

  let govPoints = 0;
  const govCounts: Record<string, number> = {};
  for (const ev of recentGovEvents) {
    const name = ev.eventType.name;
    govCounts[name] = (govCounts[name] ?? 0) + 1;
    govPoints += pointsMap[name] ?? 0;
  }
  components.details.governance_events = govCounts;
  components.governance_events_points = govPoints;

  // ── Final score ───────────────────────────────────────────────────────────
  const rawScore =
    components.condition_score_points +
    components.safety_condition_points +
    components.overdue_work_orders_points +
    components.missing_documents_points +
    components.budget_variance_points +
    components.governance_events_points;

  const riskScore = Math.min(100, rawScore);
  const riskBand = getRiskBand(riskScore);

  // ── Upsert into asset_risk_scores ─────────────────────────────────────────
  await prisma.assetRiskScore.upsert({
    where: { assetId },
    update: {
      riskScore,
      riskBand,
      scoreComponents: components as object,
      computedAt: now,
    },
    create: {
      assetId,
      riskScore,
      riskBand,
      scoreComponents: components as object,
      computedAt: now,
    },
  });

  return {
    asset_id: assetId,
    risk_score: riskScore,
    risk_band: riskBand,
    score_components: components,
    computed_at: now.toISOString(),
  };
}

/**
 * Trigger risk score recomputation asynchronously (fire-and-forget).
 * Does not await or throw — used as a side effect in API routes.
 */
export function triggerRiskScoreRecompute(assetId: string): void {
  computeRiskScore(assetId).catch((err) => {
    console.error(`[RiskScoring] Failed to recompute score for asset ${assetId}:`, err);
  });
}
