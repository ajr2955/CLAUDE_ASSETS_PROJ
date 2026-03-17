import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";
import { validateTransition } from "@/lib/transition-validation";

type Params = { params: Promise<{ id: string }> };

// POST /api/assets/:id/transition (asset_manager+)
export async function POST(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req, "asset_manager");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  const { to_stage_id, justification, override_warnings } = body;
  if (!to_stage_id) return err("to_stage_id is required", 422);

  // Load asset with current stage and family
  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      currentLifecycleStage: { select: { id: true, name: true } },
      assetFamily: { select: { id: true, name: true } },
    },
  });
  if (!asset) return err("Asset not found", 404);

  // Verify target stage exists
  const toStage = await prisma.lifecycleStage.findUnique({
    where: { id: to_stage_id },
    select: { id: true, name: true },
  });
  if (!toStage) return err("Target lifecycle stage not found", 404);

  // Use TransitionValidationService to check conditions
  const validation = await validateTransition(
    id,
    asset.currentLifecycleStageId,
    to_stage_id,
    asset.assetFamilyId
  );

  if (!validation.is_valid_path) {
    return err(
      `No valid transition path from "${asset.currentLifecycleStage.name}" to "${toStage.name}" for this asset family`,
      422
    );
  }

  const warnings = validation.unmet_conditions;

  // Fetch warning message from transition for display
  const transition = await prisma.lifecycleTransition.findFirst({
    where: {
      fromStageId: asset.currentLifecycleStageId,
      toStageId: to_stage_id,
      isActive: true,
      OR: [
        { appliesToFamilyId: asset.assetFamilyId },
        { appliesToFamilyId: null },
      ],
    },
    select: { warningMessage: true },
  });

  // If there are warnings and override_warnings is not set, return warnings without transitioning
  if (warnings.length > 0 && !override_warnings) {
    return ok({
      transition_blocked: false,
      warnings,
      message: transition?.warningMessage ?? "Transition has unmet conditions. Pass override_warnings: true with a justification to proceed.",
    });
  }

  // Find the governance event type for lifecycle_stage_changed
  const stageChangedEventType = await prisma.eventType.findUnique({
    where: { name: "lifecycle_stage_changed" },
    select: { id: true },
  });

  const previousStageId = asset.currentLifecycleStageId;

  // Atomically update asset stage + create governance event
  const [updatedAsset] = await prisma.$transaction([
    prisma.asset.update({
      where: { id },
      data: { currentLifecycleStageId: to_stage_id },
      include: {
        currentLifecycleStage: { select: { id: true, name: true, displayOrder: true } },
        assetFamily: { select: { id: true, name: true } },
        assetType: { select: { id: true, name: true } },
      },
    }),
    ...(stageChangedEventType
      ? [
          prisma.event.create({
            data: {
              eventTypeId: stageChangedEventType.id,
              assetId: id,
              lifecycleStageId: to_stage_id,
              isSystemGenerated: true,
              description: justification ?? null,
              metadata: {
                from_stage_id: previousStageId,
                from_stage_name: asset.currentLifecycleStage.name,
                to_stage_id,
                to_stage_name: toStage.name,
                ...(warnings.length > 0 && override_warnings
                  ? { warnings_overridden: true, justification: justification ?? null }
                  : {}),
              },
            },
          }),
        ]
      : []),
  ]);

  return ok({
    asset: updatedAsset,
    warnings: warnings.length > 0 ? warnings : [],
    warnings_overridden: warnings.length > 0 && !!override_warnings,
    transition_blocked: false,
  });
}
