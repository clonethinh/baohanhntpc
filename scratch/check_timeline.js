import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import { buildInternalHistoryTimeline } from '../src/utils/historyTimeline.js';
import { readDb } from '../api/lib/db.js';

const prisma = new PrismaClient();

async function main() {
  try {
    const db = await readDb();
    const w = (db.warranties || []).find(x => x.soChungTu === '23052026NTPC9' && !x.deletedAt);
    
    if (!w) {
      console.error("Could not find ticket 23052026NTPC9 in database!");
      return;
    }

    // Populate supplierLogs as done in the GET /:id API
    const supplierMap = new Map((db.suppliers || []).map(s => [s.id, s]));
    const supplierLogs = (db.supplierLogs || [])
      .filter((x) => x.warrantyId === w.id)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .map(x => ({ ...x, supplierName: supplierMap.get(x.supplierId)?.name || '-' }));

    const warrantyObj = {
      ...w,
      supplierLogs
    };

    console.log(`Warranty: ${w.soChungTu}`);
    console.log(`Supplier Status: ${w.supplierStatus}`);

    const timeline = buildInternalHistoryTimeline(w.history || [], warrantyObj);
    console.log(`\nTimeline Events (${timeline.length}):`);
    timeline.forEach((item, i) => {
      console.log(`[${i + 1}] Title: "${item.title}" | Detail: "${item.detail}" | Time: ${item.time} | Color: ${item.color}`);
    });

  } catch (err) {
    console.error("Error checking timeline:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
