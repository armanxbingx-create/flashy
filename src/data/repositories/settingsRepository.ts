import { db } from '../db'
import type { Settings } from '../types'
import { DEFAULT_SETTINGS } from '../types'

export const settingsRepository = {
  async get(): Promise<Settings> {
    const existing = await db.settings.get('main')
    return existing ?? { ...DEFAULT_SETTINGS }
  },

  async update(changes: Partial<Pick<Settings, 'theme' | 'hapticsEnabled' | 'soundEnabled' | 'reducedMotion' | 'learningAlgorithm'>>): Promise<void> {
    const current = await this.get()
    await db.settings.put({ ...current, ...changes })
  },

  async reset(): Promise<void> {
    await db.settings.put({ ...DEFAULT_SETTINGS })
  },
}
