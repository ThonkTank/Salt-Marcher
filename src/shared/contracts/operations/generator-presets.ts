import {
  assignGeneratorPresetReceiptSchema,
  createGeneratorPresetReceiptSchema,
  deleteGeneratorPresetReceiptSchema,
  generatorPresetAssignInputSchema,
  generatorPresetCommandReceiptInputSchema,
  generatorPresetCommandReceiptSchema,
  generatorPresetCreateInputSchema,
  generatorPresetDeleteInputSchema,
  generatorPresetEditorSnapshotSchema,
  generatorPresetReadEditorInputSchema,
  generatorPresetUpdateInputSchema,
  updateGeneratorPresetReceiptSchema
} from '../generator-presets.js'
import { read, write } from './registry.js'

export const generatorPresetsOperationDefinitions = {
  'generatorPresets.readEditor': read(
    'generator-presets:read-editor',
    generatorPresetReadEditorInputSchema,
    generatorPresetEditorSnapshotSchema
  ),
  'generatorPresets.create': write(
    'generator-presets:create',
    generatorPresetCreateInputSchema,
    createGeneratorPresetReceiptSchema
  ),
  'generatorPresets.update': write(
    'generator-presets:update',
    generatorPresetUpdateInputSchema,
    updateGeneratorPresetReceiptSchema
  ),
  'generatorPresets.delete': write(
    'generator-presets:delete',
    generatorPresetDeleteInputSchema,
    deleteGeneratorPresetReceiptSchema
  ),
  'generatorPresets.assign': write(
    'generator-presets:assign',
    generatorPresetAssignInputSchema,
    assignGeneratorPresetReceiptSchema
  ),
  'generatorPresets.commandReceipt': read(
    'generator-presets:command-receipt',
    generatorPresetCommandReceiptInputSchema,
    generatorPresetCommandReceiptSchema.nullable()
  )
} as const
