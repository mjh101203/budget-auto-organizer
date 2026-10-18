export type Role = 'student-rne' | 'student-club' | 'teacher'

export const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'student-rne', label: '학생 · 김민준 (R&E 3팀)' },
  { value: 'student-club', label: '학생 · 한도윤 (로봇공학 동아리)' },
  { value: 'teacher', label: '교사 · 최윤서' },
]

export function teamIdForRole(role: Role): string | undefined {
  if (role === 'student-rne') return 'rne-3'
  if (role === 'student-club') return 'club-robot'
  return undefined
}

export function actorForRole(role: Role): string {
  if (role === 'student-rne') return '김민준'
  if (role === 'student-club') return '한도윤'
  return '최윤서'
}
