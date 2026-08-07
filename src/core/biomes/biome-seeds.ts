import type { BuiltinBiomeId } from '../../shared/contracts/biome.js'

export type BuiltinBiomeSeed = Readonly<{
  id: BuiltinBiomeId
  displayName: string
  color: string
  passable: boolean
  travelCost: number
  aliases: readonly string[]
}>

const seed = (
  id: BuiltinBiomeId,
  displayName: string,
  color: string,
  passable: boolean,
  travelCost: number,
  aliases: readonly string[]
): BuiltinBiomeSeed => ({
  id,
  displayName,
  color,
  passable,
  travelCost,
  aliases
})

export const builtinBiomeSeeds: readonly BuiltinBiomeSeed[] = Object.freeze([
  seed('grassland', 'Grasland', '#7f9b63', true, 1, ['Grassland']),
  seed('desert', 'Wüste', '#c9a86a', true, 2, ['Desert']),
  seed('forest', 'Wald', '#3f704d', true, 4, ['Forest']),
  seed('swamp', 'Sumpf', '#536e62', true, 4, ['Swamp']),
  seed('mountain', 'Gebirge', '#73777a', true, 8, ['Mountain', 'Mountains']),
  seed('water', 'Wasser', '#397aa1', false, 1, ['Water']),
  seed('arctic', 'Arktis', '#b8d8df', true, 4, ['Arctic']),
  seed('coastal', 'Küste', '#4f8f91', true, 2, ['Coastal']),
  seed('hill', 'Hügelland', '#8a845b', true, 2, ['Hill', 'Hills']),
  seed('tundra', 'Tundra', '#9ca79b', true, 2, ['Tundra']),
  seed('ice', 'Eis', '#9fc8d6', true, 4, ['Ice']),
  seed('jungle', 'Dschungel', '#2f6845', true, 4, ['Jungle']),
  seed('cavern', 'Höhlen', '#594b43', true, 4, ['Caves', 'Caverns']),
  seed('underdark', 'Unterreich', '#403c45', true, 4, ['Underdark']),
  seed('lake', 'See', '#4b86a8', false, 1, ['Lake']),
  seed('ocean', 'Ozean', '#285f8f', false, 1, ['Ocean']),
  seed('underwater', 'Unterwasser', '#315b75', false, 1, ['Underwater']),
  seed('volcano', 'Vulkan', '#6f312a', true, 8, ['Volcano']),
  seed('ruin', 'Ruinen', '#766c63', true, 2, ['Ruin', 'Ruins']),
  seed('settlement', 'Siedlung', '#9b7653', true, 1, ['Settlement']),
  seed('urban', 'Stadt', '#81756b', true, 1, ['Urban']),
  seed('sewer', 'Kanalisation', '#4e6651', true, 4, ['Sewer']),
  seed('temple', 'Tempel', '#8a7658', true, 1, ['Temple']),
  seed('tomb', 'Grabstätte', '#63564f', true, 2, ['Tomb']),
  seed('laboratory', 'Labor', '#6d7780', true, 1, ['Laboratory']),
  seed('astral-plane', 'Astralebene', '#6657a6', true, 2, ['Astral Plane']),
  seed('ethereal-plane', 'Ätherebene', '#8c93b8', true, 2, ['Ethereal Plane']),
  seed('feywild', 'Feywild', '#7a4f8d', true, 2, ['Feywild']),
  seed('shadowfell', 'Shadowfell', '#4a4658', true, 2, ['Shadowfell']),
  seed('abyss', 'Abyss', '#3b1d4a', true, 4, ['Abyss']),
  seed('hell', 'Hölle', '#8f3328', true, 4, ['Hell']),
  seed('plane-of-air', 'Ebene der Luft', '#9bb6c5', false, 1, ['Plane Of Air']),
  seed('plane-of-earth', 'Ebene der Erde', '#786247', true, 8, [
    'Plane Of Earth'
  ]),
  seed('plane-of-fire', 'Ebene des Feuers', '#b64b2e', true, 4, [
    'Plane Of Fire'
  ]),
  seed('plane-of-water', 'Ebene des Wassers', '#3f6fa3', false, 1, [
    'Plane Of Water'
  ])
])

export function legacyCreatureBiomeMatches(
  id: string,
  legacyValue: string
): boolean {
  if (legacyValue === 'Any') return true
  return builtinBiomeSeeds.some(
    (biome) => biome.id === id && biome.aliases.includes(legacyValue)
  )
}
