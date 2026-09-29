import { describe, expect, it } from 'vitest'
import { DERIVED_TITLE_LENGTH, deriveTaskTitle } from '../src/client/task-title.ts'

describe('task title fallback', () => {
  it('keeps an explicit title and trims it', () => {
    expect(deriveTaskTitle('  Write docs  ', 'ignored')).toBe('Write docs')
  })

  it('derives the first characters of the description when no title is typed', () => {
    const notes = 'Fix the sidebar so long workspace names stop pushing the launch button off the row'
    expect(deriveTaskTitle('   ', notes)).toBe(notes.slice(0, DERIVED_TITLE_LENGTH))
    expect(deriveTaskTitle('', notes)).toHaveLength(DERIVED_TITLE_LENGTH)
  })

  it('collapses whitespace runs before slicing', () => {
    expect(deriveTaskTitle('', '  Ship   the\n\nrelease  ')).toBe('Ship the release')
  })

  it('returns an empty string when the description is blank too', () => {
    expect(deriveTaskTitle('', '   \n  ')).toBe('')
  })

  it('counts code points so a sliced emoji stays whole', () => {
    const derived = deriveTaskTitle('', `${'🙂'.repeat(60)}tail`)
    expect(derived).toBe('🙂'.repeat(DERIVED_TITLE_LENGTH))
  })
})
