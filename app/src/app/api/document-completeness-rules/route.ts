import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const family_id = searchParams.get("family_id");
  const type_id = searchParams.get("type_id");
  const stage_id = searchParams.get("stage_id");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { isActive: true };
  if (family_id) where.assetFamilyId = family_id;
  if (type_id) where.assetTypeId = type_id;
  if (stage_id) where.lifecycleStageId = stage_id;

  const rules = await prisma.documentCompletenessRule.findMany({
    where,
    include: {
      assetFamily: { select: { id: true, name: true } },
      assetType: { select: { id: true, name: true } },
      lifecycleStage: { select: { id: true, name: true, displayOrder: true } },
      documentType: { select: { id: true, name: true } },
    },
    orderBy: [
      { lifecycleStage: { displayOrder: "asc" } },
      { documentType: { name: "asc" } },
    ],
  });

  return NextResponse.json(ok(rules));
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err("Invalid JSON"), { status: 400 });
  }

  const { lifecycle_stage_id, document_type_id, asset_family_id, asset_type_id, is_mandatory } = body as Record<string, unknown>;

  if (!lifecycle_stage_id || !document_type_id) {
    return NextResponse.json(err("lifecycle_stage_id and document_type_id are required"), { status: 422 });
  }

  // Validate referenced entities
  const [stage, docType] = await Promise.all([
    prisma.lifecycleStage.findUnique({ where: { id: lifecycle_stage_id as string } }),
    prisma.documentType.findUnique({ where: { id: document_type_id as string } }),
  ]);

  if (!stage) return NextResponse.json(err("Lifecycle stage not found"), { status: 422 });
  if (!docType) return NextResponse.json(err("Document type not found"), { status: 422 });

  if (asset_family_id) {
    const family = await prisma.assetFamily.findUnique({ where: { id: asset_family_id as string } });
    if (!family) return NextResponse.json(err("Asset family not found"), { status: 422 });
  }

  if (asset_type_id) {
    const type = await prisma.assetType.findUnique({ where: { id: asset_type_id as string } });
    if (!type) return NextResponse.json(err("Asset type not found"), { status: 422 });
  }

  const rule = await prisma.documentCompletenessRule.create({
    data: {
      lifecycleStageId: lifecycle_stage_id as string,
      documentTypeId: document_type_id as string,
      assetFamilyId: asset_family_id ? (asset_family_id as string) : null,
      assetTypeId: asset_type_id ? (asset_type_id as string) : null,
      isMandatory: typeof is_mandatory === "boolean" ? is_mandatory : true,
    },
    include: {
      assetFamily: { select: { id: true, name: true } },
      assetType: { select: { id: true, name: true } },
      lifecycleStage: { select: { id: true, name: true } },
      documentType: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(ok(rule), { status: 201 });
}
