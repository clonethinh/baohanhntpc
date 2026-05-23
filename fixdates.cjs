const fs = require('fs');
const db = JSON.parse(fs.readFileSync('api/db.json', 'utf-8'));
let fixed = 0;
db.warranties.forEach(w => {
  if (!w.ngayNhan || String(w.ngayNhan).includes('Invalid')) {
    w.ngayNhan = w.createdAt || new Date().toISOString().slice(0, 19);
    fixed++;
  } else {
    const s = String(w.ngayNhan);
    const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (m) {
      const [, day, month, year, hour, minute] = m;
      w.ngayNhan = hour ? `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}T${hour.padStart(2,'0')}:${minute}:00` : `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
      fixed++;
    }
  }
  if (w.ngayHenTra) {
    const s = String(w.ngayHenTra);
    const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    if (m) {
      w.ngayHenTra = `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    }
  }
  if (w.ngayMua) {
    const s = String(w.ngayMua);
    const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    if (m) {
      w.ngayMua = `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    }
  }
});
fs.writeFileSync('api/db.json', JSON.stringify(db, null, 2), 'utf-8');
console.log('Fixed', fixed, 'records');
