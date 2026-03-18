/**
 * Seed script: creates the first admin user.
 * Run with: node prisma/seed.mjs
 */
import { createRequire } from "module";
import { createHash } from "crypto";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../.env") });

const require = createRequire(import.meta.url);
const { PrismaClient } = require("../src/generated/prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

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
  console.log(`Login with: ${email} / ${password}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
