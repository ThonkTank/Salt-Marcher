import {
  cancelSessionPreparationResultSchema,
  createSessionPlanInputSchema,
  deleteSessionPlanInputSchema,
  openSessionPlanInputSchema,
  renameSessionPlanInputSchema,
  saveSessionPlanInputSchema,
  sessionPlannerWorkspaceSchema,
  sessionPreparationReceiptInputSchema,
  sessionPreparationReceiptResultSchema,
  startSessionPreparationInputSchema,
  startSessionPreparationResultSchema,
  switchSessionPlanInputSchema
} from '../session-planner.js'
import { none, read, write } from './registry.js'

export const sessionPlannerOperationDefinitions = {
  'sessionPlanner.read': read(
    'session-planner:read',
    none,
    sessionPlannerWorkspaceSchema
  ),
  'sessionPlanner.create': write(
    'session-planner:create',
    createSessionPlanInputSchema,
    sessionPlannerWorkspaceSchema
  ),
  'sessionPlanner.open': write(
    'session-planner:open',
    openSessionPlanInputSchema,
    sessionPlannerWorkspaceSchema
  ),
  'sessionPlanner.switch': write(
    'session-planner:switch',
    switchSessionPlanInputSchema,
    sessionPlannerWorkspaceSchema
  ),
  'sessionPlanner.rename': write(
    'session-planner:rename',
    renameSessionPlanInputSchema,
    sessionPlannerWorkspaceSchema
  ),
  'sessionPlanner.save': write(
    'session-planner:save',
    saveSessionPlanInputSchema,
    sessionPlannerWorkspaceSchema
  ),
  'sessionPlanner.delete': write(
    'session-planner:delete',
    deleteSessionPlanInputSchema,
    sessionPlannerWorkspaceSchema
  ),
  'sessionPlanner.startPreparation': write(
    'session-planner:start-preparation',
    startSessionPreparationInputSchema,
    startSessionPreparationResultSchema
  ),
  'sessionPlanner.preparationReceipt': read(
    'session-planner:preparation-receipt',
    sessionPreparationReceiptInputSchema,
    sessionPreparationReceiptResultSchema
  ),
  'sessionPlanner.cancelPreparation': write(
    'session-planner:cancel-preparation',
    sessionPreparationReceiptInputSchema,
    cancelSessionPreparationResultSchema
  )
} as const
