export function rawTextOffset(text: string, offset: number) {
  let normalized = 0,
    index = 0;
  while (index < text.length && normalized < offset) {
    if (text[index] === '\r' && text[index + 1] === '\n') index++;
    index++;
    normalized++;
  }
  return index;
}
