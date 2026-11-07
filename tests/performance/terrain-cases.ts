/** Fixed world paths and brush settings; no wall-clock input chooses their geometry. */
export const terrainCases = ["empty-coast", "built-coast"].flatMap((fixture) =>
  [32, 160].flatMap((diameter) =>
    [16, 64].map((segments) => ({
      name: `${fixture}-${diameter}px-${segments}segments`,
      fixture,
      diameter,
      seed: 7,
      points: Array.from({ length: segments + 1 }, (_, i): [number, number] => [
        (i / segments - 0.5) * (segments === 16 ? 160 : 800),
        20 + Math.sin(i * 0.4 + 7) * 60,
      ]),
    })),
  ),
);
export const terrainRecipe = {
  version: 1,
  intervalMs: 16,
  view: "Straßenzug",
  cases: terrainCases,
};
