import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth, requireAnyRole } from "@/lib/rbac";
import { HandoverStatus } from "@/generated/prisma/client";

const handoverRecordInclude = {
  asset: { select: { id: true, assetName: true, assetCode: true } },
  deliveredByBody: { select: { id: true, name: true } },
  receivedByBody: { select: { id: true, name: true } },
};

// GET /api/handover-records — list handover records with optional filters
export async function GET(req: NextRequest) {
  const auth = requireAnyRole(req, [
    "department_user",
    "operations_manager",
    "planner",
    "asset_manager",
    "admin",
  ]);
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const assetId = sp.get("asset_id");
  const handoverStatusParam = sp.get("handover_status") as HandoverStatus | null;
  const deliveredByBodyId = sp.get("delivered_by_body_id");
  const receivedByBodyId = sp.get("received_by_body_id");

  // Validate enum if provided
  if (
    handoverStatusParam &&
    !Object.values(HandoverStatus).includes(handoverStatusParam)
  ) {
    return err(
      `Invalid handover_status. Must be one of: ${Object.values(HandoverStatus).join(", ")}`,
      422
    );
  }

  const where: Record<string, unknown> = {};
  if (assetId) where.assetId = assetId;
  if (handoverStatusParam) where.handoverStatus = handoverStatusParam;
  if (deliveredByBodyId) where.deliveredByBodyId = deliveredByBodyId;
  if (receivedByBodyId) where.receivedByBodyId = receivedByBodyId;

  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const perPage = Math.min(100, Math.max(1, parseInt(sp.get("per_page") ?? "25", 10)));
  const skip = (page - 1) * perPage;

  const [records, total] = await Promise.all([
    prisma.handoverRecord.findMany({
      where,
      include: handoverRecordInclude,
      orderBy: [{ handoverDate: "desc" }, { createdAt: "desc" }],
      skip,
      take: perPage,
    }),
    prisma.handoverRecord.count({ where }),
  ]);

  return ok(records, { page, per_page: perPage, total });
}

// POST /api/handover-records — create a handover record with status = pending
export async function POST(req: NextRequest) {
  const auth = requireAuth(req, "planner");
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  const {
    asset_id,
    delivered_by_body_id,
    received_by_body_id,
    handover_date,
  } = body;

  if (!asset_id) return err("asset_id is required", 422);
  if (!delivered_by_body_id) return err("delivered_by_body_id is required", 422);
  if (!received_by_body_id) return err("received_by_body_id is required", 422);
  if (!handover_date) return err("handover_date is required", 422);

  // Validate asset exists
  const asset = await prisma.asset.findUnique({ where: { id: asset_id } });
  if (!asset) return err("Asset not found", 404);

  // Validate bodies exist
  const [deliveredBody, receivedBody] = await Promise.all([
    prisma.responsibleBody.findUnique({ where: { id: delivered_by_body_id } }),
    prisma.responsibleBody.findUnique({ where: { id: received_by_body_id } }),
  ]);
  if (!deliveredBody) return err("delivered_by_body not found", 404);
  if (!receivedBody) return err("received_by_body not found", 404);

  // Find the asset_delivered event type
  const deliveredEventType = await prisma.eventType.findUnique({
    where: { name: "asset_delivered" },
  });

  const [handoverRecord] = await prisma.$transaction([
    prisma.handoverRecord.create({
      data: {
        assetId: asset_id,
        deliveredByBodyId: delivered_by_body_id,
        receivedByBodyId: received_by_body_id,
        deliveredByUserId: body.delivered_by_user_id ?? null,
        receivedByUserId: body.received_by_user_id ?? null,
        handoverDate: new Date(handover_date),
        handoverStatus: HandoverStatus.pending,
        defectsList: body.defects_list ?? null,
        missingDocuments: body.missing_documents ?? null,
        acceptedWithConditionsFlag: false,
        conditionsDescription: null,
        warrantyExpiryDate: body.warranty_expiry_date
          ? new Date(body.warranty_expiry_date)
          : null,
        notes: body.notes ?? null,
      },
      include: handoverRecordInclude,
    }),
    ...(deliveredEventType
      ? [
          prisma.event.create({
            data: {
              eventTypeId: deliveredEventType.id,
              assetId: asset_id,
              description: `Asset delivered from ${deliveredBody.name} to ${receivedBody.name}`,
              isSystemGenerated: true,
              metadata: {
                delivered_by_body_id,
                received_by_body_id,
                handover_date,
              },
            },
          }),
        ]
      : []),
  ]);

  return ok(handoverRecord, undefined, 201);
}
