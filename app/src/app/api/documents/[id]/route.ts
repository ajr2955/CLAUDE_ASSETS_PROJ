import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      documentType: { select: { id: true, name: true } },
      lifecycleStage: { select: { id: true, name: true } },
    },
  });

  if (!document || document.isDeleted) {
    return err("Document not found", 404);
  }

  // Build a download URL — in dev this mirrors file_url; in prod this could be a signed S3 URL
  const downloadUrl = document.fileUrl;

  return ok({ ...document, download_url: downloadUrl });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const authDel = requireAuth(req, "operations_manager");
  if (authDel instanceof NextResponse) return authDel;

  const { id } = await params;

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document || document.isDeleted) {
    return err("Document not found", 404);
  }

  // Soft delete — file in storage is retained
  await prisma.document.update({
    where: { id },
    data: { isDeleted: true },
  });

  return ok({ id, deleted: true });
}
