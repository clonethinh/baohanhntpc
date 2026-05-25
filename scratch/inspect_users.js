import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import { verifyPassword, hashPassword } from '../api/lib/auth.js';

const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.nhanVien.findMany();
    console.log("Current users in PostgreSQL:");
    users.forEach(u => {
      console.log(`- maNV: "${u.maNV}", tenNV: "${u.tenNV}", quyen: "${u.quyen}", active: ${u.active}`);
      console.log(`  matKhau (hashed): "${u.matKhau}"`);
    });

    const envPassword = process.env.INITIAL_STAFF_PASSWORD || 'IfZvRxLwZ7w7181CnwT4@A1';
    console.log(`\nINITIAL_STAFF_PASSWORD from env: "${envPassword}"`);
    console.log(`Hashed version of env password: "${hashPassword(envPassword)}"`);
  } catch (err) {
    console.error("Error inspecting database:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
