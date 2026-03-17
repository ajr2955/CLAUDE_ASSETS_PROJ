import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";
import { PlanningEntityStatus, AssetStatus } from "@/generated/prisma/client";

// POST /api/planning-entities/:id/convert-to-asset
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req, "planner");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const entity = await prisma.planningEntity.findUnique({
    where: { id },
    include: { assetFamily: true, assetType: true },
  });
  if (!entity) return NextResponse.json(err("Planning entity not found"), { status: 404 });

  if (entity.status === PlanningEntityStatus.converted_to_asset) {
    return NextResponse.json(err("This planning entity has already been converted to an asset"), { status: 422 });
  }

  // Find "Establishment / Implementation / Intake" lifecycle stage
  const targetStage = await prisma.lifecycleStage.findFirst({
    where: { name: { contains: "Establishment" } },
    orderBy: { displayOrder: "asc" },
  });
  if (!targetStage) return NextResponse.json(err("Lifecycle stage 'Establishment / Implementation / Intake' not found"), { status: 500 });

  // Auto-generate asset_code
  const familyName = entity.assetFamily.name;
  const prefixMap: Record<string, string> = {
    "Public Buildings": "PB",
    "Educational Buildings": "EB",
    "Facilities": "FAC",
    "Public Gardens": "PG",
    "Trees": "TRE",
    "Sports Fields and Sports Facilities": "SF",
    "Real Estate / Lease / Allocation Assets": "RE",
    "Assets in Formation": "AIF",
    "Community / Health Assets from Developer Obligations": "CHA",
  };
  const prefix = prefixMap[familyName] ?? familyName.substring(0, 3).toUpperCase();
  const year = new Date().getFullYear();
  const count = await prisma.asset.count({ where: { assetCode: { startsWith: `${prefix}-${year}-` } } });
  const assetCode = `${prefix}-${year}-${String(count + 1).padStart(5, "0")}`;

  // Find event type "plan_reviewed"
  const planReviewedEventType = await prisma.eventType.findFirst({
    where: { name: "plan_reviewed" },
  });

  // Convert: create asset + update planning entity + create event — all in one transaction
  const [newAsset] = await prisma.$transaction([
    prisma.asset.create({
      data: {
        assetName: entity.name,
        assetCode,
        assetFamilyId: entity.assetFamilyId,
        assetTypeId: entity.assetTypeId,
        currentLifecycleStageId: targetStage.id,
        currentStatus: AssetStatus.in_formation,
        planningEntityId: entity.id,
        ...(entity.planningBodyId && { responsibleBodyId: entity.planningBodyId }),
        ...(entity.intendedReceivingBodyId && { operationalBodyId: entity.intendedReceivingBodyId }),
        ...(entity.plannedAreaSqm && { areaSqm: entity.plannedAreaSqm }),
        ...(entity.targetDeliveryDate && { serviceStartDate: entity.targetDeliveryDate }),
        isPlaceholderBody: entity.intendedReceivingBodyIsPlaceholder,
        notes: entity.notes ?? undefined,
      },
    }),
    ...(planReviewedEventType
      ? [
          prisma.event.create({
            data: {
              eventTypeId: planReviewedEventType.id,
              // assetId will be set below — use updateMany after transaction or set via linked_asset_id approach
              // We'll create it after the transaction since we need the new asset's id
              assetId: "00000000-0000-0000-0000-000000000000", // placeholder, replaced below
              lifecycleStageId: targetStage.id,
              isSystemGenerated: true,
              description: `Planning entity "${entity.name}" (${entity.planningCode}) converted to asset`,
              metadata: {
                planning_entity_id: entity.id,
                planning_code: entity.planningCode,
              },
            },
          }),
        ]
      : []),
  ]);

  // Update planning entity and fix event asset_id in a second transaction
  await prisma.$transaction([
    prisma.planningEntity.update({
      where: { id },
      data: {
        status: PlanningEntityStatus.converted_to_asset,
        linkedAssetId: newAsset.id,
      },
    }),
    ...(planReviewedEventType
      ? [
          prisma.event.updateMany({
            where: {
              assetId: "00000000-0000-0000-0000-000000000000",
              eventTypeId: planReviewedEventType.id,
            },
            data: { assetId: newAsset.id },
          }),
        ]
      : []),
  ]);

  return NextResponse.json(
    ok({
      asset_id: newAsset.id,
      asset_code: newAsset.assetCode,
      planning_entity_id: entity.id,
      message: "Planning entity successfully converted to asset",
    }),
    { status: 201 }
  );
}
