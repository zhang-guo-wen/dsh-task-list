import type { ReactNode } from 'react'

/** Formatting glyphs not provided by the host icon catalog. */
export function EditorIcon({ name }: { name: string }) {
  let artwork: ReactNode
  switch (name) {
    case 'bold': artwork = <path d="M6 3h5a3.5 3.5 0 0 1 0 7H6m0 0h6a3.5 3.5 0 0 1 0 7H6V3" />; break
    case 'italic': artwork = <path d="M9 3h7M4 17h7M12.5 3l-5 14" />; break
    case 'underline': artwork = <path d="M5 3v6a5 5 0 0 0 10 0V3M4 17h12" />; break
    case 'bullet': artwork = <><path d="M7 5h10M7 10h10M7 15h10" /><circle cx="3" cy="5" r=".7" /><circle cx="3" cy="10" r=".7" /><circle cx="3" cy="15" r=".7" /></>; break
    case 'ordered': artwork = <><path d="M8 5h9M8 10h9M8 15h9M3 3v4M2 3h1M2 10c0-2 3-2 3 0 0 1-3 2-3 3h3M2 15h3l-2 2h2" /></>; break
    case 'undo': artwork = <path d="m7 4-4 4 4 4M3 8h8a5 5 0 0 1 0 10" />; break
    case 'redo': artwork = <path d="m13 4 4 4-4 4M17 8H9a5 5 0 0 0 0 10" />; break
    case 'heading': artwork = <path d="M4 4v12M12 4v12M4 10h8M16 10v6M15 11l1-1" />; break
    default: artwork = <path d="M12 4v13M16 4v13M12 4H8a4 4 0 0 0 0 8h4M11 4h7" />
  }
  return <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{artwork}</svg>
}
