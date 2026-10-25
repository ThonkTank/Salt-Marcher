export interface LiveKnowledgeRow {
  note: { title: string; readAloud: string; gmNotes: string };
}

export function findLiveKnowledge<T extends LiveKnowledgeRow>(
  rows: T[],
  query: string,
  limit = 30,
  prioritized: (row: T) => boolean = () => false,
) {
  const needle = query.trim().toLocaleLowerCase('de');
  const ranked = rows
    .map((row, index) => {
      const title = row.note.title.toLocaleLowerCase('de'),
        content = (row.note.readAloud + '\n' + row.note.gmNotes).toLocaleLowerCase('de'),
        rank = !needle
          ? 0
          : title === needle
            ? 0
            : title.startsWith(needle)
              ? 1
              : title.includes(needle)
                ? 2
                : content.includes(needle)
                  ? 3
                  : 4;
      return { row, index, rank, priority: prioritized(row) };
    })
    .filter((entry) => entry.rank < 4)
    .sort(
      (a, b) => a.rank - b.rank || Number(b.priority) - Number(a.priority) || a.index - b.index,
    );
  return { rows: ranked.slice(0, limit).map((entry) => entry.row), total: ranked.length };
}
