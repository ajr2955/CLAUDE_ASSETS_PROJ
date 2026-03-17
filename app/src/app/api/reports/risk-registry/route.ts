import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

/**
 * GET /api/reports/risk-registry
 *
 * Returns all assets with their risk scores, sorted by risk_score descending.
 * Supports filters: family_id, responsible_body_id, risk_band, lifecycle_stage_id.
 * Requires asset_manager+ role.
 */
export async function GET(req: NextRequest) {
  const auth = requireAuth(req, "asset_manager");
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const family_id = sp.get("family_id");
  const responsible_body_id = sp.get("responsible_body_id");
  const risk_band = sp.get("risk_band");
  const lifecycle_stage_id = sp.get("lifecycle_stage_id");
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const per_page = Math.min(100, Math.max(1, parseInt(sp.get("per_page") ?? "50", 10)));

  const validBands = ["Low", "Medium", "High", "Critical"];

  // Build asset where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assetWhere: Record<string, any> = {};
  if (family_id) assetWhere.assetFamilyId = family_id;
  if (responsible_body_id) assetWhere.responsibleBodyId = responsible_body_id;
  if (lifecycle_stage_id) assetWhere.currentLifecycleStageId = lifecycle_stage_id;

  // Build risk score where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const riskWhere: Record<string, any> = {};
  if (risk_band && validBands.includes(risk_band)) {
    riskWhere.riskBand = risk_band;
  }
  if (Object.keys(assetWhere).length > 0) {
    riskWhere.asset = assetWhere;
  }

  const [scores, total] = await prisma.$transaction([
    prisma.assetRiskScore.findMany({
      where: riskWhere,
      orderBy: [{ riskScore: "desc" }],
      skip: (page - 1) * per_page,
      take: per_page,
      include: {
        asset: {
          select: {
            id: true,
            assetCode: true,
            assetName: true,
            currentStatus: true,
            assetFamily: { select: { id: true, name: true } },
            assetType: { select: { id: true, name: true } },
            currentLifecycleStage: { select: { id: true, name: true } },
            responsibleBody: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.assetRiskScore.count({ where: riskWhere }),
  ]);

  const data = scores.map((s) => {
    // Extract top 3 contributing factors from score_components
    const components = s.scoreComponents as Record<string, number> | null;
    const topFactors: { label: string; points: number }[] = [];
    if (components) {
      const factorMap: Record<string, string> = {
        condition_score_points: "Condition Score",
        safety_condition_points: "Safety Condition",
        overdue_work_orders_points: "Overdue Work Orders",
        missing_documents_points: "Missing Documents",
        budget_variance_points: "Budget Variance",
        governance_events_points: "Governance Events",
      };
      const factors = Object.entries(factorMap)
        .map(([key, label]) => ({ label, points: (components[key] as number) ?? 0 }))
        .filter((f) => f.points > 0)
        .sort((a, b) => b.points - a.points)
        .slice(0, 3);
      topFactors.push(...factors);
    }

    return {
      asset_id: s.assetId,
      asset_code: s.asset.assetCode,
      asset_name: s.asset.assetName,
      family: s.asset.assetFamily,
      type: s.asset.assetType,
      lifecycle_stage: s.asset.currentLifecycleStage,
      responsible_body: s.asset.responsibleBody,
      risk_score: s.riskScore,
      risk_band: s.riskBand,
      top_factors: topFactors,
      computed_at: s.computedAt.toISOString(),
    };
  });

  return NextResponse.json(
    ok(data, { page, per_page, total })
  );
}
