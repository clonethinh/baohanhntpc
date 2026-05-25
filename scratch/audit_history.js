import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

function isSupplierNoise(entry) {
  const note = String(entry?.note || '').toLowerCase();
  if (note.includes('supplierlogs:')) return true;
  if (note.includes('xóa 1 dòng lịch sử gửi / nhận ncc')) return true;
  const changes = entry?.changes || {};
  const keys = Object.keys(changes).map((key) => String(key).toLowerCase());
  return keys.length > 0 && keys.every((key) => key.includes('supplierlogs'));
}

async function main() {
  try {
    const warranties = await prisma.warranty.findMany({
      where: { deletedAt: "" }
    });

    console.log(`Auditing ${warranties.length} active warranties for history filtering...`);

    for (const w of warranties) {
      const history = Array.isArray(w.history) ? w.history : [];
      history.forEach((h, index) => {
        if (h.action === 'supplier_returned' || h.action === 'supplier_sent') {
          const noise = isSupplierNoise(h);
          console.log(`Warranty: ${w.soChungTu} | Action: ${h.action} | Note: "${h.note}"`);
          console.log(`  Changes:`, h.changes);
          console.log(`  Is treated as Noise (Filtered out)? -> ${noise ? 'YES (BUG)' : 'NO (OK)'}`);
        }
      });
    }
  } catch (err) {
    console.error("Error auditing:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
