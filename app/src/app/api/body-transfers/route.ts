import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";
import { BodyTransferType } from "@/generated/prisma/client";

const INCLUDE = {
  asset: { select: { id: true, assetName: true, assetCode: true } },
  fromBody: { select: { id: true, name: true, isPlaceholder: true } },
  toBody: { select: { id: true, name: true, isPlaceholder: true } },
};

// Transfer type → asset field mapping
const TRANSFER_TYPE_TO_ASSET_FIELD: Record<BodyTransferType, string> = {
  strategic_owner: "strategicOwnerBodyId",
  responsible_body: "responsibleBodyId",
  operational_body: "operationalBodyId",
  maintenance_body: "maintenanceBodyId",
  data_steward: "dataStewardBodyId",
};

// GET /api/body-transfers
export async function GET(req: NextRequest) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const assetId = sp.get("asset_id");
  const transferType = sp.get("transfer_type");
  const fromBodyId = sp.get("from_body_id");
  const toBodyId = sp.get("to_body_id");
  const page = Math.max(1, parseInt(sp.get("page") ?? "1"));
  const perPage = Math.min(100, Math.max(1, parseInt(sp.get("per_page") ?? "25")));

  if (transferType && !Object.values(BodyTransferType).includes(transferType as BodyTransferType)) {
    return NextResponse.json(err("Invalid transfer_type value"), { status: 422 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (assetId) where.assetId = assetId;
  if (transferType) where.transferType = transferType as BodyTransferType;
  if (fromBodyId) where.fromBodyId = fromBodyId;
  if (toBodyId) where.toBodyId = toBodyId;

  const [total, transfers] = await Promise.all([
    prisma.bodyTransfer.count({ where }),
    prisma.bodyTransfer.findMany({
      where,
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);

  return NextResponse.json(ok(transfers, { page, per_page: perPage, total }));
}

// POST /api/body-transfers
export async function POST(req: NextRequest) {
  const auth = requireAuth(req, "asset_manager");
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err("Invalid JSON body"), { status: 400 });
  }

  const { asset_id, transfer_type, from_body_id, to_body_id, transfer_date, reason } = body;

  if (!asset_id || typeof asset_id !== "string") return NextResponse.json(err("asset_id is required"), { status: 422 });
  if (!transfer_type || !Object.values(BodyTransferType).includes(transfer_type as BodyTransferType)) {
    return NextResponse.json(err("transfer_type is required and must be valid"), { status: 422 });
  }
  if (!from_body_id || typeof from_body_id !== "string") return NextResponse.json(err("from_body_id is required"), { status: 422 });
  if (!to_body_id || typeof to_body_id !== "string") return NextResponse.json(err("to_body_id is required"), { status: 422 });
  if (!transfer_date || typeof transfer_date !== "string") return NextResponse.json(err("transfer_date is required"), { status: 422 });
  if (!reason || typeof reason !== "string" || !reason.trim()) return NextResponse.json(err("reason is required"), { status: 422 });

  // Validate asset and bodies exist
  const [asset, fromBody, toBody] = await Promise.all([
    prisma.asset.findUnique({ where: { id: asset_id } }),
    prisma.responsibleBody.findUnique({ where: { id: from_body_id } }),
    prisma.responsibleBody.findUnique({ where: { id: to_body_id } }),
  ]);
  if (!asset) return NextResponse.json(err("asset not found"), { status: 422 });
  if (!fromBody) return NextResponse.json(err("from_body not found"), { status: 422 });
  if (!toBody) return NextResponse.json(err("to_body not found"), { status: 422 });

  // Find asset_reassigned event type
  const eventType = await prisma.eventType.findFirst({ where: { name: "asset_reassigned" } });

  // The asset field to update
  const assetFieldKey = TRANSFER_TYPE_TO_ASSET_FIELD[transfer_type as BodyTransferType];

  // Atomically create transfer record + update asset role + create governance event
  const [transfer] = await prisma.$transaction([
    prisma.bodyTransfer.create({
      data: {
        assetId: asset_id,
        transferType: transfer_type as BodyTransferType,
        fromBodyId: from_body_id,
        toBodyId: to_body_id,
        transferDate: new Date(transfer_date),
        reason: reason.trim(),
        authorizedByUserId: typeof body.authorized_by_user_id === "string" ? body.authorized_by_user_id : undefined,
        notes: typeof body.notes === "string" ? body.notes : undefined,
      },
      include: INCLUDE,
    }),
    prisma.asset.update({
      where: { id: asset_id },
      data: { [assetFieldKey]: to_body_id },
    }),
    ...(eventType
      ? [
          prisma.event.create({
            data: {
              eventTypeId: eventType.id,
              assetId: asset_id,
              responsibleBodyId: to_body_id,
              isSystemGenerated: false,
              description: `${String(transfer_type).replace(/_/g, " ")} transferred from "${fromBody.name}" to "${toBody.name}"`,
              metadata: {
                transfer_type,
                from_body_id,
                from_body_name: fromBody.name,
                to_body_id,
                to_body_name: toBody.name,
                reason: reason.trim(),
              },
            },
          }),
        ]
      : []),
  ]);

  // Build response — add warning if toBody is a placeholder
  const responseData = {
    ...transfer,
    ...(toBody.isPlaceholder
      ? { warning: "Target body is a placeholder — organizational ownership not yet resolved" }
      : {}),
  };

  return NextResponse.json(ok(responseData), { status: 201 });
}
