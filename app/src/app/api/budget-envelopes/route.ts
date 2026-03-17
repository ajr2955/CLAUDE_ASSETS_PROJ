import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { BudgetType } from "@/generated/prisma/client";
import { requireAuth } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req, "operations_manager");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = req.nextUrl;
  const assetId = searchParams.get("asset_id");
  const budgetType = searchParams.get("budget_type");
  const fiscalYear = searchParams.get("fiscal_year");
  const lifecycleStageId = searchParams.get("lifecycle_stage_id");
  const responsibleBodyId = searchParams.get("responsible_body_id");

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") ?? "25")));

  // Validate budget_type enum if provided
  if (budgetType && !Object.values(BudgetType).includes(budgetType as BudgetType)) {
    return err(`Invalid budget_type: ${budgetType}`, 422);
  }

  const where = {
    ...(assetId ? { assetId } : {}),
    ...(budgetType ? { budgetType: budgetType as BudgetType } : {}),
    ...(fiscalYear ? { fiscalYear: parseInt(fiscalYear) } : {}),
    ...(lifecycleStageId ? { lifecycleStageId } : {}),
    ...(responsibleBodyId ? { responsibleBodyId } : {}),
  };

  const [envelopes, total] = await Promise.all([
    prisma.budgetEnvelope.findMany({
      where,
      include: {
        asset: { select: { id: true, assetName: true, assetCode: true } },
        lifecycleStage: { select: { id: true, name: true } },
        responsibleBody: { select: { id: true, name: true } },
      },
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: [{ assetId: "asc" }, { budgetType: "asc" }, { fiscalYear: "desc" }],
    }),
    prisma.budgetEnvelope.count({ where }),
  ]);

  return ok(envelopes, { page, per_page: perPage, total });
}

export async function POST(req: NextRequest) {
  const authPost = requireAuth(req, "asset_manager");
  if (authPost instanceof NextResponse) return authPost;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }

  const {
    asset_id,
    budget_type,
    lifecycle_stage_id,
    fiscal_year,
    is_multi_year,
    multi_year_start,
    multi_year_end,
    approved_amount,
    committed_amount,
    actual_amount,
    external_source_description,
    developer_funded_amount,
    responsible_body_id,
    notes,
  } = body as Record<string, unknown>;

  if (!asset_id || typeof asset_id !== "string") {
    return err("asset_id is required", 422);
  }
  if (!budget_type || typeof budget_type !== "string") {
    return err("budget_type is required", 422);
  }
  if (!Object.values(BudgetType).includes(budget_type as BudgetType)) {
    return err(`Invalid budget_type: ${budget_type}`, 422);
  }

  // Must have fiscal_year or is_multi_year
  const hasMultiYear = is_multi_year === true;
  const hasFiscalYear = fiscal_year !== null && fiscal_year !== undefined;
  if (!hasFiscalYear && !hasMultiYear) {
    return err("At least one of fiscal_year or is_multi_year must be provided", 422);
  }

  // Verify asset exists
  const asset = await prisma.asset.findUnique({ where: { id: asset_id } });
  if (!asset) {
    return err("Asset not found", 404);
  }

  // Verify lifecycle stage if provided
  if (lifecycle_stage_id) {
    const stage = await prisma.lifecycleStage.findUnique({ where: { id: lifecycle_stage_id as string } });
    if (!stage) return err("Lifecycle stage not found", 404);
  }

  // Verify responsible body if provided
  if (responsible_body_id) {
    const body_rec = await prisma.responsibleBody.findUnique({ where: { id: responsible_body_id as string } });
    if (!body_rec) return err("Responsible body not found", 404);
  }

  const approved = approved_amount !== undefined ? Number(approved_amount) : 0;
  const actual = actual_amount !== undefined ? Number(actual_amount) : 0;
  const variance = approved - actual;

  const envelope = await prisma.budgetEnvelope.create({
    data: {
      assetId: asset_id,
      budgetType: budget_type as BudgetType,
      lifecycleStageId: lifecycle_stage_id as string | undefined ?? null,
      fiscalYear: hasFiscalYear ? Number(fiscal_year) : null,
      isMultiYear: hasMultiYear,
      multiYearStart: multi_year_start !== undefined ? Number(multi_year_start) : null,
      multiYearEnd: multi_year_end !== undefined ? Number(multi_year_end) : null,
      approvedAmount: approved,
      committedAmount: committed_amount !== undefined ? Number(committed_amount) : 0,
      actualAmount: actual,
      varianceAmount: variance,
      externalSourceDescription: external_source_description as string | null ?? null,
      developerFundedAmount: developer_funded_amount !== undefined ? Number(developer_funded_amount) : 0,
      responsibleBodyId: responsible_body_id as string | undefined ?? null,
      notes: notes as string | null ?? null,
    },
    include: {
      asset: { select: { id: true, assetName: true, assetCode: true } },
      lifecycleStage: { select: { id: true, name: true } },
      responsibleBody: { select: { id: true, name: true } },
    },
  });

  return ok(envelope, undefined, 201);
}
