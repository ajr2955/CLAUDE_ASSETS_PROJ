import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";
import { ContractStatus, CounterpartyType } from "@/generated/prisma/client";

// GET /api/contracts — list contracts with optional filters
export async function GET(req: NextRequest) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const assetId = sp.get("asset_id");
  const contractTypeId = sp.get("contract_type_id");
  const status = sp.get("status") as ContractStatus | null;
  const counterpartyType = sp.get("counterparty_type") as CounterpartyType | null;
  const expiringWithinDays = sp.get("expiring_within_days");

  const validStatuses = Object.values(ContractStatus);
  if (status && !validStatuses.includes(status)) {
    return err(`Invalid status. Must be one of: ${validStatuses.join(", ")}`, 422);
  }

  const validCounterpartyTypes = Object.values(CounterpartyType);
  if (counterpartyType && !validCounterpartyTypes.includes(counterpartyType)) {
    return err(`Invalid counterparty_type. Must be one of: ${validCounterpartyTypes.join(", ")}`, 422);
  }

  const where: Record<string, unknown> = {};
  if (assetId) where.assetId = assetId;
  if (contractTypeId) where.contractTypeId = contractTypeId;
  if (status) where.status = status;
  if (counterpartyType) where.counterpartyType = counterpartyType;
  if (expiringWithinDays) {
    const days = parseInt(expiringWithinDays, 10);
    if (isNaN(days) || days < 0) {
      return err("expiring_within_days must be a non-negative integer", 422);
    }
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    where.endDate = { lte: cutoff };
  }

  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const perPage = Math.min(100, Math.max(1, parseInt(sp.get("per_page") ?? "25", 10)));
  const skip = (page - 1) * perPage;

  const [contracts, total] = await Promise.all([
    prisma.contract.findMany({
      where,
      include: {
        contractType: true,
        asset: { select: { id: true, assetName: true, assetCode: true } },
        responsibleBody: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: perPage,
    }),
    prisma.contract.count({ where }),
  ]);

  return ok(contracts, { page, per_page: perPage, total });
}

// POST /api/contracts — create a new contract
export async function POST(req: NextRequest) {
  const auth = requireAuth(req, "asset_manager");
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  const { asset_id, contract_type_id, counterparty_name, start_date } = body;
  if (!asset_id) return err("asset_id is required", 422);
  if (!contract_type_id) return err("contract_type_id is required", 422);
  if (!counterparty_name) return err("counterparty_name is required", 422);
  if (!start_date) return err("start_date is required", 422);

  const [asset, contractType] = await Promise.all([
    prisma.asset.findUnique({ where: { id: asset_id } }),
    prisma.contractType.findUnique({ where: { id: contract_type_id } }),
  ]);
  if (!asset) return err("Asset not found", 404);
  if (!contractType) return err("ContractType not found", 404);

  if (body.counterparty_type) {
    const valid = Object.values(CounterpartyType);
    if (!valid.includes(body.counterparty_type as CounterpartyType)) {
      return err(`Invalid counterparty_type. Must be one of: ${valid.join(", ")}`, 422);
    }
  }

  // Auto-generate contract_reference if not provided
  let contractReference = body.contract_reference ?? null;
  if (!contractReference) {
    const year = new Date().getFullYear();
    const count = await prisma.contract.count();
    contractReference = `CTR-${year}-${String(count + 1).padStart(5, "0")}`;
  }

  const contract = await prisma.contract.create({
    data: {
      assetId: asset_id,
      contractTypeId: contract_type_id,
      contractReference,
      counterpartyName: counterparty_name,
      counterpartyType: body.counterparty_type ?? "other",
      responsibleBodyId: body.responsible_body_id ?? null,
      startDate: new Date(start_date),
      endDate: body.end_date ? new Date(body.end_date) : null,
      noticePeriodDays: body.notice_period_days ?? null,
      renewalOption: body.renewal_option ?? false,
      autoRenewal: body.auto_renewal ?? false,
      contractValue: body.contract_value ?? null,
      periodicAmount: body.periodic_amount ?? null,
      paymentFrequency: body.payment_frequency ?? null,
      slaDescription: body.sla_description ?? null,
      status: body.status ?? "draft",
      notes: body.notes ?? null,
    },
    include: {
      contractType: true,
      asset: { select: { id: true, assetName: true, assetCode: true } },
    },
  });

  return ok(contract, undefined, 201);
}
