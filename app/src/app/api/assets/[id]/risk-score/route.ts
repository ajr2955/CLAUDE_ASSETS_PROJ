import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";
import { computeRiskScore } from "@/lib/risk-scoring";

/**
 * GET /api/assets/:id/risk-score
 *
 * Returns the current risk score and component breakdown for an asset.
 * If no score exists yet, computes one on-the-fly.
 * Requires at minimum authenticated access (department_user+).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  // Check asset exists
  const asset = await prisma.asset.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!asset) {
    return NextResponse.json(err("Asset not found"), { status: 404 });
  }

  // Try existing stored score first
  const stored = await prisma.assetRiskScore.findUnique({
    where: { assetId: id },
  });

  // If no stored score, compute now
  if (!stored) {
    try {
      const result = await computeRiskScore(id);
      return NextResponse.json(ok(result));
    } catch (e) {
      console.error("[risk-score] compute error", e);
      return NextResponse.json(err("Failed to compute risk score"), { status: 500 });
    }
  }

  return NextResponse.json(
    ok({
      asset_id: stored.assetId,
      risk_score: stored.riskScore,
      risk_band: stored.riskBand,
      score_components: stored.scoreComponents,
      computed_at: stored.computedAt.toISOString(),
    })
  );
}
