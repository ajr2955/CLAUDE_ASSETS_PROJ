import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { EventCategory } from "@/generated/prisma/client";
import { requireAuth } from "@/lib/rbac";
import { triggerRiskScoreRecompute } from "@/lib/risk-scoring";

// GET /api/events — paginated event list with filters
export async function GET(req: NextRequest) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = req.nextUrl;

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") ?? "25", 10)));

  const assetId = searchParams.get("asset_id");
  const eventTypeId = searchParams.get("event_type_id");
  const category = searchParams.get("category") as EventCategory | null;
  const lifecycleStageId = searchParams.get("lifecycle_stage_id");
  const responsibleBodyId = searchParams.get("responsible_body_id");
  const occurredAtFrom = searchParams.get("occurred_at_from");
  const occurredAtTo = searchParams.get("occurred_at_to");
  const isSystemGenerated = searchParams.get("is_system_generated");

  const validCategories: EventCategory[] = ["business", "operational", "governance"];
  if (category && !validCategories.includes(category)) {
    return err(`Invalid category. Must be one of: ${validCategories.join(", ")}`, 422);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (assetId) where.assetId = assetId;
  if (eventTypeId) where.eventTypeId = eventTypeId;
  if (lifecycleStageId) where.lifecycleStageId = lifecycleStageId;
  if (responsibleBodyId) where.responsibleBodyId = responsibleBodyId;
  if (isSystemGenerated === "true") where.isSystemGenerated = true;
  if (isSystemGenerated === "false") where.isSystemGenerated = false;
  if (occurredAtFrom || occurredAtTo) {
    where.occurredAt = {};
    if (occurredAtFrom) where.occurredAt.gte = new Date(occurredAtFrom);
    if (occurredAtTo) where.occurredAt.lte = new Date(occurredAtTo);
  }
  if (category) {
    where.eventType = { category };
  }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      include: {
        eventType: { select: { id: true, name: true, category: true } },
        asset: { select: { id: true, assetCode: true, assetName: true } },
        lifecycleStage: { select: { id: true, name: true } },
        responsibleBody: { select: { id: true, name: true } },
      },
      orderBy: { occurredAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.event.count({ where }),
  ]);

  return ok(events, { page, per_page: perPage, total });
}

// POST /api/events — create a new event (department_user+)
export async function POST(req: NextRequest) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  const { event_type_id, asset_id, lifecycle_stage_id, occurred_at, responsible_body_id, description, metadata } =
    body;

  if (!event_type_id || typeof event_type_id !== "string") {
    return err("event_type_id is required", 422);
  }
  if (!asset_id || typeof asset_id !== "string") {
    return err("asset_id is required", 422);
  }

  // Verify event type exists
  const eventType = await prisma.eventType.findUnique({ where: { id: event_type_id } });
  if (!eventType) return err("event_type_id references an event type that does not exist", 422);

  // Verify asset exists
  const asset = await prisma.asset.findUnique({ where: { id: asset_id }, select: { id: true } });
  if (!asset) return err("asset_id references an asset that does not exist", 422);

  // Verify optional FKs
  if (lifecycle_stage_id) {
    const stage = await prisma.lifecycleStage.findUnique({ where: { id: lifecycle_stage_id } });
    if (!stage) return err("lifecycle_stage_id references a stage that does not exist", 422);
  }
  if (responsible_body_id) {
    const body_rec = await prisma.responsibleBody.findUnique({ where: { id: responsible_body_id } });
    if (!body_rec) return err("responsible_body_id references a body that does not exist", 422);
  }

  const event = await prisma.event.create({
    data: {
      eventTypeId: event_type_id,
      assetId: asset_id,
      lifecycleStageId: lifecycle_stage_id ?? null,
      occurredAt: occurred_at ? new Date(occurred_at) : new Date(),
      responsibleBodyId: responsible_body_id ?? null,
      description: description ?? null,
      metadata: metadata ?? null,
      isSystemGenerated: false,
    },
    include: {
      eventType: { select: { id: true, name: true, category: true } },
      asset: { select: { id: true, assetCode: true, assetName: true } },
      lifecycleStage: { select: { id: true, name: true } },
      responsibleBody: { select: { id: true, name: true } },
    },
  });

  // Trigger async risk score recompute when a governance event is created
  if (event.eventType.category === "governance") {
    triggerRiskScoreRecompute(asset_id);
  }

  return ok(event, undefined, 201);
}
