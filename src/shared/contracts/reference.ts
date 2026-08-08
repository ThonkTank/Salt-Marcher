import { z } from 'zod'
import { creatureSchema } from './creature.js'

export const referenceDefinitionKindSchema = z.enum([
  'rule',
  'condition',
  'spell',
  'item',
  'ability',
  'action'
])

export const creaturePartKindSchema = z.enum([
  'trait',
  'action',
  'legendary-action'
])

export const referenceTargetSchema = z.discriminatedUnion('scope', [
  z
    .object({
      scope: z.literal('srd'),
      catalogId: z.literal('srd-5.1'),
      definitionKind: referenceDefinitionKindSchema,
      definitionId: z.string().min(1).max(300)
    })
    .strict(),
  z
    .object({
      scope: z.literal('creature'),
      creatureId: z.string().min(1).max(300)
    })
    .strict(),
  z
    .object({
      scope: z.literal('creature-part'),
      creatureId: z.string().min(1).max(300),
      partKind: creaturePartKindSchema,
      partId: z.string().min(1).max(300)
    })
    .strict(),
  z
    .object({
      scope: z.literal('campaign'),
      campaignId: z.string().min(1).max(100),
      entityKind: z.enum(['location', 'faction']),
      entityId: z.string().min(1).max(100)
    })
    .strict()
])

export const referenceCandidateSchema = z
  .object({
    target: referenceTargetSchema,
    title: z.string().min(1).max(300)
  })
  .strict()

export const referenceTermSchema = z
  .object({
    term: z.string().min(1).max(300),
    matchMode: z.enum(['folded', 'exact']),
    candidates: z.array(referenceCandidateSchema).min(1).max(1_000)
  })
  .strict()

export const referenceIndexSchema = z
  .object({
    scope: z.enum(['static', 'campaign']),
    revision: z.string().min(1).max(500),
    terms: z.array(referenceTermSchema).max(10_000)
  })
  .strict()

export const referenceSourceSchema = z
  .object({
    title: z.string().min(1).max(300),
    version: z.string().min(1).max(100),
    url: z.url(),
    attribution: z.string().min(1).max(2_000)
  })
  .strict()

const referenceTextInlineSchema = z
  .object({ kind: z.literal('text'), text: z.string().max(50_000) })
  .strict()
const referenceLinkInlineSchema = z
  .object({
    kind: z.literal('reference'),
    text: z.string().min(1).max(300),
    candidates: z.array(referenceCandidateSchema).min(1).max(1_000)
  })
  .strict()

export const referenceInlineSchema = z.discriminatedUnion('kind', [
  referenceTextInlineSchema,
  referenceLinkInlineSchema
])

const inlineListSchema = z.array(referenceInlineSchema).max(2_000)

export const referenceBlockSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('heading'),
      level: z.number().int().min(2).max(4),
      inlines: inlineListSchema
    })
    .strict(),
  z
    .object({ kind: z.literal('paragraph'), inlines: inlineListSchema })
    .strict(),
  z
    .object({
      kind: z.literal('list'),
      ordered: z.boolean(),
      items: z.array(inlineListSchema).max(1_000)
    })
    .strict(),
  z
    .object({
      kind: z.literal('table'),
      columns: z.array(z.string().max(300)).max(100),
      rows: z.array(z.array(inlineListSchema).max(100)).max(1_000)
    })
    .strict()
])

export const referenceFactSchema = z
  .object({
    label: z.string().min(1).max(100),
    value: inlineListSchema
  })
  .strict()

const articleDocumentSchema = z
  .object({
    documentKind: z.literal('article'),
    target: referenceTargetSchema,
    title: z.string().min(1).max(300),
    facts: z.array(referenceFactSchema).max(200),
    blocks: z.array(referenceBlockSchema).max(5_000),
    source: referenceSourceSchema.nullable()
  })
  .strict()

const creatureDocumentSchema = z
  .object({
    documentKind: z.literal('creature'),
    target: z
      .object({
        scope: z.literal('creature'),
        creatureId: z.string().min(1).max(300)
      })
      .strict(),
    title: z.string().min(1).max(300),
    source: referenceSourceSchema,
    creature: creatureSchema
  })
  .strict()

export const referenceDocumentSchema = z
  .discriminatedUnion('documentKind', [
    articleDocumentSchema,
    creatureDocumentSchema
  ])
  .superRefine((document, context) => {
    if (
      document.documentKind === 'article' &&
      document.target.scope === 'creature'
    )
      context.addIssue({
        code: 'custom',
        message: 'Creature targets require a creature document',
        path: ['target']
      })
  })

export const referenceCampaignIndexInputSchema = z
  .object({ campaignId: z.string().min(1).max(100) })
  .strict()

export const referenceIndexChangeNoticeSchema = z
  .object({
    campaignId: z.string().min(1).max(100),
    revision: z.string().min(1).max(500),
    changedTargets: z.array(referenceTargetSchema).max(10_000)
  })
  .strict()

export type ReferenceDefinitionKind = z.infer<
  typeof referenceDefinitionKindSchema
>
export type CreaturePartKind = z.infer<typeof creaturePartKindSchema>
export type ReferenceTarget = Readonly<z.infer<typeof referenceTargetSchema>>
export type ReferenceCandidate = Readonly<
  z.infer<typeof referenceCandidateSchema>
>
export type ReferenceTerm = Readonly<z.infer<typeof referenceTermSchema>>
export type ReferenceIndex = Readonly<z.infer<typeof referenceIndexSchema>>
export type ReferenceInline = Readonly<z.infer<typeof referenceInlineSchema>>
export type ReferenceBlock = Readonly<z.infer<typeof referenceBlockSchema>>
export type ReferenceFact = Readonly<z.infer<typeof referenceFactSchema>>
export type ReferenceDocument = Readonly<
  z.infer<typeof referenceDocumentSchema>
>
export type ReferenceIndexChangeNotice = Readonly<
  z.infer<typeof referenceIndexChangeNoticeSchema>
>
