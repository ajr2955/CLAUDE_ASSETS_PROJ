/**
 * US-065: Exception management service and API
 *
 * GET /api/exceptions
 * Returns a prioritized list of asset exceptions detected automatically.
 * Scoped by responsible_body_id for department_user and operations_manager roles.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

type ExceptionType =
  | "contract_expiring_soon"
  | "contract_expired"
  | "missing_mandatory_document"
  | "safety_hazard"
  | "critical_condition"
  | "overdue_work_order"
  | "budget_overrun"
  | "overdue_developer_obligation"
  | "placeholder_body_assigned"
  | "no_condition_record_in_1_year"
  | "handover_pending_over_30_days";

type ExceptionSeverity = "critical" | "high" | "medium";

const EXCEPTION_SEVERITY: Record<ExceptionType, ExceptionSeverity> = {
  safety_hazard: "critical",
  critical_condition: "critical",
  contract_expired: "high",
  overdue_work_order: "high",
  budget_overrun: "high",
  missing_mandatory_document: "high",
  overdue_developer_obligation: "medium",
  placeholder_body_assigned: "medium",
  no_condition_record_in_1_year: "medium",
  handover_pending_over_30_days: "medium",
  contract_expiring_soon: "medium",
};

const SEVERITY_ORDER: Record<ExceptionSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
};

interface AssetException {
  asset_id: string;
  asset_name: string;
  asset_code: string;
  asset_family_id: string;
  asset_family_name: string;
  responsible_body_id: string | null;
  exception_type: ExceptionType;
  severity: ExceptionSeverity;
  description: string;
  detected_at: string;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const caller = requireAuth(req, "department_user");
  if (caller instanceof NextResponse) return caller;

  const { searchParams } = new URL(req.url);
  const filterExceptionType = searchParams.get("exception_type") as ExceptionType | null;
  const filterSeverity = searchParams.get("severity") as ExceptionSeverity | null;
  const filterFamilyId = searchParams.get("asset_family_id");
  const filterBodyId = searchParams.get("responsible_body_id");

  const now = new Date();
  const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // For scoped roles, look up the caller's responsible_body_id from DB
  const isScopedRole =
    caller.role === "department_user" || caller.role === "operations_manager";

  let callerBodyId: string | null = null;
  if (isScopedRole) {
    const user = await prisma.user.findUnique({
      where: { id: caller.sub },
      select: { responsibleBodyId: true },
    });
    callerBodyId = user?.responsibleBodyId ?? null;
  }

  // Build base asset scope filter
  const scopeBodyId = callerBodyId;
  const assetBodyScopeFilter =
    isScopedRole && scopeBodyId
      ? {
          OR: [
            { responsibleBodyId: scopeBodyId },
            { operationalBodyId: scopeBodyId },
            { maintenanceBodyId: scopeBodyId },
          ],
        }
      : {};

  const assetFamilyFilter = filterFamilyId ? { assetFamilyId: filterFamilyId } : {};

  const assetBodyUserFilter = filterBodyId
    ? {
        OR: [
          { responsibleBodyId: filterBodyId },
          { operationalBodyId: filterBodyId },
          { maintenanceBodyId: filterBodyId },
        ],
      }
    : {};

  // Merge base asset where conditions
  type AssetWhere = Record<string, unknown>;
  const baseAssetWhere: AssetWhere = {
    ...assetFamilyFilter,
    ...assetBodyUserFilter,
  };
  if (isScopedRole && scopeBodyId) {
    // Combine scope filter with user filter using AND
    if (filterBodyId) {
      baseAssetWhere["AND"] = [assetBodyScopeFilter, assetBodyUserFilter];
      delete baseAssetWhere["OR"];
    } else {
      Object.assign(baseAssetWhere, assetBodyScopeFilter);
    }
  }

  const exceptions: AssetException[] = [];
  const detectedAt = now.toISOString();

  // Helper to check if we should process an exception type
  const shouldCheck = (type: ExceptionType) =>
    !filterExceptionType || filterExceptionType === type;

  // --- 1. contract_expired ---
  if (shouldCheck("contract_expired")) {
    const rows = await prisma.contract.findMany({
      where: {
        status: "active",
        endDate: { lt: now, not: null },
        asset: baseAssetWhere,
      },
      include: { asset: { include: { assetFamily: true } } },
    });
    for (const c of rows) {
      exceptions.push({
        asset_id: c.asset.id,
        asset_name: c.asset.assetName,
        asset_code: c.asset.assetCode,
        asset_family_id: c.asset.assetFamilyId,
        asset_family_name: c.asset.assetFamily.name,
        responsible_body_id: c.asset.responsibleBodyId,
        exception_type: "contract_expired",
        severity: EXCEPTION_SEVERITY.contract_expired,
        description: `Contract ${c.contractReference ?? c.id} with ${c.counterpartyName} expired on ${c.endDate?.toISOString().slice(0, 10)}`,
        detected_at: detectedAt,
      });
    }
  }

  // --- 2. contract_expiring_soon ---
  if (shouldCheck("contract_expiring_soon")) {
    const rows = await prisma.contract.findMany({
      where: {
        status: "active",
        endDate: { gte: now, lte: in60Days },
        asset: baseAssetWhere,
      },
      include: { asset: { include: { assetFamily: true } } },
    });
    for (const c of rows) {
      exceptions.push({
        asset_id: c.asset.id,
        asset_name: c.asset.assetName,
        asset_code: c.asset.assetCode,
        asset_family_id: c.asset.assetFamilyId,
        asset_family_name: c.asset.assetFamily.name,
        responsible_body_id: c.asset.responsibleBodyId,
        exception_type: "contract_expiring_soon",
        severity: EXCEPTION_SEVERITY.contract_expiring_soon,
        description: `Contract ${c.contractReference ?? c.id} with ${c.counterpartyName} expires on ${c.endDate?.toISOString().slice(0, 10)}`,
        detected_at: detectedAt,
      });
    }
  }

  // --- 3. safety_hazard ---
  if (shouldCheck("safety_hazard")) {
    const rows = await prisma.conditionRecord.findMany({
      where: {
        safetyCondition: { in: ["unsafe", "major_hazard"] },
        asset: baseAssetWhere,
      },
      orderBy: [{ assetId: "asc" }, { inspectionDate: "desc" }],
      distinct: ["assetId"],
      include: { asset: { include: { assetFamily: true } } },
    });
    for (const r of rows) {
      exceptions.push({
        asset_id: r.asset.id,
        asset_name: r.asset.assetName,
        asset_code: r.asset.assetCode,
        asset_family_id: r.asset.assetFamilyId,
        asset_family_name: r.asset.assetFamily.name,
        responsible_body_id: r.asset.responsibleBodyId,
        exception_type: "safety_hazard",
        severity: EXCEPTION_SEVERITY.safety_hazard,
        description: `Safety condition: ${r.safetyCondition} (inspection ${r.inspectionDate.toISOString().slice(0, 10)})`,
        detected_at: detectedAt,
      });
    }
  }

  // --- 4. critical_condition ---
  if (shouldCheck("critical_condition")) {
    const rows = await prisma.conditionRecord.findMany({
      where: { conditionScore: 1, asset: baseAssetWhere },
      orderBy: [{ assetId: "asc" }, { inspectionDate: "desc" }],
      distinct: ["assetId"],
      include: { asset: { include: { assetFamily: true } } },
    });
    for (const r of rows) {
      exceptions.push({
        asset_id: r.asset.id,
        asset_name: r.asset.assetName,
        asset_code: r.asset.assetCode,
        asset_family_id: r.asset.assetFamilyId,
        asset_family_name: r.asset.assetFamily.name,
        responsible_body_id: r.asset.responsibleBodyId,
        exception_type: "critical_condition",
        severity: EXCEPTION_SEVERITY.critical_condition,
        description: `Condition score is 1 (critical) as of ${r.inspectionDate.toISOString().slice(0, 10)}`,
        detected_at: detectedAt,
      });
    }
  }

  // --- 5. overdue_work_order ---
  if (shouldCheck("overdue_work_order")) {
    const rows = await prisma.workOrder.findMany({
      where: {
        priority: { in: ["critical", "high"] },
        status: { notIn: ["closed", "cancelled"] },
        targetCompletionDate: { lt: now, not: null },
        asset: baseAssetWhere,
      },
      orderBy: [{ assetId: "asc" }],
      distinct: ["assetId"],
      include: { asset: { include: { assetFamily: true } } },
    });
    for (const wo of rows) {
      exceptions.push({
        asset_id: wo.asset.id,
        asset_name: wo.asset.assetName,
        asset_code: wo.asset.assetCode,
        asset_family_id: wo.asset.assetFamilyId,
        asset_family_name: wo.asset.assetFamily.name,
        responsible_body_id: wo.asset.responsibleBodyId,
        exception_type: "overdue_work_order",
        severity: EXCEPTION_SEVERITY.overdue_work_order,
        description: `${wo.priority} priority work order "${wo.title}" overdue since ${wo.targetCompletionDate?.toISOString().slice(0, 10)}`,
        detected_at: detectedAt,
      });
    }
  }

  // --- 6. budget_overrun ---
  if (shouldCheck("budget_overrun")) {
    const rows = await prisma.budgetEnvelope.findMany({
      where: { isClosed: false, asset: baseAssetWhere },
      include: { asset: { include: { assetFamily: true } } },
    });
    const seenAssets = new Set<string>();
    for (const env of rows) {
      if (seenAssets.has(env.assetId)) continue;
      const approved = Number(env.approvedAmount);
      const actual = Number(env.actualAmount);
      if (approved > 0 && actual > approved) {
        const variancePct = (actual - approved) / approved;
        if (variancePct > 0.1) {
          seenAssets.add(env.assetId);
          exceptions.push({
            asset_id: env.asset.id,
            asset_name: env.asset.assetName,
            asset_code: env.asset.assetCode,
            asset_family_id: env.asset.assetFamilyId,
            asset_family_name: env.asset.assetFamily.name,
            responsible_body_id: env.asset.responsibleBodyId,
            exception_type: "budget_overrun",
            severity: EXCEPTION_SEVERITY.budget_overrun,
            description: `Budget overrun of ${Math.round(variancePct * 100)}% on ${env.budgetType} envelope`,
            detected_at: detectedAt,
          });
        }
      }
    }
  }

  // --- 7. placeholder_body_assigned ---
  if (shouldCheck("placeholder_body_assigned")) {
    const rows = await prisma.asset.findMany({
      where: { isPlaceholderBody: true, ...baseAssetWhere },
      include: { assetFamily: true },
    });
    for (const a of rows) {
      exceptions.push({
        asset_id: a.id,
        asset_name: a.assetName,
        asset_code: a.assetCode,
        asset_family_id: a.assetFamilyId,
        asset_family_name: a.assetFamily.name,
        responsible_body_id: a.responsibleBodyId,
        exception_type: "placeholder_body_assigned",
        severity: EXCEPTION_SEVERITY.placeholder_body_assigned,
        description:
          "Asset is assigned to a placeholder body — organizational ownership not yet resolved",
        detected_at: detectedAt,
      });
    }
  }

  // --- 8. no_condition_record_in_1_year ---
  if (shouldCheck("no_condition_record_in_1_year")) {
    const recentRecords = await prisma.conditionRecord.findMany({
      where: { inspectionDate: { gte: oneYearAgo } },
      select: { assetId: true },
      distinct: ["assetId"],
    });
    const recentAssetIds = new Set(recentRecords.map((r) => r.assetId));

    const rows = await prisma.asset.findMany({
      where: {
        currentStatus: { in: ["active", "inactive"] },
        ...baseAssetWhere,
      },
      include: { assetFamily: true },
    });
    for (const a of rows) {
      if (!recentAssetIds.has(a.id)) {
        exceptions.push({
          asset_id: a.id,
          asset_name: a.assetName,
          asset_code: a.assetCode,
          asset_family_id: a.assetFamilyId,
          asset_family_name: a.assetFamily.name,
          responsible_body_id: a.responsibleBodyId,
          exception_type: "no_condition_record_in_1_year",
          severity: EXCEPTION_SEVERITY.no_condition_record_in_1_year,
          description: "No condition inspection recorded in the last 12 months",
          detected_at: detectedAt,
        });
      }
    }
  }

  // --- 9. handover_pending_over_30_days ---
  if (shouldCheck("handover_pending_over_30_days")) {
    const rows = await prisma.handoverRecord.findMany({
      where: {
        handoverStatus: "pending",
        createdAt: { lt: thirtyDaysAgo },
        asset: baseAssetWhere,
      },
      orderBy: [{ assetId: "asc" }],
      distinct: ["assetId"],
      include: { asset: { include: { assetFamily: true } } },
    });
    for (const h of rows) {
      const daysPending = Math.floor(
        (now.getTime() - h.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      exceptions.push({
        asset_id: h.asset.id,
        asset_name: h.asset.assetName,
        asset_code: h.asset.assetCode,
        asset_family_id: h.asset.assetFamilyId,
        asset_family_name: h.asset.assetFamily.name,
        responsible_body_id: h.asset.responsibleBodyId,
        exception_type: "handover_pending_over_30_days",
        severity: EXCEPTION_SEVERITY.handover_pending_over_30_days,
        description: `Handover record has been in pending status for ${daysPending} days`,
        detected_at: detectedAt,
      });
    }
  }

  // --- 10. overdue_developer_obligation ---
  if (shouldCheck("overdue_developer_obligation")) {
    // Fetch overdue obligations with their planning entity
    const overdueObligations = await prisma.developerObligation.findMany({
      where: {
        status: { notIn: ["delivered", "closed_gap_identified"] },
        committedDeliveryDate: { lt: now, not: null },
      },
      include: { planningEntity: { select: { linkedAssetId: true } } },
    });

    // Collect linked asset IDs
    const linkedAssetIds = overdueObligations
      .map((o) => o.planningEntity?.linkedAssetId)
      .filter((id): id is string => Boolean(id));

    if (linkedAssetIds.length > 0) {
      const linkedAssets = await prisma.asset.findMany({
        where: { id: { in: linkedAssetIds }, ...baseAssetWhere },
        include: { assetFamily: true },
      });
      const assetMap = new Map(linkedAssets.map((a) => [a.id, a]));

      for (const o of overdueObligations) {
        const assetId = o.planningEntity?.linkedAssetId;
        if (!assetId) continue;
        const asset = assetMap.get(assetId);
        if (!asset) continue;
        const daysOverdue = Math.floor(
          (now.getTime() - (o.committedDeliveryDate?.getTime() ?? 0)) /
            (1000 * 60 * 60 * 24)
        );
        exceptions.push({
          asset_id: asset.id,
          asset_name: asset.assetName,
          asset_code: asset.assetCode,
          asset_family_id: asset.assetFamilyId,
          asset_family_name: asset.assetFamily.name,
          responsible_body_id: asset.responsibleBodyId,
          exception_type: "overdue_developer_obligation",
          severity: EXCEPTION_SEVERITY.overdue_developer_obligation,
          description: `Developer obligation ${o.obligationReference} from ${o.developerName} is ${daysOverdue} days overdue`,
          detected_at: detectedAt,
        });
      }
    }
  }

  // --- 11. missing_mandatory_document ---
  if (shouldCheck("missing_mandatory_document")) {
    const activeAssets = await prisma.asset.findMany({
      where: {
        currentStatus: { notIn: ["disposed", "decommissioned"] },
        ...baseAssetWhere,
      },
      select: {
        id: true,
        assetName: true,
        assetCode: true,
        assetFamilyId: true,
        assetTypeId: true,
        currentLifecycleStageId: true,
        responsibleBodyId: true,
        assetFamily: { select: { name: true } },
      },
    });

    const allRules = await prisma.documentCompletenessRule.findMany({
      where: { isMandatory: true, isActive: true },
      include: { documentType: { select: { id: true } } },
    });

    const assetIds = activeAssets.map((a) => a.id);
    if (assetIds.length > 0) {
      const docs = await prisma.document.findMany({
        where: {
          attachedToEntityType: "asset",
          attachedToEntityId: { in: assetIds },
          isDeleted: false,
        },
        select: { attachedToEntityId: true, documentTypeId: true },
      });
      const docsByAsset = new Map<string, Set<string>>();
      for (const d of docs) {
        if (!docsByAsset.has(d.attachedToEntityId)) {
          docsByAsset.set(d.attachedToEntityId, new Set());
        }
        docsByAsset.get(d.attachedToEntityId)!.add(d.documentTypeId);
      }

      for (const asset of activeAssets) {
        const applicableRules = allRules.filter(
          (r) =>
            r.lifecycleStageId === asset.currentLifecycleStageId &&
            (r.assetFamilyId === null || r.assetFamilyId === asset.assetFamilyId) &&
            (r.assetTypeId === null || r.assetTypeId === asset.assetTypeId)
        );
        const assetDocs = docsByAsset.get(asset.id) ?? new Set<string>();
        const missingCount = applicableRules.filter(
          (r) => !assetDocs.has(r.documentType.id)
        ).length;
        if (missingCount > 0) {
          exceptions.push({
            asset_id: asset.id,
            asset_name: asset.assetName,
            asset_code: asset.assetCode,
            asset_family_id: asset.assetFamilyId,
            asset_family_name: asset.assetFamily.name,
            responsible_body_id: asset.responsibleBodyId,
            exception_type: "missing_mandatory_document",
            severity: EXCEPTION_SEVERITY.missing_mandatory_document,
            description: `${missingCount} mandatory document(s) missing for current lifecycle stage`,
            detected_at: detectedAt,
          });
        }
      }
    }
  }

  // Apply severity filter
  const filtered = filterSeverity
    ? exceptions.filter((e) => e.severity === filterSeverity)
    : exceptions;

  // Sort: critical first, then high, then medium
  filtered.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return ok(filtered, { total: filtered.length }) as NextResponse;
}
