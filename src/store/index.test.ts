import { beforeEach, describe, expect, it } from 'vitest'
import { loadState, resetToSeed, saveState } from './index'
import { createSeedState } from './seed'

const STORAGE_KEY = 'yesan:v1'

beforeEach(() => {
  localStorage.clear()
})

describe('loadState', () => {
  it('최초 로드 시 시드를 생성하고 localStorage에 저장한다', () => {
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    const state = loadState()
    expect(state).toEqual(createSeedState())
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
  })

  it('저장된 상태를 변경 후 reload하면 동일한 상태를 복원한다', () => {
    const state = loadState()
    const modified = { ...state, nextSeq: 99 }
    saveState(modified)

    const reloaded = loadState()
    expect(reloaded).toEqual(modified)
    expect(reloaded.nextSeq).toBe(99)
  })

  it('손상된 데이터(JSON 파싱 실패)면 시드로 복구한다', () => {
    localStorage.setItem(STORAGE_KEY, '{이것은 유효한 json이 아님')
    const state = loadState()
    expect(state).toEqual(createSeedState())
  })

  it('손상된 데이터(형태가 AppState가 아님)면 시드로 복구한다', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, teams: 'not-an-array' }))
    const state = loadState()
    expect(state).toEqual(createSeedState())
  })
})

describe('resetToSeed', () => {
  it('저장된 상태를 시드로 되돌리고 localStorage도 갱신한다', () => {
    const state = loadState()
    saveState({ ...state, nextSeq: 42 })
    expect(loadState().nextSeq).toBe(42)

    const reset = resetToSeed()
    expect(reset).toEqual(createSeedState())
    expect(loadState()).toEqual(createSeedState())
  })
})
