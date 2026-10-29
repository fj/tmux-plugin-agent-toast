export function moveSelection(ids: readonly string[], selected: string | undefined, step: number): string | undefined {
  const index = selected === undefined ? -1 : ids.indexOf(selected)

  if (ids.length === 0) return undefined
  if (index === -1) return step > 0 ? ids[0] : ids.at(-1)
  return ids[(((index + step) % ids.length) + ids.length) % ids.length]
}
