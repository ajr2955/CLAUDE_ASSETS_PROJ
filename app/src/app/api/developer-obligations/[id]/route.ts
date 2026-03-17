import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";
import { DeveloperObligationStatus, DeveloperObligationFundingModel } from "@/generated/prisma/client";

const INCLUDE = {
  promisedAssetFamily: true,
  promisedAssetType: true,
  receivingBody: true,
  planningEntity: {
    select: { id: true, name: true, planningCode: true, status: true, linkedAssetId: true },
  },
};

// GET /api/developer-obligations/:id
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const obligation = await prisma.developerObligation.findUnique({ where: { id }, include: INCLUDE });
  if (!obligation) return NextResponse.json(err("Not found"), { status: 404 });

  return NextResponse.json(ok(obligation));
}

// PUT /api/developer-obligations/:id
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req, "planner");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = await prisma.developerObligation.findUnique({
    where: { id },
    include: { planningEntity: { select: { linkedAssetId: true } } },
  });
  if (!existing) return NextResponse.json(err("Not found"), { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err("Invalid JSON body"), { status: 400 });
  }

  if (body.status !== undefined && !Object.values(DeveloperObligationStatus).includes(body.status as DeveloperObligationStatus)) {
    return NextResponse.json(err("Invalid status value"), { status: 422 });
  }
  if (body.funding_model !== undefined && body.funding_model !== null &&
    !Object.values(DeveloperObligationFundingModel).includes(body.funding_model as DeveloperObligationFundingModel)) {
    return NextResponse.json(err("Invalid funding_model value"), { status: 422 });
  }

  const updated = await prisma.developerObligation.update({
    where: { id },
    data: {
      ...(typeof body.related_project_name === "string" && { relatedProjectName: body.related_project_name }),
      ...(typeof body.developer_name === "string" && { developerName: body.developer_name }),
      ...(body.committed_area_sqm != null && { committedAreaSqm: Number(body.committed_area_sqm) }),
      ...(typeof body.committed_delivery_date === "string" && { committedDeliveryDate: new Date(body.committed_delivery_date) }),
      ...(typeof body.actual_delivery_date === "string" && { actualDeliveryDate: new Date(body.actual_delivery_date) }),
      ...(body.funding_model !== undefined && { fundingModel: body.funding_model as DeveloperObligationFundingModel | null }),
      ...(body.committed_funding_amount != null && { committedFundingAmount: Number(body.committed_funding_amount) }),
      ...(body.status !== undefined && { status: body.status as DeveloperObligationStatus }),
      ...(typeof body.gaps_identified === "string" && { gapsIdentified: body.gaps_identified }),
      ...(body.receiving_body_id !== undefined && { receivingBodyId: body.receiving_body_id as string | null }),
      ...(body.receiving_body_is_placeholder !== undefined && { receivingBodyIsPlaceholder: body.receiving_body_is_placeholder === true }),
      ...(body.planning_entity_id !== undefined && { planningEntityId: body.planning_entity_id as string | null }),
      ...(body.delivery_milestones != null && { deliveryMilestones: body.delivery_milestones as object }),
      ...(typeof body.notes === "string" && { notes: body.notes }),
    },
    include: INCLUDE,
  });

  // Auto-governance events
  const governanceEvents: Promise<unknown>[] = [];

  // If actual_delivery_date differs from committed by > 30 days and there's a linked asset
  const linkedAssetId = existing.planningEntity?.linkedAssetId;
  if (typeof body.actual_delivery_date === "string" && existing.committedDeliveryDate && linkedAssetId) {
    const actualDate = new Date(body.actual_delivery_date);
    const committedDate = new Date(existing.committedDeliveryDate);
    const diffDays = Math.abs((actualDate.getTime() - committedDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 30) {
      const eventType = await prisma.eventType.findFirst({ where: { name: "overdue_milestone_flagged" } });
      if (eventType) {
        governanceEvents.push(
          prisma.event.create({
            data: {
              eventTypeId: eventType.id,
              assetId: linkedAssetId,
              isSystemGenerated: true,
              description: `Developer obligation "${existing.obligationReference}" delivery is more than 30 days from committed date`,
              metadata: {
                obligation_id: id,
                committed_delivery_date: existing.committedDeliveryDate,
                actual_delivery_date: body.actual_delivery_date,
                diff_days: Math.round(diffDays),
              },
            },
          })
        );
      }
    }
  }

  // If gaps_identified is newly populated and there's a linked asset
  if (typeof body.gaps_identified === "string" && body.gaps_identified.trim() && linkedAssetId) {
    const eventType = await prisma.eventType.findFirst({ where: { name: "asset_at_risk_flagged" } });
    if (eventType) {
      governanceEvents.push(
        prisma.event.create({
          data: {
            eventTypeId: eventType.id,
            assetId: linkedAssetId,
            isSystemGenerated: true,
            description: `Developer obligation gap identified: ${body.gaps_identified}`,
            metadata: { obligation_id: id, gaps_identified: body.gaps_identified },
          },
        })
      );
    }
  }

  await Promise.all(governanceEvents);

  return NextResponse.json(ok(updated));
}
