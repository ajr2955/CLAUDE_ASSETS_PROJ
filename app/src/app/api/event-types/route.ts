import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";

// GET /api/event-types — returns all active event types
export async function GET(_req: NextRequest) {
  const types = await prisma.eventType.findMany({
    where: { isActive: true },
    select: { id: true, name: true, category: true, description: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return ok(types);
}
