import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

// GET /api/assets/:id — full asset detail
export async function GET(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      assetFamily: true,
      assetType: true,
      currentLifecycleStage: true,
      strategicOwnerBody: { select: { id: true, name: true, bodyType: true, isPlaceholder: true } },
      responsibleBody: { select: { id: true, name: true, bodyType: true, isPlaceholder: true } },
      operationalBody: { select: { id: true, name: true, bodyType: true, isPlaceholder: true } },
      maintenanceBody: { select: { id: true, name: true, bodyType: true, isPlaceholder: true } },
      dataStewardBody: { select: { id: true, name: true, bodyType: true, isPlaceholder: true } },
      budgetEnvelopes: {
        where: { isClosed: false },
        include: { lifecycleStage: { select: { id: true, name: true } } },
      },
      events: {
        orderBy: { occurredAt: "desc" },
        take: 10,
        include: {
          eventType: { select: { id: true, name: true, category: true } },
          responsibleBody: { select: { id: true, name: true } },
        },
      },
      parentAsset: { select: { id: true, assetCode: true, assetName: true } },
      childAssets: { select: { id: true, assetCode: true, assetName: true, currentStatus: true } },
      _count: { select: { events: true } },
    },
  });

  if (!asset) return err("Asset not found", 404);

  // Document count by type
  const docCounts = await prisma.document.groupBy({
    by: ["documentTypeId"],
    where: { attachedToEntityType: "asset", attachedToEntityId: id, isDeleted: false },
    _count: { id: true },
  });
  const docTypeIds = docCounts.map((d) => d.documentTypeId);
  const docTypes = docTypeIds.length
    ? await prisma.documentType.findMany({ where: { id: { in: docTypeIds } }, select: { id: true, name: true } })
    : [];
  const docTypeMap = Object.fromEntries(docTypes.map((dt) => [dt.id, dt.name]));
  const documentCounts = docCounts.map((d) => ({
    document_type_id: d.documentTypeId,
    document_type_name: docTypeMap[d.documentTypeId] ?? null,
    count: d._count.id,
  }));

  return ok({ ...asset, document_counts: documentCounts });
}

// PUT /api/assets/:id — update asset fields (operations_manager+)
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req, "operations_manager");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  const existing = await prisma.asset.findUnique({ where: { id } });
  if (!existing) return err("Asset not found", 404);

  // Block direct lifecycle stage update
  if (body.current_lifecycle_stage_id !== undefined) {
    return err(
      "current_lifecycle_stage_id cannot be updated directly. Use the /transition endpoint.",
      422
    );
  }

  // Build update data (only allow explicit non-computed fields)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};

  if (body.asset_name !== undefined) data.assetName = String(body.asset_name).trim();
  if (body.ownership_model !== undefined) data.ownershipModel = body.ownership_model;
  if (body.strategic_owner_body_id !== undefined) data.strategicOwnerBodyId = body.strategic_owner_body_id;
  if (body.responsible_body_id !== undefined) data.responsibleBodyId = body.responsible_body_id;
  if (body.operational_body_id !== undefined) data.operationalBodyId = body.operational_body_id;
  if (body.maintenance_body_id !== undefined) data.maintenanceBodyId = body.maintenance_body_id;
  if (body.data_steward_body_id !== undefined) data.dataStewardBodyId = body.data_steward_body_id;
  if (body.parent_asset_id !== undefined) data.parentAssetId = body.parent_asset_id;
  if (body.current_status !== undefined) data.currentStatus = body.current_status;
  if (body.gis_reference !== undefined) data.gisReference = body.gis_reference;
  if (body.address !== undefined) data.address = body.address;
  if (body.area_sqm !== undefined) data.areaSqm = body.area_sqm;
  if (body.service_start_date !== undefined) {
    data.serviceStartDate = body.service_start_date ? new Date(body.service_start_date) : null;
  }
  if (body.handover_date !== undefined) {
    data.handoverDate = body.handover_date ? new Date(body.handover_date) : null;
  }
  if (body.decommission_date !== undefined) {
    data.decommissionDate = body.decommission_date ? new Date(body.decommission_date) : null;
  }
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.is_placeholder_body !== undefined) data.isPlaceholderBody = Boolean(body.is_placeholder_body);
  if (body.active_budget_envelope_id !== undefined) data.activeBudgetEnvelopeId = body.active_budget_envelope_id;

  if (Object.keys(data).length === 0) return err("No updatable fields provided", 422);

  const updated = await prisma.asset.update({
    where: { id },
    data,
    include: {
      assetFamily: { select: { id: true, name: true } },
      assetType: { select: { id: true, name: true } },
      currentLifecycleStage: { select: { id: true, name: true, displayOrder: true } },
    },
  });

  return ok(updated);
}
