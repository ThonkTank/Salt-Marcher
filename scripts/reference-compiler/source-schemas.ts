import { z } from 'zod'

const namedSourceRowSchema = z
  .object({
    index: z.string().min(1),
    name: z.string().min(1),
    desc: z.union([z.string(), z.array(z.string())]).optional()
  })
  .passthrough()
const namedReferenceSchema = z
  .object({ index: z.string().min(1), name: z.string().min(1) })
  .passthrough()
export const monsterActionSchema = z
  .object({ name: z.string().min(1), desc: z.string() })
  .passthrough()
export const monsterSourceSchema = z
  .object({
    index: z.string().min(1),
    name: z.string().min(1),
    size: z.string().min(1),
    type: z.string().min(1),
    subtype: z.string().optional(),
    alignment: z.string(),
    armor_class: z.array(z.object({ value: z.number().int() }).passthrough()),
    hit_points: z.number().int().nonnegative(),
    hit_dice: z.string(),
    speed: z.record(z.string(), z.unknown()),
    strength: z.number().int(),
    dexterity: z.number().int(),
    constitution: z.number().int(),
    intelligence: z.number().int(),
    wisdom: z.number().int(),
    charisma: z.number().int(),
    proficiencies: z.array(
      z
        .object({ value: z.number(), proficiency: namedReferenceSchema })
        .strict()
    ),
    damage_vulnerabilities: z.array(z.string()),
    damage_resistances: z.array(z.string()),
    damage_immunities: z.array(z.string()),
    condition_immunities: z.array(namedReferenceSchema),
    senses: z.record(z.string(), z.unknown()),
    languages: z.string(),
    challenge_rating: z.number().nonnegative(),
    xp: z.number().int().nonnegative(),
    desc: z.string().optional(),
    special_abilities: z.array(monsterActionSchema).optional(),
    actions: z.array(monsterActionSchema).optional(),
    legendary_actions: z.array(monsterActionSchema).optional()
  })
  .passthrough()

export const endpointSchemas = {
  'ability-scores': namedSourceRowSchema.extend({
    full_name: z.string().min(1),
    desc: z.array(z.string())
  }),
  conditions: namedSourceRowSchema.extend({ desc: z.array(z.string()) }),
  equipment: namedSourceRowSchema.extend({
    equipment_category: namedReferenceSchema
  }),
  feats: namedSourceRowSchema.extend({ desc: z.array(z.string()) }),
  features: namedSourceRowSchema.extend({
    level: z.number().int().nonnegative(),
    desc: z.array(z.string())
  }),
  'magic-items': namedSourceRowSchema.extend({
    equipment_category: namedReferenceSchema,
    rarity: z.object({ name: z.string().min(1) }).passthrough(),
    desc: z.array(z.string())
  }),
  'rule-sections': namedSourceRowSchema.extend({ desc: z.string() }),
  rules: namedSourceRowSchema.extend({ desc: z.string() }),
  skills: namedSourceRowSchema.extend({
    desc: z.array(z.string()),
    ability_score: namedReferenceSchema
  }),
  spells: namedSourceRowSchema.extend({
    desc: z.array(z.string()),
    range: z.string(),
    components: z.array(z.string()),
    ritual: z.boolean(),
    duration: z.string(),
    concentration: z.boolean(),
    casting_time: z.string(),
    level: z.number().int().nonnegative(),
    school: namedReferenceSchema
  }),
  traits: namedSourceRowSchema.extend({ desc: z.array(z.string()) }),
  'weapon-properties': namedSourceRowSchema.extend({
    desc: z.array(z.string())
  })
} as const
