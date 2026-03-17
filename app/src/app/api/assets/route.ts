import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { AssetStatus, OwnershipModel } from "@/generated/prisma/client";
import { requireAuth, requireAnyRole } from "@/lib/rbac";

// Family prefix map for asset_code generation
const FAMILY_PREFIX_MAP: Record<string, string> = {
  "Public Buildings": "PB",
  "Educational Buildings": "EB",
  "Facilities": "FA",
  "Public Gardens": "PG",
  "Trees": "TR",
  "Sports Fields and Sports Facilities": "SF",
  "Real Estate / Lease / Allocation Assets": "RE",
  "Assets in Formation": "AF",
  "Community / Health Assets from Developer Obligations": "CH",
};

async function generateAssetCode(familyName: string): Promise<string> {
  const prefix = FAMILY_PREFIX_MAP[familyName] ?? "AS";
  const year = new Date().getFullYear();
  // Count existing assets with this prefix pattern to get next sequence
  const count = await prisma.asset.count({
    where: { assetCode: { startsWith: `${prefix}-${year}-` } },
  });
  const seq = String(count + 1).padStart(5, "0");
  return `${prefix}-${year}-${seq}`;
}

// GET /api/assets — paginated list with filters
export async function GET(req: NextRequest) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") ?? "25", 10)));
  const skip = (page - 1) * perPage;

  const familyId = searchParams.get("family_id");
  const typeId = searchParams.get("type_id");
  const status = searchParams.get("status") as AssetStatus | null;
  const lifecycleStageId = searchParams.get("lifecycle_stage_id");
  const responsibleBodyId = searchParams.get("responsible_body_id");
  const operationalBodyId = searchParams.get("operational_body_id");
  const ownershipModel = searchParams.get("ownership_model") as OwnershipModel | null;
  const isPlaceholderBody = searchParams.get("is_placeholder_body");
  const search = searchParams.get("search");
  const rootOnly = searchParams.get("root_only");

  // Validate enums if provided
  const validStatuses = ["active", "inactive", "in_formation", "in_construction", "decommissioned", "disposed"];
  if (status && !validStatuses.includes(status)) {
    return err("Invalid status value", 422);
  }
  const validOwnership = ["owned", "leased_in", "leased_out", "allocated", "developer_obligation", "partnership"];
  if (ownershipModel && !validOwnership.includes(ownershipModel)) {
    return err("Invalid ownership_model value", 422);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (familyId) where.assetFamilyId = familyId;
  if (typeId) where.assetTypeId = typeId;
  if (status) where.currentStatus = status;
  if (lifecycleStageId) where.currentLifecycleStageId = lifecycleStageId;
  if (responsibleBodyId) where.responsibleBodyId = responsibleBodyId;
  if (operationalBodyId) where.operationalBodyId = operationalBodyId;
  if (ownershipModel) where.ownershipModel = ownershipModel;
  if (isPlaceholderBody === "true") where.isPlaceholderBody = true;
  if (isPlaceholderBody === "false") where.isPlaceholderBody = false;
  if (rootOnly === "true") where.parentAssetId = null;
  if (search) {
    where.OR = [
      { assetName: { contains: search, mode: "insensitive" } },
      { assetCode: { contains: search, mode: "insensitive" } },
    ];
  }

  const [assets, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { createdAt: "desc" },
      include: {
        assetFamily: { select: { id: true, name: true } },
        assetType: { select: { id: true, name: true } },
        currentLifecycleStage: { select: { id: true, name: true, displayOrder: true } },
        responsibleBody: { select: { id: true, name: true } },
        _count: { select: { events: true } },
      },
    }),
    prisma.asset.count({ where }),
  ]);

  return ok(assets, { page, per_page: perPage, total });
}

// POST /api/assets — create a new asset (asset_manager, planner, or admin)
export async function POST(req: NextRequest) {
  const auth = requireAnyRole(req, ["asset_manager", "planner", "admin"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  const { asset_name, asset_family_id, asset_type_id } = body;

  if (!asset_name || typeof asset_name !== "string" || asset_name.trim().length === 0) {
    return err("asset_name is required", 422);
  }
  if (!asset_family_id || typeof asset_family_id !== "string") {
    return err("asset_family_id is required", 422);
  }
  if (!asset_type_id || typeof asset_type_id !== "string") {
    return err("asset_type_id is required", 422);
  }

  // Verify family and type exist
  const [family, assetType] = await Promise.all([
    prisma.assetFamily.findUnique({ where: { id: asset_family_id } }),
    prisma.assetType.findUnique({ where: { id: asset_type_id } }),
  ]);
  if (!family) return err("asset_family_id references a family that does not exist", 422);
  if (!assetType) return err("asset_type_id references a type that does not exist", 422);
  if (assetType.assetFamilyId !== asset_family_id) {
    return err("asset_type_id does not belong to the specified asset_family_id", 422);
  }

  // Find "Need Identification" lifecycle stage
  const needIdentificationStage = await prisma.lifecycleStage.findFirst({
    where: { name: "Need Identification" },
  });
  if (!needIdentificationStage) {
    return err("Default lifecycle stage 'Need Identification' not found. Ensure seed data is loaded.", 500);
  }

  // Generate or use provided asset_code
  let assetCode: string = body.asset_code;
  if (!assetCode) {
    assetCode = await generateAssetCode(family.name);
  } else {
    // Verify uniqueness if user-provided
    const existing = await prisma.asset.findUnique({ where: { assetCode } });
    if (existing) return err("asset_code already exists", 422);
  }

  // Build optional fields
  const optionalData: Record<string, unknown> = {};
  if (body.ownership_model) optionalData.ownershipModel = body.ownership_model;
  if (body.strategic_owner_body_id) optionalData.strategicOwnerBodyId = body.strategic_owner_body_id;
  if (body.responsible_body_id) optionalData.responsibleBodyId = body.responsible_body_id;
  if (body.operational_body_id) optionalData.operationalBodyId = body.operational_body_id;
  if (body.maintenance_body_id) optionalData.maintenanceBodyId = body.maintenance_body_id;
  if (body.data_steward_body_id) optionalData.dataStewardBodyId = body.data_steward_body_id;
  if (body.parent_asset_id) optionalData.parentAssetId = body.parent_asset_id;
  if (body.gis_reference) optionalData.gisReference = body.gis_reference;
  if (body.address) optionalData.address = body.address;
  if (body.area_sqm != null) optionalData.areaSqm = body.area_sqm;
  if (body.service_start_date) optionalData.serviceStartDate = new Date(body.service_start_date);
  if (body.handover_date) optionalData.handoverDate = new Date(body.handover_date);
  if (body.decommission_date) optionalData.decommissionDate = new Date(body.decommission_date);
  if (body.notes) optionalData.notes = body.notes;
  if (body.is_placeholder_body != null) optionalData.isPlaceholderBody = Boolean(body.is_placeholder_body);

  const asset = await prisma.asset.create({
    data: {
      assetName: asset_name.trim(),
      assetCode,
      assetFamilyId: asset_family_id,
      assetTypeId: asset_type_id,
      currentLifecycleStageId: needIdentificationStage.id,
      currentStatus: "in_formation",
      ...optionalData,
    },
    include: {
      assetFamily: { select: { id: true, name: true } },
      assetType: { select: { id: true, name: true } },
      currentLifecycleStage: { select: { id: true, name: true, displayOrder: true } },
    },
  });

  return ok(asset, undefined, 201);
}
