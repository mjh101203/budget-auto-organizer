import type { AppState } from '../domain/types'
import { createSeedState } from './seed'

const STORAGE_KEY = 'yesan:v1'

function isValidState(value: unknown): value is AppState {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return v.version === 1 && Array.isArray(v.teams) && Array.isArray(v.requests) && typeof v.nextSeq === 'number'
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function loadState(): AppState {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw)
      if (isValidState(parsed)) return parsed
    } catch {
      // 손상된 데이터 — 시드로 복구
    }
  }
  const seeded = createSeedState()
  saveState(seeded)
  return seeded
}

export function resetToSeed(): AppState {
  const seeded = createSeedState()
  saveState(seeded)
  return seeded
}
