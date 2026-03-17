import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const existing = await prisma.documentCompletenessRule.findUnique({ where: { id } });
  if (!existing) return NextResponse.json(err("Rule not found"), { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err("Invalid JSON"), { status: 400 });
  }

  const { is_mandatory, is_active, asset_family_id, asset_type_id } = body as Record<string, unknown>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (typeof is_mandatory === "boolean") data.isMandatory = is_mandatory;
  if (typeof is_active === "boolean") data.isActive = is_active;
  if (asset_family_id !== undefined) data.assetFamilyId = asset_family_id ? (asset_family_id as string) : null;
  if (asset_type_id !== undefined) data.assetTypeId = asset_type_id ? (asset_type_id as string) : null;

  const rule = await prisma.documentCompletenessRule.update({
    where: { id },
    data,
    include: {
      assetFamily: { select: { id: true, name: true } },
      assetType: { select: { id: true, name: true } },
      lifecycleStage: { select: { id: true, name: true } },
      documentType: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(ok(rule));
}
