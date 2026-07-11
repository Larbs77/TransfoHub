/**
 * Reset the admin password against the configured PostgreSQL database.
 *
 * Usage:
 *   npx tsx scripts/update-password.ts
 *   npx tsx scripts/update-password.ts "NewPassword1!"
 *
 * Requires DATABASE_URL in .env
 */
import { createPrismaClient } from "../lib/create-prisma";
import bcrypt from "bcryptjs";

async function main() {
  const newPassword = process.argv[2] ?? "ChangeMe1!";
  const prisma = createPrismaClient();

  try {
    const users = await prisma.user.findMany({
      select: { username: true, role: true },
    });
    console.log(
      `Found ${users.length} user(s):`,
      users.map((u) => u.username).join(", ") || "(none)"
    );

    const hash = await bcrypt.hash(newPassword, 12);
    const result = await prisma.user.updateMany({
      where: { username: "admin" },
      data: {
        password_hash: hash,
        must_change_pwd: false,
        failed_attempts: 0,
        locked_until: null,
        is_active: true,
      },
    });

    if (result.count === 0) {
      console.error('No user with username "admin" found. Run: npm run db:seed');
      process.exitCode = 1;
      return;
    }

    console.log(`Updated admin password (${result.count} row(s)).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
