/**
 * Seed script: creates the first admin user.
 * Run with: npx ts-node --skip-project prisma/seed.ts
 * Or: npx tsx prisma/seed.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const prisma = new (PrismaClient as any)() as PrismaClient;

async function main() {
  const email = "admin@assets.local";
  const password = "Admin1234!";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      name: "System Admin",
      passwordHash,
      role: "admin",
      isActive: true,
    },
  });

  console.log(`Created admin user: ${user.email} (id: ${user.id})`);
  console.log(`Password: ${password}`);
}

main()
  .catch(console.error)
  .finally(() => (prisma as any).$disconnect());
