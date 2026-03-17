import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { UserRole } from "@/generated/prisma/client";
import { getUserFromRequest } from "@/lib/auth";

// POST /api/auth/register — admin only
export async function POST(req: NextRequest) {
  const caller = getUserFromRequest(req);
  if (!caller || caller.role !== "admin") {
    return err("Forbidden: admin role required", 403);
  }

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON body");

  const { email, name, password, role, responsible_body_id } = body;

  if (!email || typeof email !== "string") return err("email is required", 422);
  if (!password || typeof password !== "string") return err("password is required", 422);
  if (password.length < 8) return err("password must be at least 8 characters", 422);

  const validRoles = Object.values(UserRole);
  if (role && !validRoles.includes(role as UserRole)) {
    return err(`Invalid role. Must be one of: ${validRoles.join(", ")}`, 422);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return err("A user with that email already exists", 409);

  if (responsible_body_id) {
    const body_rec = await prisma.responsibleBody.findUnique({ where: { id: responsible_body_id } });
    if (!body_rec) return err("responsible_body_id not found", 404);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      name: name ?? null,
      passwordHash,
      role: (role as UserRole) ?? UserRole.public,
      responsibleBodyId: responsible_body_id ?? null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      responsibleBodyId: true,
      isActive: true,
      createdAt: true,
    },
  });

  return ok(user, undefined, 201);
}
