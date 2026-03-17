import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";

interface Milestone {
  milestone_name?: string;
  target_date?: string | null;
  actual_date?: string | null;
  status?: string;
}

// PUT /api/developer-obligations/:id/milestone/:index
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  const auth = requireAuth(req, "planner");
  if (auth instanceof NextResponse) return auth;

  const { id, index } = await params;
  const milestoneIndex = parseInt(index);
  if (isNaN(milestoneIndex) || milestoneIndex < 0) {
    return NextResponse.json(err("Invalid milestone index"), { status: 422 });
  }

  const obligation = await prisma.developerObligation.findUnique({ where: { id } });
  if (!obligation) return NextResponse.json(err("Not found"), { status: 404 });

  const milestones: Milestone[] = Array.isArray(obligation.deliveryMilestones)
    ? (obligation.deliveryMilestones as Milestone[])
    : [];

  if (milestoneIndex >= milestones.length) {
    return NextResponse.json(err(`Milestone index ${milestoneIndex} out of range (${milestones.length} milestones)`), { status: 422 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err("Invalid JSON body"), { status: 400 });
  }

  // Update the specific milestone
  const updatedMilestones = milestones.map((m, i) => {
    if (i === milestoneIndex) {
      return {
        ...m,
        ...(typeof body.actual_date === "string" && { actual_date: body.actual_date }),
        ...(body.actual_date === null && { actual_date: null }),
        ...(typeof body.status === "string" && { status: body.status }),
        ...(typeof body.milestone_name === "string" && { milestone_name: body.milestone_name }),
        ...(typeof body.target_date === "string" && { target_date: body.target_date }),
      };
    }
    return m;
  });

  const updated = await prisma.developerObligation.update({
    where: { id },
    data: { deliveryMilestones: updatedMilestones as object[] },
    include: {
      promisedAssetFamily: true,
      promisedAssetType: true,
      receivingBody: true,
    },
  });

  return NextResponse.json(ok({ obligation: updated, updated_milestone: updatedMilestones[milestoneIndex] }));
}
