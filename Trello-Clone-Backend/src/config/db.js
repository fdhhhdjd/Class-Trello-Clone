import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function dbHealthy() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
