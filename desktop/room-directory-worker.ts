import { parentPort, workerData } from 'node:worker_threads';
import Database from 'better-sqlite3';
import { roomDirectoryRows } from '../src/app/storage/room-reads';
import type { RoomDirectoryQuery } from '../src/app/contracts';
const { filename, campaignId, query } = workerData as {
  filename: string;
  campaignId: string;
  query: RoomDirectoryQuery;
};
const db = new Database(filename, { readonly: true, fileMustExist: true });
try {
  parentPort!.postMessage(db.transaction(() => roomDirectoryRows(db, campaignId, query))());
} finally {
  db.close();
}
