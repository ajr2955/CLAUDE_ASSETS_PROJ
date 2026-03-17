import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

// PUT /api/lifecycle-transitions/:id — updates required_document_types, required_events, warning_message, is_active (admin only)
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req, "admin");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  const existing = await prisma.lifecycleTransition.findUnique({ where: { id } });
  if (!existing) return err("Lifecycle transition not found", 404);

  const updated = await prisma.lifecycleTransition.update({
    where: { id },
    data: {
      ...(body.required_document_types !== undefined && {
        requiredDocumentTypes: body.required_document_types,
      }),
      ...(body.required_events !== undefined && {
        requiredEvents: body.required_events,
      }),
      ...(body.warning_message !== undefined && {
        warningMessage: String(body.warning_message).trim(),
      }),
      ...(body.is_active !== undefined && {
        isActive: Boolean(body.is_active),
      }),
    },
    include: {
      fromStage: { select: { id: true, name: true } },
      toStage: { select: { id: true, name: true } },
      appliesToFamily: { select: { id: true, name: true } },
    },
  });

  return ok(updated);
}
