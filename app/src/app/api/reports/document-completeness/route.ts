import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const family_id = searchParams.get("family_id");
  const stage_id = searchParams.get("stage_id");
  const responsible_body_id = searchParams.get("responsible_body_id");
  const has_missing = searchParams.get("has_missing");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const per_page = Math.min(100, parseInt(searchParams.get("per_page") ?? "25"));

  // Build asset filter
  const assetWhere: Record<string, unknown> = {
    currentStatus: { not: "disposed" },
  };
  if (family_id) assetWhere.assetFamilyId = family_id;
  if (stage_id) assetWhere.currentLifecycleStageId = stage_id;
  if (responsible_body_id) {
    assetWhere.OR = [
      { responsibleBodyId: responsible_body_id },
      { operationalBodyId: responsible_body_id },
      { maintenanceBodyId: responsible_body_id },
    ];
  }

  // Fetch assets with basic info
  const assets = await prisma.asset.findMany({
    where: assetWhere,
    select: {
      id: true,
      assetCode: true,
      assetName: true,
      assetFamilyId: true,
      assetTypeId: true,
      currentLifecycleStageId: true,
      assetFamily: { select: { name: true } },
      assetType: { select: { name: true } },
      currentLifecycleStage: { select: { name: true } },
    },
    orderBy: { assetCode: "asc" },
  });

  if (assets.length === 0) {
    return NextResponse.json(ok([], { page, per_page, total: 0 }));
  }

  // Get all active completeness rules grouped by lifecycle stage
  const allRules = await prisma.documentCompletenessRule.findMany({
    where: { isActive: true },
    include: {
      documentType: { select: { id: true, name: true } },
    },
  });

  // Get all non-deleted documents for these assets
  const assetIds = assets.map((a) => a.id);
  const allDocs = await prisma.document.findMany({
    where: {
      attachedToEntityType: "asset",
      attachedToEntityId: { in: assetIds },
      isDeleted: false,
    },
    select: { attachedToEntityId: true, documentTypeId: true },
  });

  // Build document index: assetId -> Set<documentTypeId>
  const docIndex = new Map<string, Set<string>>();
  for (const doc of allDocs) {
    let s = docIndex.get(doc.attachedToEntityId);
    if (!s) { s = new Set(); docIndex.set(doc.attachedToEntityId, s); }
    s.add(doc.documentTypeId);
  }

  // Compute completeness for each asset
  const results = assets.map((asset) => {
    const applicableRules = allRules.filter(
      (r) =>
        r.lifecycleStageId === asset.currentLifecycleStageId &&
        (r.assetFamilyId === null || r.assetFamilyId === asset.assetFamilyId) &&
        (r.assetTypeId === null || r.assetTypeId === asset.assetTypeId)
    );

    const assetDocs = docIndex.get(asset.id) ?? new Set<string>();
    const ruleDetails = applicableRules.map((r) => {
      const satisfied = assetDocs.has(r.documentTypeId);
      return {
        rule_id: r.id,
        document_type_id: r.documentTypeId,
        document_type_name: r.documentType.name,
        is_mandatory: r.isMandatory,
        is_satisfied: satisfied,
      };
    });

    const total = ruleDetails.length;
    const satisfied = ruleDetails.filter((r) => r.is_satisfied).length;
    const missing_count = total - satisfied;
    const completeness_score = total > 0 ? Math.round((satisfied / total) * 100) : 100;

    return {
      asset_id: asset.id,
      asset_code: asset.assetCode,
      asset_name: asset.assetName,
      family_name: asset.assetFamily?.name ?? null,
      type_name: asset.assetType?.name ?? null,
      lifecycle_stage_name: asset.currentLifecycleStage?.name ?? null,
      completeness_score,
      total_rules: total,
      satisfied_rules: satisfied,
      missing_count,
      rules: ruleDetails,
    };
  });

  // Apply has_missing filter
  const filtered = has_missing === "true"
    ? results.filter((r) => r.missing_count > 0)
    : results;

  const total = filtered.length;
  const paginated = filtered.slice((page - 1) * per_page, page * per_page);

  return NextResponse.json(ok(paginated, { page, per_page, total }));
}
