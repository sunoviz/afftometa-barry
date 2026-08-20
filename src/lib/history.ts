import Dexie, { type Table } from 'dexie'
import type { Analysis } from './parser'

export type SavedRun = {
  id?: number
  email: string
  name: string
  createdAt: string
  metaFile: string
  shopeeFile: string
  ppn: number
  analysis: Analysis
}

class AffDb extends Dexie {
  runs!: Table<SavedRun, number>

  constructor() {
    super('afftometa_barry_db')
    this.version(2).stores({ runs: '++id, email, createdAt, name' })
  }
}

export const db = new AffDb()

export async function saveRun(run: Omit<SavedRun, 'id' | 'createdAt'>) {
  return db.runs.add({
    ...run,
    createdAt: new Date().toISOString(),
  })
}

export async function listRuns(email: string) {
  return db.runs.where('email').equalsIgnoreCase(email).reverse().sortBy('createdAt')
}

export async function deleteRun(id: number) {
  return db.runs.delete(id)
}
