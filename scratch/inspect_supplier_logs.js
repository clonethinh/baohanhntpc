import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

async function main() {
  try {
    const logs = await prisma.supplierLog.findMany();
    console.log(`Found ${logs.length} supplier logs in PostgreSQL:`);
    logs.forEach(l => {
      console.log(`- ID: "${l.id}" | Action: "${l.action}" | SupplierID: "${l.supplierId}" | SupplierName: "${l.supplierName}" | Note: "${l.note}"`);
    });
  } catch (err) {
    console.error("Error inspecting supplier logs:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
