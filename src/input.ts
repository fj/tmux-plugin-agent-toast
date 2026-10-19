export const ACKNOWLEDGEMENT = 'ok'

const ERASE_KEYS = new Set(['\x7f', '\b'])
const PRINTABLE = /^\P{C}$/u

export function typedAfter(typed: string, keys: string): string {
  let next = typed

  for (const key of keys) {
    if (ERASE_KEYS.has(key)) next = [...next].slice(0, -1).join('')
    else if (PRINTABLE.test(key)) next = [...next, key].slice(-ACKNOWLEDGEMENT.length).join('')
  }

  return next
}

export function isAcknowledged(typed: string): boolean {
  return typed.toLowerCase() === ACKNOWLEDGEMENT
}

function isOnTrack(typed: string): boolean {
  const lower = typed.toLowerCase()

  return [...lower].some((_, i) => ACKNOWLEDGEMENT.startsWith(lower.slice(i)))
}

export function isMistyped(keys: string, typed: string): boolean {
  const pressed = [...keys].filter(key => !ERASE_KEYS.has(key))

  return pressed.length > 0 && (!pressed.every(key => PRINTABLE.test(key)) || !isOnTrack(typed))
}
