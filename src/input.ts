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
