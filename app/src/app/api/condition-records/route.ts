import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth, requireAnyRole } from "@/lib/rbac";
import {
  SafetyCondition,
  MaintenancePriority,
  ReplacementUrgency,
} from "@/generated/prisma/client";
import { triggerRiskScoreRecompute } from "@/lib/risk-scoring";

const conditionRecordInclude = {
  asset: { select: { id: true, assetName: true, assetCode: true } },
  inspectedByBody: { select: { id: true, name: true } },
};

// GET /api/condition-records — list condition records with optional filters
export async function GET(req: NextRequest) {
  const auth = requireAnyRole(req, [
    "department_user",
    "operations_manager",
    "planner",
    "asset_manager",
    "admin",
  ]);
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const assetId = sp.get("asset_id");
  const conditionScoreMin = sp.get("condition_score_min");
  const conditionScoreMax = sp.get("condition_score_max");
  const safetyConditionParam = sp.get("safety_condition") as SafetyCondition | null;
  const maintenancePriorityParam = sp.get("maintenance_priority") as MaintenancePriority | null;
  const replacementUrgencyParam = sp.get("replacement_urgency") as ReplacementUrgency | null;
  const inspectionDateFrom = sp.get("inspection_date_from");
  const inspectionDateTo = sp.get("inspection_date_to");

  // Validate enum values if provided
  if (safetyConditionParam && !Object.values(SafetyCondition).includes(safetyConditionParam)) {
    return err(
      `Invalid safety_condition. Must be one of: ${Object.values(SafetyCondition).join(", ")}`,
      422
    );
  }
  if (maintenancePriorityParam && !Object.values(MaintenancePriority).includes(maintenancePriorityParam)) {
    return err(
      `Invalid maintenance_priority. Must be one of: ${Object.values(MaintenancePriority).join(", ")}`,
      422
    );
  }
  if (replacementUrgencyParam && !Object.values(ReplacementUrgency).includes(replacementUrgencyParam)) {
    return err(
      `Invalid replacement_urgency. Must be one of: ${Object.values(ReplacementUrgency).join(", ")}`,
      422
    );
  }

  const where: Record<string, unknown> = {};
  if (assetId) where.assetId = assetId;
  if (safetyConditionParam) where.safetyCondition = safetyConditionParam;
  if (maintenancePriorityParam) where.maintenancePriority = maintenancePriorityParam;
  if (replacementUrgencyParam) where.replacementUrgency = replacementUrgencyParam;

  // condition_score range filter
  if (conditionScoreMin !== null || conditionScoreMax !== null) {
    const scoreFilter: Record<string, number> = {};
    if (conditionScoreMin !== null) scoreFilter.gte = parseInt(conditionScoreMin, 10);
    if (conditionScoreMax !== null) scoreFilter.lte = parseInt(conditionScoreMax, 10);
    where.conditionScore = scoreFilter;
  }

  // inspection_date range filter
  if (inspectionDateFrom !== null || inspectionDateTo !== null) {
    const dateFilter: Record<string, Date> = {};
    if (inspectionDateFrom !== null) dateFilter.gte = new Date(inspectionDateFrom);
    if (inspectionDateTo !== null) dateFilter.lte = new Date(inspectionDateTo);
    where.inspectionDate = dateFilter;
  }

  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const perPage = Math.min(100, Math.max(1, parseInt(sp.get("per_page") ?? "25", 10)));
  const skip = (page - 1) * perPage;

  const [records, total] = await Promise.all([
    prisma.conditionRecord.findMany({
      where,
      include: conditionRecordInclude,
      orderBy: [{ inspectionDate: "desc" }, { createdAt: "desc" }],
      skip,
      take: perPage,
    }),
    prisma.conditionRecord.count({ where }),
  ]);

  return ok(records, { page, per_page: perPage, total });
}

// POST /api/condition-records — create a new condition record (immutable after creation)
export async function POST(req: NextRequest) {
  const auth = requireAuth(req, "operations_manager");
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  const { asset_id, inspection_date, condition_score } = body;
  if (!asset_id) return err("asset_id is required", 422);
  if (!inspection_date) return err("inspection_date is required", 422);
  if (condition_score === undefined || condition_score === null) {
    return err("condition_score is required", 422);
  }

  const score = parseInt(String(condition_score), 10);
  if (isNaN(score) || score < 1 || score > 5) {
    return err("condition_score must be an integer between 1 and 5", 422);
  }

  // Validate enum values if provided
  if (
    body.safety_condition &&
    !Object.values(SafetyCondition).includes(body.safety_condition as SafetyCondition)
  ) {
    return err(
      `Invalid safety_condition. Must be one of: ${Object.values(SafetyCondition).join(", ")}`,
      422
    );
  }
  if (
    body.maintenance_priority &&
    !Object.values(MaintenancePriority).includes(body.maintenance_priority as MaintenancePriority)
  ) {
    return err(
      `Invalid maintenance_priority. Must be one of: ${Object.values(MaintenancePriority).join(", ")}`,
      422
    );
  }
  if (
    body.replacement_urgency &&
    !Object.values(ReplacementUrgency).includes(body.replacement_urgency as ReplacementUrgency)
  ) {
    return err(
      `Invalid replacement_urgency. Must be one of: ${Object.values(ReplacementUrgency).join(", ")}`,
      422
    );
  }

  const asset = await prisma.asset.findUnique({ where: { id: asset_id } });
  if (!asset) return err("Asset not found", 404);

  // Validate inspected_by_body if provided
  if (body.inspected_by_body_id) {
    const body_ = await prisma.responsibleBody.findUnique({
      where: { id: body.inspected_by_body_id },
    });
    if (!body_) return err("ResponsibleBody not found", 404);
  }

  // Find event types needed
  const [inspectionEventType, atRiskEventType] = await Promise.all([
    prisma.eventType.findUnique({ where: { name: "inspection_completed" } }),
    prisma.eventType.findUnique({ where: { name: "asset_at_risk_flagged" } }),
  ]);

  // Build auto-events array (conditionally include at-risk event if score <= 2)
  const atRiskEvents =
    score <= 2 && atRiskEventType
      ? [
          prisma.event.create({
            data: {
              eventTypeId: atRiskEventType.id,
              assetId: asset_id,
              description: `Asset flagged at risk: condition score ${score}`,
              isSystemGenerated: true,
              metadata: {
                condition_score: score,
                safety_condition: body.safety_condition ?? null,
                maintenance_priority: body.maintenance_priority ?? null,
              },
            },
          }),
        ]
      : [];

  const [conditionRecord] = await prisma.$transaction([
    prisma.conditionRecord.create({
      data: {
        assetId: asset_id,
        inspectedByUserId: body.inspected_by_user_id ?? null,
        inspectedByBodyId: body.inspected_by_body_id ?? null,
        inspectionDate: new Date(inspection_date),
        conditionScore: score,
        structuralCondition: body.structural_condition ?? null,
        safetyCondition: body.safety_condition ?? null,
        maintenancePriority: body.maintenance_priority ?? MaintenancePriority.none,
        replacementUrgency: body.replacement_urgency ?? ReplacementUrgency.none,
        notes: body.notes ?? null,
        nextInspectionDue: body.next_inspection_due
          ? new Date(body.next_inspection_due)
          : null,
      },
      include: conditionRecordInclude,
    }),
    ...(inspectionEventType
      ? [
          prisma.event.create({
            data: {
              eventTypeId: inspectionEventType.id,
              assetId: asset_id,
              description: `Inspection completed with condition score ${score}`,
              isSystemGenerated: true,
              metadata: {
                condition_score: score,
                structural_condition: body.structural_condition ?? null,
                safety_condition: body.safety_condition ?? null,
                maintenance_priority: body.maintenance_priority ?? null,
                replacement_urgency: body.replacement_urgency ?? null,
              },
            },
          }),
        ]
      : []),
    ...atRiskEvents,
  ]);

  // Trigger async risk score recompute (fire-and-forget)
  triggerRiskScoreRecompute(asset_id);

  return ok(conditionRecord, undefined, 201);
}
