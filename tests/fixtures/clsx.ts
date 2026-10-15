// Test-only stand-in for `clsx`, used by tests/build-browser-fixture.mjs.
//
// The Host's ui-primitives sources import `clsx`, and the checked-out Host has
// no installed node_modules, so the fixture bundler could not resolve it: the
// bundle left a bare `clsx` global and the page threw before React mounted.
// This reproduces clsx's documented call signature for the inputs the Host
// components use (strings, arrays, objects, falsy values); it is never bundled
// into `lib/`, which resolves clsx from the running Host exactly as before.
function toClass(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(toClass).filter(Boolean).join(' ')
  if (value && typeof value === 'object') {
    return Object.keys(value).filter(key => value[key]).join(' ')
  }
  return ''
}

export default function clsx(...inputs) {
  return inputs.map(toClass).filter(Boolean).join(' ')
}
