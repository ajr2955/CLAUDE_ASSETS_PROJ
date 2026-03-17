import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";
import { PlanningEntityStatus } from "@/generated/prisma/client";

const INCLUDE = {
  assetFamily: true,
  assetType: true,
  planningBody: true,
  intendedReceivingBody: true,
};

// GET /api/planning-entities
export async function GET(req: NextRequest) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const familyId = sp.get("family_id");
  const typeId = sp.get("type_id");
  const status = sp.get("status");
  const planningBodyId = sp.get("planning_body_id");
  const developerObligationId = sp.get("developer_obligation_id");
  const overdue = sp.get("overdue");
  const page = Math.max(1, parseInt(sp.get("page") ?? "1"));
  const perPage = Math.min(100, Math.max(1, parseInt(sp.get("per_page") ?? "25")));

  // Validate status enum
  if (status && !Object.values(PlanningEntityStatus).includes(status as PlanningEntityStatus)) {
    return NextResponse.json(err("Invalid status value"), { status: 422 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (familyId) where.assetFamilyId = familyId;
  if (typeId) where.assetTypeId = typeId;
  if (status) where.status = status as PlanningEntityStatus;
  if (planningBodyId) where.planningBodyId = planningBodyId;
  if (developerObligationId) where.developerObligationId = developerObligationId;

  if (overdue === "true") {
    where.targetDeliveryDate = { lt: new Date() };
    where.status = { notIn: [PlanningEntityStatus.delivered, PlanningEntityStatus.converted_to_asset] };
  }

  const [total, entities] = await Promise.all([
    prisma.planningEntity.count({ where }),
    prisma.planningEntity.findMany({
      where,
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);

  return NextResponse.json(ok(entities, { page, per_page: perPage, total }));
}

// POST /api/planning-entities
export async function POST(req: NextRequest) {
  const auth = requireAuth(req, "planner");
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err("Invalid JSON body"), { status: 400 });
  }

  const { name, asset_family_id, asset_type_id } = body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json(err("name is required"), { status: 422 });
  }
  if (!asset_family_id || typeof asset_family_id !== "string") {
    return NextResponse.json(err("asset_family_id is required"), { status: 422 });
  }
  if (!asset_type_id || typeof asset_type_id !== "string") {
    return NextResponse.json(err("asset_type_id is required"), { status: 422 });
  }

  // Validate family and type exist
  const [family, assetType] = await Promise.all([
    prisma.assetFamily.findUnique({ where: { id: asset_family_id } }),
    prisma.assetType.findUnique({ where: { id: asset_type_id } }),
  ]);
  if (!family) return NextResponse.json(err("asset_family_id not found"), { status: 422 });
  if (!assetType) return NextResponse.json(err("asset_type_id not found"), { status: 422 });
  if (assetType.assetFamilyId !== asset_family_id) {
    return NextResponse.json(err("asset_type does not belong to the specified family"), { status: 422 });
  }

  // Auto-generate planning_code: PE-YEAR-SEQUENCE
  const year = new Date().getFullYear();
  const count = await prisma.planningEntity.count({
    where: { planningCode: { startsWith: `PE-${year}-` } },
  });
  const planningCode = `PE-${year}-${String(count + 1).padStart(5, "0")}`;

  const entity = await prisma.planningEntity.create({
    data: {
      name: name.trim(),
      planningCode,
      assetFamilyId: asset_family_id,
      assetTypeId: asset_type_id,
      planningBodyId: typeof body.planning_body_id === "string" ? body.planning_body_id : undefined,
      intendedReceivingBodyId: typeof body.intended_receiving_body_id === "string" ? body.intended_receiving_body_id : undefined,
      intendedReceivingBodyIsPlaceholder: body.intended_receiving_body_is_placeholder === true,
      populationForecastNotes: typeof body.population_forecast_notes === "string" ? body.population_forecast_notes : undefined,
      serviceAreaDescription: typeof body.service_area_description === "string" ? body.service_area_description : undefined,
      plannedAreaSqm: body.planned_area_sqm != null ? Number(body.planned_area_sqm) : undefined,
      targetDeliveryDate: typeof body.target_delivery_date === "string" ? new Date(body.target_delivery_date) : undefined,
      currentPlanningMilestone: typeof body.current_planning_milestone === "string" ? body.current_planning_milestone : undefined,
      developerObligationId: typeof body.developer_obligation_id === "string" ? body.developer_obligation_id : undefined,
      fundingSourceNotes: typeof body.funding_source_notes === "string" ? body.funding_source_notes : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    },
    include: INCLUDE,
  });

  return NextResponse.json(ok(entity), { status: 201 });
}
