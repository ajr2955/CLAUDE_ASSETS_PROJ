import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";
import { DeveloperObligationStatus } from "@/generated/prisma/client";

const INCLUDE = {
  promisedAssetFamily: true,
  promisedAssetType: true,
  receivingBody: true,
  planningEntity: { select: { id: true, name: true, planningCode: true, status: true } },
};

// GET /api/developer-obligations
export async function GET(req: NextRequest) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const developerName = sp.get("developer_name");
  const familyId = sp.get("promised_asset_family_id");
  const overdue = sp.get("overdue");
  const receivingBodyIsPlaceholder = sp.get("receiving_body_is_placeholder");
  const page = Math.max(1, parseInt(sp.get("page") ?? "1"));
  const perPage = Math.min(100, Math.max(1, parseInt(sp.get("per_page") ?? "25")));

  if (status && !Object.values(DeveloperObligationStatus).includes(status as DeveloperObligationStatus)) {
    return NextResponse.json(err("Invalid status value"), { status: 422 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (status) where.status = status as DeveloperObligationStatus;
  if (developerName) where.developerName = { contains: developerName, mode: "insensitive" };
  if (familyId) where.promisedAssetFamilyId = familyId;
  if (receivingBodyIsPlaceholder === "true") where.receivingBodyIsPlaceholder = true;

  if (overdue === "true") {
    where.committedDeliveryDate = { lt: new Date() };
    where.status = {
      notIn: [DeveloperObligationStatus.delivered, DeveloperObligationStatus.closed_gap_identified],
    };
  }

  const [total, obligations] = await Promise.all([
    prisma.developerObligation.count({ where }),
    prisma.developerObligation.findMany({
      where,
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
  ]);

  return NextResponse.json(ok(obligations, { page, per_page: perPage, total }));
}

// POST /api/developer-obligations
export async function POST(req: NextRequest) {
  const auth = requireAuth(req, "planner");
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err("Invalid JSON body"), { status: 400 });
  }

  const { obligation_reference, related_project_name, developer_name, promised_asset_type_id, promised_asset_family_id } = body;
  if (!obligation_reference || typeof obligation_reference !== "string") {
    return NextResponse.json(err("obligation_reference is required"), { status: 422 });
  }
  if (!related_project_name || typeof related_project_name !== "string") {
    return NextResponse.json(err("related_project_name is required"), { status: 422 });
  }
  if (!developer_name || typeof developer_name !== "string") {
    return NextResponse.json(err("developer_name is required"), { status: 422 });
  }
  if (!promised_asset_type_id || typeof promised_asset_type_id !== "string") {
    return NextResponse.json(err("promised_asset_type_id is required"), { status: 422 });
  }
  if (!promised_asset_family_id || typeof promised_asset_family_id !== "string") {
    return NextResponse.json(err("promised_asset_family_id is required"), { status: 422 });
  }

  // Check uniqueness of obligation_reference
  const existing = await prisma.developerObligation.findUnique({
    where: { obligationReference: obligation_reference },
  });
  if (existing) {
    return NextResponse.json(err("obligation_reference already exists"), { status: 422 });
  }

  const obligation = await prisma.developerObligation.create({
    data: {
      obligationReference: obligation_reference,
      relatedProjectName: related_project_name,
      developerName: developer_name,
      promisedAssetTypeId: promised_asset_type_id,
      promisedAssetFamilyId: promised_asset_family_id,
      committedAreaSqm: body.committed_area_sqm != null ? Number(body.committed_area_sqm) : undefined,
      committedDeliveryDate: typeof body.committed_delivery_date === "string" ? new Date(body.committed_delivery_date) : undefined,
      actualDeliveryDate: typeof body.actual_delivery_date === "string" ? new Date(body.actual_delivery_date) : undefined,
      committedFundingAmount: body.committed_funding_amount != null ? Number(body.committed_funding_amount) : undefined,
      receivingBodyId: typeof body.receiving_body_id === "string" ? body.receiving_body_id : undefined,
      receivingBodyIsPlaceholder: body.receiving_body_is_placeholder === true,
      planningEntityId: typeof body.planning_entity_id === "string" ? body.planning_entity_id : undefined,
      deliveryMilestones: body.delivery_milestones != null ? body.delivery_milestones as object : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    },
    include: INCLUDE,
  });

  return NextResponse.json(ok(obligation), { status: 201 });
}
