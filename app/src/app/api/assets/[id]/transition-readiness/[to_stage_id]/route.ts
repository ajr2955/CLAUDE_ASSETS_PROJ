import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";
import { validateTransition } from "@/lib/transition-validation";

type Params = { params: Promise<{ id: string; to_stage_id: string }> };

// GET /api/assets/:id/transition-readiness/:to_stage_id
// Read-only endpoint: returns validation result without performing any transition.
// Used by the UI to show warnings before the user confirms.
export async function GET(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const { id, to_stage_id } = await params;

  // Load asset
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

  const validation = await validateTransition(
    id,
    asset.currentLifecycleStageId,
    to_stage_id,
    asset.assetFamilyId
  );

  return ok({
    asset_id: id,
    from_stage: { id: asset.currentLifecycleStageId, name: asset.currentLifecycleStage.name },
    to_stage: { id: to_stage_id, name: toStage.name },
    is_valid_path: validation.is_valid_path,
    unmet_conditions: validation.unmet_conditions,
    all_conditions_met: validation.is_valid_path && validation.unmet_conditions.length === 0,
  });
}
