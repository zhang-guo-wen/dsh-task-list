import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TaskCapture } from '../src/client/TaskCapture.tsx'

// Mounting the slot still installs the shortcut in the browser, but its idle
// render must neither expose a button nor reserve toolbar space.
describe('keyboard-only capture rendering', () => {
  it('renders no Save as task button or shortcut badge while idle', () => {
    const create = vi.fn()
    const markup = renderToStaticMarkup(<TaskCapture {...{
      useInput: (select: (state: { draft: string }) => string) => select({ draft: '草稿' }),
      inputActions: { setDraft: vi.fn() },
      create,
      t: (key: string) => key,
    } as Parameters<typeof TaskCapture>[0]} />)

    expect(markup).toBe('')
    expect(create).not.toHaveBeenCalled()
  })
})
