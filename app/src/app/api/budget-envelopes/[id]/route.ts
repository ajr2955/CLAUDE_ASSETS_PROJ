import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { BudgetType } from "@/generated/prisma/client";
import { requireAuth } from "@/lib/rbac";
import { triggerRiskScoreRecompute } from "@/lib/risk-scoring";

const VARIANCE_THRESHOLD = Number(process.env.BUDGET_VARIANCE_THRESHOLD ?? "0.10"); // default 10%

type Params = { params: Promise<{ id: string }> };

// GET /api/budget-envelopes/:id (operations_manager+)
export async function GET(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req, "operations_manager");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const envelope = await prisma.budgetEnvelope.findUnique({
    where: { id },
    include: {
      asset: { select: { id: true, assetName: true, assetCode: true } },
      lifecycleStage: { select: { id: true, name: true } },
      responsibleBody: { select: { id: true, name: true } },
    },
  });

  if (!envelope) return err("Budget envelope not found", 404);
  return ok(envelope);
}

// PUT /api/budget-envelopes/:id (asset_manager+)
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req, "asset_manager");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  const existing = await prisma.budgetEnvelope.findUnique({ where: { id } });
  if (!existing) return err("Budget envelope not found", 404);

  const data: Record<string, unknown> = {};

  if (body.approved_amount !== undefined) data.approvedAmount = Number(body.approved_amount);
  if (body.committed_amount !== undefined) data.committedAmount = Number(body.committed_amount);
  if (body.actual_amount !== undefined) data.actualAmount = Number(body.actual_amount);
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.external_source_description !== undefined) {
    data.externalSourceDescription = body.external_source_description;
  }
  if (body.developer_funded_amount !== undefined) {
    data.developerFundedAmount = Number(body.developer_funded_amount);
  }
  if (body.budget_type !== undefined) {
    if (!Object.values(BudgetType).includes(body.budget_type as BudgetType)) {
      return err(`Invalid budget_type: ${body.budget_type}`, 422);
    }
    data.budgetType = body.budget_type;
  }
  if (body.fiscal_year !== undefined) data.fiscalYear = body.fiscal_year !== null ? Number(body.fiscal_year) : null;
  if (body.is_closed !== undefined) data.isClosed = Boolean(body.is_closed);

  if (Object.keys(data).length === 0) return err("No updatable fields provided", 422);

  // Recompute variance_amount on every update
  const approvedAmount =
    data.approvedAmount !== undefined ? Number(data.approvedAmount) : Number(existing.approvedAmount);
  const actualAmount =
    data.actualAmount !== undefined ? Number(data.actualAmount) : Number(existing.actualAmount);
  data.varianceAmount = approvedAmount - actualAmount;

  const updated = await prisma.budgetEnvelope.update({
    where: { id },
    data,
    include: {
      asset: { select: { id: true, assetName: true, assetCode: true } },
      lifecycleStage: { select: { id: true, name: true } },
      responsibleBody: { select: { id: true, name: true } },
    },
  });

  // Budget variance detection: fire governance event once per envelope when threshold crossed
  const newVariance = Number(updated.varianceAmount);
  const newApproved = Number(updated.approvedAmount);
  const newActual = Number(updated.actualAmount);

  const isOverThreshold =
    newApproved > 0 &&
    newActual > newApproved &&
    (newActual - newApproved) / newApproved > VARIANCE_THRESHOLD;

  if (isOverThreshold && !updated.varianceEventCreated) {
    const variancePercent = Math.round(((newActual - newApproved) / newApproved) * 100 * 10) / 10;
    const eventType = await prisma.eventType.findFirst({
      where: { name: "budget_variance_detected" },
    });
    if (eventType) {
      await prisma.$transaction([
        prisma.event.create({
          data: {
            eventTypeId: eventType.id,
            assetId: updated.assetId,
            isSystemGenerated: true,
            description: `Budget variance of ${variancePercent}% detected on ${updated.budgetType} envelope`,
            metadata: {
              budget_type: updated.budgetType,
              approved_amount: newApproved,
              actual_amount: newActual,
              variance_amount: newVariance,
              variance_percent: variancePercent,
              envelope_id: updated.id,
            },
          },
        }),
        prisma.budgetEnvelope.update({
          where: { id: updated.id },
          data: { varianceEventCreated: true },
        }),
      ]);
    }
  }

  // Trigger async risk score recompute (fire-and-forget)
  triggerRiskScoreRecompute(updated.assetId);

  return ok(updated);
}

// DELETE /api/budget-envelopes/:id (asset_manager+)
// Allowed only if actual_amount = 0; otherwise soft-close
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req, "asset_manager");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const existing = await prisma.budgetEnvelope.findUnique({ where: { id } });
  if (!existing) return err("Budget envelope not found", 404);

  if (Number(existing.actualAmount) !== 0) {
    // Soft-close instead of hard delete
    const closed = await prisma.budgetEnvelope.update({
      where: { id },
      data: { isClosed: true },
      include: {
        asset: { select: { id: true, assetName: true, assetCode: true } },
        lifecycleStage: { select: { id: true, name: true } },
      },
    });
    return ok({ ...closed, _action: "soft_closed" });
  }

  // Hard delete only when actual_amount is 0
  await prisma.budgetEnvelope.delete({ where: { id } });
  return ok({ deleted: true, id });
}
