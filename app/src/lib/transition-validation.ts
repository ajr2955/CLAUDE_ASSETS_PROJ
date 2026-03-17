import { prisma } from "@/lib/prisma";

export interface UnmetCondition {
  type: "document" | "event";
  description: string;
  is_blocking: false;
}

export interface TransitionValidationResult {
  is_valid_path: boolean;
  unmet_conditions: UnmetCondition[];
}

/**
 * TransitionValidationService
 *
 * Checks whether an asset meets all conditions for a lifecycle transition.
 * Soft enforcement: is_blocking is always false — no condition ever blocks
 * the transition, only warns.
 */
export async function validateTransition(
  asset_id: string,
  from_stage_id: string,
  to_stage_id: string,
  asset_family_id?: string
): Promise<TransitionValidationResult> {
  // Look for a valid transition path
  const transition = await prisma.lifecycleTransition.findFirst({
    where: {
      fromStageId: from_stage_id,
      toStageId: to_stage_id,
      isActive: true,
      OR: [
        { appliesToFamilyId: asset_family_id ?? null },
        { appliesToFamilyId: null },
      ],
    },
  });

  if (!transition) {
    return { is_valid_path: false, unmet_conditions: [] };
  }

  const unmet_conditions: UnmetCondition[] = [];

  // Check required document types
  const requiredDocTypes = (transition.requiredDocumentTypes as string[] | null) ?? [];
  for (const docTypeName of requiredDocTypes) {
    const docType = await prisma.documentType.findUnique({
      where: { name: docTypeName },
      select: { id: true },
    });
    if (!docType) {
      unmet_conditions.push({
        type: "document",
        description: `Required document type "${docTypeName}" not found in system`,
        is_blocking: false,
      });
      continue;
    }
    const docExists = await prisma.document.findFirst({
      where: {
        attachedToEntityType: "asset",
        attachedToEntityId: asset_id,
        documentTypeId: docType.id,
        isDeleted: false,
      },
      select: { id: true },
    });
    if (!docExists) {
      unmet_conditions.push({
        type: "document",
        description: `Required document "${docTypeName}" is missing`,
        is_blocking: false,
      });
    }
  }

  // Check required event types
  const requiredEvents = (transition.requiredEvents as string[] | null) ?? [];
  for (const eventTypeName of requiredEvents) {
    const eventType = await prisma.eventType.findUnique({
      where: { name: eventTypeName },
      select: { id: true },
    });
    if (!eventType) {
      unmet_conditions.push({
        type: "event",
        description: `Required event type "${eventTypeName}" not found in system`,
        is_blocking: false,
      });
      continue;
    }
    const eventExists = await prisma.event.findFirst({
      where: {
        assetId: asset_id,
        eventTypeId: eventType.id,
      },
      select: { id: true },
    });
    if (!eventExists) {
      unmet_conditions.push({
        type: "event",
        description: `Required event "${eventTypeName}" has not occurred on this asset`,
        is_blocking: false,
      });
    }
  }

  return { is_valid_path: true, unmet_conditions };
}
