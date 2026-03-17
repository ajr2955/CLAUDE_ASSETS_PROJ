import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  // Load asset with its current lifecycle stage, family, and type
  const asset = await prisma.asset.findUnique({
    where: { id },
    select: {
      id: true,
      assetFamilyId: true,
      assetTypeId: true,
      currentLifecycleStageId: true,
    },
  });

  if (!asset) return NextResponse.json(err("Asset not found"), { status: 404 });

  // Find all active completeness rules applicable to this asset's current stage.
  // A rule applies if:
  //   - its lifecycle_stage_id matches the asset's current stage, AND
  //   - its asset_family_id is null (all families) OR matches the asset's family, AND
  //   - its asset_type_id is null (all types) OR matches the asset's type
  const rules = await prisma.documentCompletenessRule.findMany({
    where: {
      isActive: true,
      lifecycleStageId: asset.currentLifecycleStageId,
      OR: [
        { assetFamilyId: null },
        { assetFamilyId: asset.assetFamilyId },
      ],
    },
    include: {
      documentType: { select: { id: true, name: true } },
      lifecycleStage: { select: { id: true, name: true } },
      assetFamily: { select: { id: true, name: true } },
      assetType: { select: { id: true, name: true } },
    },
  });

  // Filter out rules with a type restriction that doesn't match
  const applicableRules = rules.filter(
    (r) => r.assetTypeId === null || r.assetTypeId === asset.assetTypeId
  );

  if (applicableRules.length === 0) {
    return NextResponse.json(
      ok({
        asset_id: id,
        lifecycle_stage_id: asset.currentLifecycleStageId,
        rules: [],
        completeness_score: 100,
        total_rules: 0,
        satisfied_rules: 0,
        missing_count: 0,
      })
    );
  }

  // Collect all required document type IDs
  const requiredDocTypeIds = applicableRules.map((r) => r.documentTypeId);

  // Check which of those document types exist attached to this asset
  const existingDocs = await prisma.document.findMany({
    where: {
      attachedToEntityType: "asset",
      attachedToEntityId: id,
      documentTypeId: { in: requiredDocTypeIds },
      isDeleted: false,
    },
    select: { documentTypeId: true },
  });

  const satisfiedDocTypeIds = new Set(existingDocs.map((d) => d.documentTypeId));

  const ruleResults = applicableRules.map((rule) => {
    const is_satisfied = satisfiedDocTypeIds.has(rule.documentTypeId);
    return {
      rule_id: rule.id,
      lifecycle_stage: rule.lifecycleStage,
      required_document_type: rule.documentType,
      applies_to_family: rule.assetFamily,
      applies_to_type: rule.assetType,
      is_mandatory: rule.isMandatory,
      is_satisfied,
      missing: !is_satisfied,
    };
  });

  const satisfiedCount = ruleResults.filter((r) => r.is_satisfied).length;
  const total = ruleResults.length;
  const completeness_score = total > 0 ? Math.round((satisfiedCount / total) * 100) : 100;

  return NextResponse.json(
    ok({
      asset_id: id,
      lifecycle_stage_id: asset.currentLifecycleStageId,
      rules: ruleResults,
      completeness_score,
      total_rules: total,
      satisfied_rules: satisfiedCount,
      missing_count: total - satisfiedCount,
    })
  );
}
