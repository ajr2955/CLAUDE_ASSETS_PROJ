import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req, "asset_manager");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document || document.isDeleted) {
    return err("Document not found", 404);
  }
  if (document.isVerified) {
    return err("Document is already verified", 409);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // body is optional for this endpoint
  }

  const verifiedByUserId = body.verified_by_user_id as string | undefined ?? null;

  const updated = await prisma.document.update({
    where: { id },
    data: {
      isVerified: true,
      verifiedByUserId: verifiedByUserId,
      verifiedAt: new Date(),
    },
    include: {
      documentType: { select: { id: true, name: true } },
    },
  });

  return ok(updated);
}
