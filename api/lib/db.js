import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', 'db.json');

let writeLock = false;
const readQueue = [];
const writeQueue = [];

function processReadQueue() {
  while (readQueue.length > 0) {
    const { resolve, reject } = readQueue.shift();
    try {
      if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify({ warranties: [], nhanVien: [], suppliers: [], supplierLogs: [] }, null, 2), 'utf-8');
      }
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      resolve(JSON.parse(raw));
    } catch (err) {
      reject(err);
    }
  }
}

function atomicWriteJsonFile(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  const prevPath = `${filePath}.prev`;
  const content = JSON.stringify(data, null, 2);

  if (fs.existsSync(filePath)) {
    try { fs.copyFileSync(filePath, prevPath); } catch (err) { console.warn('[DB] Không tạo được file .prev:', err.message); }
  }

  const fd = fs.openSync(tmpPath, 'w');
  try {
    fs.writeFileSync(fd, content, 'utf-8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmpPath, filePath);
}

function processWriteQueue() {
  if (writeLock || writeQueue.length === 0) return;
  writeLock = true;
  const { data, resolve, reject } = writeQueue.shift();
  try {
    atomicWriteJsonFile(DB_PATH, data);
    resolve();
  } catch (err) {
    reject(err);
  } finally {
    writeLock = false;
    processWriteQueue();
  }
}

function readDb() {
  return new Promise((resolve, reject) => {
    readQueue.push({ resolve, reject });
    processReadQueue();
  });
}

function writeDb(data) {
  return new Promise((resolve, reject) => {
    writeQueue.push({ data, resolve, reject });
    processWriteQueue();
  });
}

async function getCollection(name) {
  const db = await readDb();
  return db[name] || [];
}

async function setCollection(name, data) {
  const db = await readDb();
  db[name] = data;
  await writeDb(db);
}

async function addToCollection(name, item) {
  const db = await readDb();
  if (!db[name]) db[name] = [];
  db[name].push(item);
  await writeDb(db);
  return item;
}

export { readDb, writeDb, getCollection, setCollection, addToCollection, atomicWriteJsonFile, DB_PATH };
