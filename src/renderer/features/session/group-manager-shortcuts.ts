export function groupManagerHistoryShortcut(input: {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  editable: boolean
}): 'undo' | 'redo' | null {
  if ((!input.ctrlKey && !input.metaKey) || input.editable) return null
  const key = input.key.toLowerCase()
  if (key === 'y') return 'redo'
  if (key === 'z') return input.shiftKey ? 'redo' : 'undo'
  return null
}
