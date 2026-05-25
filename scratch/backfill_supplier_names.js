import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Backfilling empty supplierName fields in PostgreSQL...");

    // 1. Fetch all active suppliers to create a map of ID -> Name
    const suppliers = await prisma.supplier.findMany();
    const supplierMap = new Map(suppliers.map(s => [s.id, s.name]));
    console.log(`Loaded ${suppliers.length} suppliers.`);

    // 2. Fetch all supplier logs
    const logs = await prisma.supplierLog.findMany();
    console.log(`Loaded ${logs.length} supplier logs.`);

    let updatedCount = 0;
    for (const log of logs) {
      if (!log.supplierName || log.supplierName.trim() === "") {
        const resolvedName = supplierMap.get(log.supplierId) || 'Nhà cung cấp ẩn';
        console.log(`Log ${log.id}: Backfilling supplier ID "${log.supplierId}" with name "${resolvedName}"...`);
        
        await prisma.supplierLog.update({
          where: { id: log.id },
          data: { supplierName: resolvedName }
        });
        updatedCount++;
      }
    }

    console.log(`\nSuccessfully backfilled ${updatedCount} supplier logs!`);
  } catch (err) {
    console.error("Error backfilling supplier names:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
