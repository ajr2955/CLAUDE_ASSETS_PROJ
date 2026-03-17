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
  developerObligations: true,
};

// GET /api/planning-entities/:id
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const entity = await prisma.planningEntity.findUnique({ where: { id }, include: INCLUDE });
  if (!entity) return NextResponse.json(err("Not found"), { status: 404 });

  return NextResponse.json(ok(entity));
}

// PUT /api/planning-entities/:id
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req, "planner");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = await prisma.planningEntity.findUnique({ where: { id } });
  if (!existing) return NextResponse.json(err("Not found"), { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err("Invalid JSON body"), { status: 400 });
  }

  // Validate status if provided
  if (body.status !== undefined && !Object.values(PlanningEntityStatus).includes(body.status as PlanningEntityStatus)) {
    return NextResponse.json(err("Invalid status value"), { status: 422 });
  }

  // Cannot manually set status to converted_to_asset — use the convert-to-asset endpoint
  if (body.status === PlanningEntityStatus.converted_to_asset) {
    return NextResponse.json(err("Use POST /convert-to-asset to convert a planning entity to an asset"), { status: 422 });
  }

  const updated = await prisma.planningEntity.update({
    where: { id },
    data: {
      ...(typeof body.name === "string" && { name: body.name.trim() }),
      ...(body.planning_body_id !== undefined && { planningBodyId: body.planning_body_id as string | null }),
      ...(body.intended_receiving_body_id !== undefined && { intendedReceivingBodyId: body.intended_receiving_body_id as string | null }),
      ...(body.intended_receiving_body_is_placeholder !== undefined && { intendedReceivingBodyIsPlaceholder: body.intended_receiving_body_is_placeholder === true }),
      ...(typeof body.population_forecast_notes === "string" && { populationForecastNotes: body.population_forecast_notes }),
      ...(typeof body.service_area_description === "string" && { serviceAreaDescription: body.service_area_description }),
      ...(body.planned_area_sqm != null && { plannedAreaSqm: Number(body.planned_area_sqm) }),
      ...(typeof body.target_delivery_date === "string" && { targetDeliveryDate: new Date(body.target_delivery_date) }),
      ...(typeof body.current_planning_milestone === "string" && { currentPlanningMilestone: body.current_planning_milestone }),
      ...(body.status !== undefined && { status: body.status as PlanningEntityStatus }),
      ...(body.developer_obligation_id !== undefined && { developerObligationId: body.developer_obligation_id as string | null }),
      ...(typeof body.funding_source_notes === "string" && { fundingSourceNotes: body.funding_source_notes }),
      ...(typeof body.notes === "string" && { notes: body.notes }),
    },
    include: INCLUDE,
  });

  return NextResponse.json(ok(updated));
}
