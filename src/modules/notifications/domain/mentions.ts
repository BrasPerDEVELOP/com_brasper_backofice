import type { StaffMember } from './notification'
export function mentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const match = /(?:^|\s)@([^@\n]*)$/.exec(text.slice(0, caret))
  return match ? { start: caret - match[1]!.length - 1, query: match[1]!.toLowerCase() } : null
}
export function activeMentionIds(text: string, selected: StaffMember[]): string[] {
  return [
    ...new Set(
      selected.filter((person) => text.includes(`@${person.name}`)).map((person) => person.id)
    )
  ]
}
