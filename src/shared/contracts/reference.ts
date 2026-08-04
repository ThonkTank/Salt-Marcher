import { z } from 'zod'
import { creatureSchema } from './encounter.js'

export const referenceKindSchema = z.enum([
  'rule',
  'condition',
  'spell',
  'item',
  'ability',
  'action',
  'creature',
  'npc',
  'location',
  'faction'
])

export const referenceTargetSchema = z
  .object({
    kind: referenceKindSchema,
    id: z.string().min(1).max(300),
    sectionId: z.string().min(1).max(300).optional()
  })
  .strict()

export const referenceCandidateSchema = z
  .object({
    target: referenceTargetSchema,
    title: z.string().min(1).max(300),
    context: z.string().max(300).nullable()
  })
  .strict()

export const referenceTermSchema = z
  .object({
    term: z.string().min(1).max(300),
    matchMode: z.enum(['folded', 'exact']),
    candidates: z.array(referenceCandidateSchema).min(1)
  })
  .strict()

export const referenceIndexSchema = z
  .object({
    revision: z.string().min(1).max(500),
    terms: z.array(referenceTermSchema)
  })
  .strict()

export const referenceFactSchema = z
  .object({
    label: z.string().min(1).max(100),
    value: z.string().max(2_000)
  })
  .strict()

export const referenceSectionSchema = z
  .object({
    id: z.string().min(1).max(300),
    title: z.string().max(300),
    paragraphs: z.array(z.string().max(50_000))
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

export const referenceDocumentSchema = z
  .object({
    target: referenceTargetSchema,
    title: z.string().min(1).max(300),
    context: z.string().max(300).nullable(),
    summary: z.string().max(50_000),
    facts: z.array(referenceFactSchema),
    sections: z.array(referenceSectionSchema),
    source: referenceSourceSchema.nullable(),
    creature: creatureSchema.optional()
  })
  .strict()
  .superRefine((document, context) => {
    if (document.target.kind === 'creature' && document.creature === undefined)
      context.addIssue({
        code: 'custom',
        message: 'Creature references require their statblock',
        path: ['creature']
      })
    if (document.target.kind !== 'creature' && document.creature !== undefined)
      context.addIssue({
        code: 'custom',
        message: 'Only creature references may carry a statblock',
        path: ['creature']
      })
  })

export type ReferenceKind = z.infer<typeof referenceKindSchema>
export type ReferenceTarget = Readonly<z.infer<typeof referenceTargetSchema>>
export type ReferenceCandidate = Readonly<
  z.infer<typeof referenceCandidateSchema>
>
export type ReferenceTerm = Readonly<z.infer<typeof referenceTermSchema>>
export type ReferenceIndex = Readonly<z.infer<typeof referenceIndexSchema>>
export type ReferenceFact = Readonly<z.infer<typeof referenceFactSchema>>
export type ReferenceSection = Readonly<z.infer<typeof referenceSectionSchema>>
export type ReferenceDocument = Readonly<
  z.infer<typeof referenceDocumentSchema>
>
