import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { AttachedEntityType } from "@/generated/prisma/client";
import { requireAuth } from "@/lib/rbac";
import { triggerRiskScoreRecompute } from "@/lib/risk-scoring";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req, "department_user");
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = req.nextUrl;
  const attachedToEntityType = searchParams.get("attached_to_entity_type");
  const attachedToEntityId = searchParams.get("attached_to_entity_id");
  const documentTypeId = searchParams.get("document_type_id");
  const lifecycleStageId = searchParams.get("lifecycle_stage_id");
  const isRequired = searchParams.get("is_required");
  const isVerified = searchParams.get("is_verified");

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") ?? "25")));

  if (
    attachedToEntityType &&
    !Object.values(AttachedEntityType).includes(attachedToEntityType as AttachedEntityType)
  ) {
    return err(`Invalid attached_to_entity_type: ${attachedToEntityType}`, 422);
  }

  const where = {
    isDeleted: false,
    ...(attachedToEntityType
      ? { attachedToEntityType: attachedToEntityType as AttachedEntityType }
      : {}),
    ...(attachedToEntityId ? { attachedToEntityId } : {}),
    ...(documentTypeId ? { documentTypeId } : {}),
    ...(lifecycleStageId ? { lifecycleStageId } : {}),
    ...(isRequired !== null ? { isRequired: isRequired === "true" } : {}),
    ...(isVerified !== null ? { isVerified: isVerified === "true" } : {}),
  };

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      include: {
        documentType: { select: { id: true, name: true } },
        lifecycleStage: { select: { id: true, name: true } },
      },
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { createdAt: "desc" },
    }),
    prisma.document.count({ where }),
  ]);

  return ok(documents, { page, per_page: perPage, total });
}

export async function POST(req: NextRequest) {
  const authPost = requireAuth(req, "contractor");
  if (authPost instanceof NextResponse) return authPost;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return err("Invalid JSON body");
  }

  const {
    document_type_id,
    title,
    file_url,
    attached_to_entity_type,
    attached_to_entity_id,
    description,
    file_name,
    file_size_bytes,
    mime_type,
    lifecycle_stage_id,
    is_required,
    expiry_date,
    uploaded_by_user_id,
  } = body as Record<string, unknown>;

  if (!document_type_id || typeof document_type_id !== "string") {
    return err("document_type_id is required", 422);
  }
  if (!title || typeof title !== "string") {
    return err("title is required", 422);
  }
  if (!file_url || typeof file_url !== "string") {
    return err("file_url is required", 422);
  }
  if (!attached_to_entity_type || typeof attached_to_entity_type !== "string") {
    return err("attached_to_entity_type is required", 422);
  }
  if (
    !Object.values(AttachedEntityType).includes(attached_to_entity_type as AttachedEntityType)
  ) {
    return err(`Invalid attached_to_entity_type: ${attached_to_entity_type}`, 422);
  }
  if (!attached_to_entity_id || typeof attached_to_entity_id !== "string") {
    return err("attached_to_entity_id is required", 422);
  }

  // Verify document type exists
  const docType = await prisma.documentType.findUnique({
    where: { id: document_type_id },
  });
  if (!docType) {
    return err("Document type not found", 404);
  }

  // Verify lifecycle stage if provided
  if (lifecycle_stage_id) {
    const stage = await prisma.lifecycleStage.findUnique({
      where: { id: lifecycle_stage_id as string },
    });
    if (!stage) return err("Lifecycle stage not found", 404);
  }

  const document = await prisma.document.create({
    data: {
      documentTypeId: document_type_id,
      title,
      description: description as string | null ?? null,
      fileUrl: file_url,
      fileName: file_name as string | null ?? null,
      fileSizeBytes: file_size_bytes !== undefined ? Number(file_size_bytes) : null,
      mimeType: mime_type as string | null ?? null,
      attachedToEntityType: attached_to_entity_type as AttachedEntityType,
      attachedToEntityId: attached_to_entity_id,
      uploadedByUserId: uploaded_by_user_id as string | null ?? null,
      lifecycleStageId: lifecycle_stage_id as string | null ?? null,
      isRequired: is_required === true,
      expiryDate: expiry_date ? new Date(expiry_date as string) : null,
    },
    include: {
      documentType: { select: { id: true, name: true } },
      lifecycleStage: { select: { id: true, name: true } },
    },
  });

  // Trigger async risk score recompute when document attached to an asset
  if (attached_to_entity_type === "asset") {
    triggerRiskScoreRecompute(attached_to_entity_id);
  }

  return ok(document, undefined, 201);
}
