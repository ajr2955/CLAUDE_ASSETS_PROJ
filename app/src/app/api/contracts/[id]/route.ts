import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

const contractInclude = {
  contractType: true,
  asset: { select: { id: true, assetName: true, assetCode: true } },
  responsibleBody: { select: { id: true, name: true } },
};

// GET /api/contracts/:id — full contract detail
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const contract = await prisma.contract.findUnique({
    where: { id },
    include: contractInclude,
  });
  if (!contract) return err("Contract not found", 404);
  return ok(contract);
}

// PUT /api/contracts/:id — update mutable fields
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(req, "asset_manager");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = await prisma.contract.findUnique({ where: { id } });
  if (!existing) return err("Contract not found", 404);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  const data: Record<string, unknown> = {};
  if (body.counterparty_name !== undefined) data.counterpartyName = body.counterparty_name;
  if (body.counterparty_type !== undefined) data.counterpartyType = body.counterparty_type;
  if (body.responsible_body_id !== undefined) data.responsibleBodyId = body.responsible_body_id;
  if (body.start_date !== undefined) data.startDate = new Date(body.start_date);
  if (body.end_date !== undefined) data.endDate = body.end_date ? new Date(body.end_date) : null;
  if (body.notice_period_days !== undefined) data.noticePeriodDays = body.notice_period_days;
  if (body.renewal_option !== undefined) data.renewalOption = body.renewal_option;
  if (body.auto_renewal !== undefined) data.autoRenewal = body.auto_renewal;
  if (body.contract_value !== undefined) data.contractValue = body.contract_value;
  if (body.periodic_amount !== undefined) data.periodicAmount = body.periodic_amount;
  if (body.payment_frequency !== undefined) data.paymentFrequency = body.payment_frequency;
  if (body.sla_description !== undefined) data.slaDescription = body.sla_description;
  if (body.notes !== undefined) data.notes = body.notes;

  const updated = await prisma.contract.update({
    where: { id },
    data,
    include: contractInclude,
  });
  return ok(updated);
}
