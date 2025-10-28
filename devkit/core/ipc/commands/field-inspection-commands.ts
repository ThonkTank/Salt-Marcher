// devkit/core/ipc/commands/field-inspection-commands.ts
// IPC commands for field state inspection and debugging

import type { App } from 'obsidian';
import { logger } from '../../../../src/app/plugin-logger';

/**
 * Get detailed state of a specific field
 */
export async function getFieldState(app: App, args: string[]): Promise<any> {
  const [fieldId] = args;

  if (!fieldId) {
    throw new Error('Field ID required');
  }

  logger.log(`[IPC-CMD] Getting field state for: ${fieldId}`);

  // Find the modal
  const modal = document.querySelector('.modal.sm-cc-create-modal-host');
  if (!modal) {
    throw new Error('No create modal is open');
  }

  // Find the field container
  const fieldContainer = modal.querySelector(`[data-field-id="${fieldId}"]`);
  if (!fieldContainer) {
    throw new Error(`Field "${fieldId}" not found`);
  }

  // Get field manager instance (if available)
  // @ts-ignore - accessing internal state
  const fieldManager = (window as any).saltMarcherFieldManager;

  const state: any = {
    fieldId,
    exists: true,
    container: {
      classes: Array.from(fieldContainer.classList),
      visible: (fieldContainer as HTMLElement).offsetParent !== null,
      dimensions: {
        width: (fieldContainer as HTMLElement).offsetWidth,
        height: (fieldContainer as HTMLElement).offsetHeight,
      },
    },
  };

  // Get input/value
  const input = fieldContainer.querySelector('input, select, textarea') as HTMLInputElement;
  if (input) {
    state.input = {
      type: input.type,
      value: input.value,
      disabled: input.disabled,
      readonly: input.readOnly,
    };
  }

  // Get chips (for token fields)
  const chipsContainer = fieldContainer.querySelector('.sm-cc-chips');
  if (chipsContainer) {
    const chips = Array.from(chipsContainer.querySelectorAll('.sm-cc-chip'));
    state.chips = chips.map(chip => ({
      text: chip.textContent?.trim(),
      classes: Array.from(chip.classList),
      editable: chip.querySelector('.sm-cc-chip__segment--editable') !== null,
    }));
  }

  // Get field manager data if available
  if (fieldManager && fieldManager.fields) {
    const instance = fieldManager.fields.get(fieldId);
    if (instance) {
      state.fieldManager = {
        hasInstance: true,
        type: instance.spec?.type,
        visible: instance.isVisible,
        value: instance.getValue?.(),
      };
    }
  }

  logger.log(`[IPC-CMD] Field state:`, state);
  return state;
}

/**
 * Dump all field states in current modal
 */
export async function dumpFieldStates(app: App, args: string[]): Promise<any> {
  const [modalType] = args; // optional: creature, spell, etc.

  logger.log(`[IPC-CMD] Dumping all field states for modal: ${modalType || 'current'}`);

  const modal = document.querySelector('.modal.sm-cc-create-modal-host');
  if (!modal) {
    throw new Error('No create modal is open');
  }

  // Find all field containers
  const fieldContainers = modal.querySelectorAll('[data-field-id]');

  const fields: any[] = [];

  for (const container of Array.from(fieldContainers)) {
    const fieldId = container.getAttribute('data-field-id');
    if (!fieldId) continue;

    const field: any = {
      id: fieldId,
      visible: (container as HTMLElement).offsetParent !== null,
    };

    // Get value
    const input = container.querySelector('input, select, textarea') as HTMLInputElement;
    if (input) {
      field.value = input.value;
      field.type = input.type || input.tagName.toLowerCase();
    }

    // Get chips
    const chipsContainer = container.querySelector('.sm-cc-chips');
    if (chipsContainer) {
      const chips = Array.from(chipsContainer.querySelectorAll('.sm-cc-chip'));
      field.chips = chips.map(chip => chip.textContent?.trim());
      field.chipCount = chips.length;
    }

    fields.push(field);
  }

  const result = {
    modalType: modalType || 'unknown',
    fieldCount: fields.length,
    fields: fields,
  };

  logger.log(`[IPC-CMD] Dumped ${fields.length} fields`);
  return result;
}

/**
 * Get current modal data (all field values)
 */
export async function getModalData(app: App, args: string[]): Promise<any> {
  logger.log(`[IPC-CMD] Getting current modal data`);

  // @ts-ignore - accessing internal state
  const modalInstance = (window as any).saltMarcherCurrentModal;

  if (!modalInstance) {
    throw new Error('No modal instance found');
  }

  // @ts-ignore
  const data = modalInstance.getData?.();

  logger.log(`[IPC-CMD] Modal data:`, data);
  return data || {};
}
