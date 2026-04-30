import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

async function run(dbUrl: string) {
  console.log(`Checking DB: ${dbUrl}`);
  const adapter = new PrismaBetterSqlite3({ url: dbUrl });
  const prisma = new PrismaClient({ adapter });

  const users = await prisma.user.findMany({ select: { username: true, role: true } });
  console.log(`  Found ${users.length} users:`, users.map(u => u.username));

  if (users.length > 0) {
    const hash = await bcrypt.hash("123.Pol$", 12);
    const result = await prisma.user.updateMany({
      where: { username: "admin" },
      data: { password_hash: hash, must_change_pwd: false },
    });
    console.log(`  Updated ${result.count} admin user(s)`);
  }

  await prisma.$disconnect();
}

async function main() {
  await run("file:./dev.db");
  await run("file:./prisma/dev.db");
}

main().catch(console.error);
