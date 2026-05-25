import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

async function main() {
  try {
    const warranties = await prisma.warranty.findMany({
      where: {
        deletedAt: ""
      }
    });
    console.log(`Found ${warranties.length} active warranties in database.`);

    for (const w of warranties) {
      console.log(`\n==================================================`);
      console.log(`ID: "${w.id}" | SoChungTu: "${w.soChungTu}"`);
      console.log(`Supplier Status: "${w.supplierStatus}" | Supplier ID: "${w.supplierIdCurrent}"`);
      console.log(`Supplier Logs Local:`, w.supplierLogs);
      console.log(`History:`, w.history);
    }
  } catch (err) {
    console.error("Error inspecting warranties:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
