import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

// GET /api/lifecycle-transitions — returns all transitions; supports ?from_stage_id= and ?family_id=
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const fromStageId = searchParams.get("from_stage_id");
  const familyId = searchParams.get("family_id");

  const where: Record<string, unknown> = {};
  if (fromStageId) where.fromStageId = fromStageId;
  if (familyId) {
    where.OR = [
      { appliesToFamilyId: familyId },
      { appliesToFamilyId: null },
    ];
  }

  const transitions = await prisma.lifecycleTransition.findMany({
    where,
    include: {
      fromStage: { select: { id: true, name: true, displayOrder: true } },
      toStage: { select: { id: true, name: true, displayOrder: true } },
      appliesToFamily: { select: { id: true, name: true } },
    },
    orderBy: [{ fromStage: { displayOrder: "asc" } }, { toStage: { displayOrder: "asc" } }],
  });

  return ok(transitions);
}

// POST /api/lifecycle-transitions — creates a new transition rule (admin only)
export async function POST(req: NextRequest) {
  const auth = requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  const { from_stage_id, to_stage_id, warning_message } = body;

  if (!from_stage_id || typeof from_stage_id !== "string") {
    return err("from_stage_id is required", 422);
  }
  if (!to_stage_id || typeof to_stage_id !== "string") {
    return err("to_stage_id is required", 422);
  }
  if (!warning_message || typeof warning_message !== "string" || warning_message.trim().length === 0) {
    return err("warning_message is required", 422);
  }

  const [fromStage, toStage] = await Promise.all([
    prisma.lifecycleStage.findUnique({ where: { id: from_stage_id } }),
    prisma.lifecycleStage.findUnique({ where: { id: to_stage_id } }),
  ]);

  if (!fromStage) return err("from_stage_id references a stage that does not exist", 422);
  if (!toStage) return err("to_stage_id references a stage that does not exist", 422);

  if (body.applies_to_family_id) {
    const family = await prisma.assetFamily.findUnique({ where: { id: body.applies_to_family_id } });
    if (!family) return err("applies_to_family_id references a family that does not exist", 422);
  }

  const transition = await prisma.lifecycleTransition.create({
    data: {
      fromStageId: from_stage_id,
      toStageId: to_stage_id,
      warningMessage: warning_message.trim(),
      appliesToFamilyId: body.applies_to_family_id ?? null,
      requiredDocumentTypes: body.required_document_types ?? null,
      requiredEvents: body.required_events ?? null,
      isActive: body.is_active ?? true,
    },
    include: {
      fromStage: { select: { id: true, name: true } },
      toStage: { select: { id: true, name: true } },
      appliesToFamily: { select: { id: true, name: true } },
    },
  });

  return ok(transition, undefined, 201);
}
