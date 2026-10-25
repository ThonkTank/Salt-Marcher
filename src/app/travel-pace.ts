/** D&D travel pace: movement in feet / 10 gives miles per hour. */
export function partyTravelPace(
  members: readonly { id: string; profile: { name: string; speedFeet?: number } }[],
) {
  const basis = members
    .map((c) => ({ id: c.id, feet: c.profile.speedFeet ?? 30 }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const feet = basis.length ? Math.min(...basis.map((c) => c.feet)) : 0;
  return {
    feet,
    kmh: (feet / 10) * 1.609344,
    basis,
    missing: members.filter((c) => c.profile.speedFeet === undefined).map((c) => c.profile.name),
  };
}
