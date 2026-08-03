
import Dexie, { type Table } from 'dexie'
import type { Analysis } from './parser'

export type SavedRun = {
  id?: number; name: string; createdAt: string; metaFile: string; shopeeFile: string; ppn: number; analysis: Analysis
}
class AffDb extends Dexie { runs!: Table<SavedRun, number>; constructor(){ super('afftometa_barry_db'); this.version(1).stores({ runs: '++id, createdAt, name' }) } }
export const db = new AffDb()
export async function saveRun(run: Omit<SavedRun, 'id'|'createdAt'>) { return db.runs.add({ ...run, createdAt: new Date().toISOString() }) }
export async function listRuns() { return db.runs.orderBy('createdAt').reverse().toArray() }
export async function deleteRun(id: number) { return db.runs.delete(id) }
