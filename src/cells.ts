const WIDE_RANGES: readonly (readonly [number, number])[] = [
  [0x1100, 0x115f],
  [0x2e80, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe30, 0xfe4f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x1f300, 0x1faff],
  [0x20000, 0x3fffd],
]
const ZERO_WIDTH = /\p{Mn}|\p{Me}|\u200d|\ufe0f/u
const ELLIPSIS = '…'

export function cellWidth(char: string): number {
  const code = char.codePointAt(0) ?? 0

  if (ZERO_WIDTH.test(char)) return 0
  return WIDE_RANGES.some(([low, high]) => code >= low && code <= high) ? 2 : 1
}

export function textWidth(text: string): number {
  return [...text].reduce((sum, char) => sum + cellWidth(char), 0)
}

export function fit(text: string, width: number): string {
  if (textWidth(text) <= width) return text + ' '.repeat(width - textWidth(text))

  let out = ''
  let used = 0
  for (const char of text) {
    if (used + cellWidth(char) > width - 1) break
    out += char
    used += cellWidth(char)
  }

  return out + ELLIPSIS + ' '.repeat(width - 1 - used)
}
