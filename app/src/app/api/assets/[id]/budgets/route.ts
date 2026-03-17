import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

// GET /api/assets/:id/budgets — all budget envelopes for an asset, grouped by budget_type with totals (operations_manager+)
export async function GET(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req, "operations_manager");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const asset = await prisma.asset.findUnique({
    where: { id },
    select: { id: true, assetName: true, assetCode: true },
  });
  if (!asset) return err("Asset not found", 404);

  const envelopes = await prisma.budgetEnvelope.findMany({
    where: { assetId: id },
    include: {
      lifecycleStage: { select: { id: true, name: true } },
      responsibleBody: { select: { id: true, name: true } },
    },
    orderBy: [{ budgetType: "asc" }, { fiscalYear: "desc" }],
  });

  // Group by budget_type and compute totals per group
  const grouped: Record<
    string,
    {
      budget_type: string;
      envelopes: typeof envelopes;
      totals: {
        approved: number;
        committed: number;
        actual: number;
        variance: number;
      };
    }
  > = {};

  let grandApproved = 0;
  let grandCommitted = 0;
  let grandActual = 0;
  let grandVariance = 0;

  for (const env of envelopes) {
    const type = env.budgetType;
    if (!grouped[type]) {
      grouped[type] = {
        budget_type: type,
        envelopes: [],
        totals: { approved: 0, committed: 0, actual: 0, variance: 0 },
      };
    }
    grouped[type].envelopes.push(env);
    grouped[type].totals.approved += Number(env.approvedAmount);
    grouped[type].totals.committed += Number(env.committedAmount);
    grouped[type].totals.actual += Number(env.actualAmount);
    grouped[type].totals.variance += Number(env.varianceAmount);
    grandApproved += Number(env.approvedAmount);
    grandCommitted += Number(env.committedAmount);
    grandActual += Number(env.actualAmount);
    grandVariance += Number(env.varianceAmount);
  }

  return ok({
    asset,
    groups: Object.values(grouped),
    grand_totals: {
      approved: grandApproved,
      committed: grandCommitted,
      actual: grandActual,
      variance: grandVariance,
    },
  });
}
