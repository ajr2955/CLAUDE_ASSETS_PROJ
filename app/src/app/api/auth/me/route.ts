import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { getUserFromRequest } from "@/lib/auth";

// GET /api/auth/me
export async function GET(req: NextRequest) {
  const caller = getUserFromRequest(req);
  if (!caller) return err("Unauthorized", 401);

  const user = await prisma.user.findUnique({
    where: { id: caller.sub },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      responsibleBodyId: true,
      responsibleBody: { select: { id: true, name: true } },
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user || !user.isActive) return err("User not found", 404);

  return ok(user);
}
