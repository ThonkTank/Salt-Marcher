// devkit/core/ipc/commands/dev-commands.ts
// Development command implementations for IPC server

import { App } from 'obsidian';
import type { CommandHandler } from '../../../../src/app/ipc-server';
import { logger } from '../../../../src/app/plugin-logger';
import { measureElements, measureElementsGrouped } from '../../../validation/measurement-api';
import { validateUI, formatReport, type ValidationRule } from '../../../validation/validation-engine';
import { waitForAnimation } from '../../../validation/dom-utils';

/**
 * Validate grid layout of tag editors
 */
export const validateGridLayout: CommandHandler = async (app: App, args: string[]) => {
  logger.log('[IPC-CMD] Validating grid layout...');

  // Find all tag editor fields in the current modal
  const modal = document.querySelector('.sm-cc-create-modal');
  if (!modal) {
    return { success: false, error: 'No modal found' };
  }

  const tagEditors = modal.querySelectorAll('.sm-cc-setting--token-editor, .sm-cc-setting--structured-token-editor');
  const results: any[] = [];

  tagEditors.forEach((editor, index) => {
    const computed = window.getComputedStyle(editor);
    const label = editor.querySelector('.setting-item-info');
    const control = editor.querySelector('.setting-item-control');
    const chips = editor.querySelector('.sm-cc-chips');

    const validation: any = {
      index,
      fieldLabel: label?.textContent?.trim() || 'unknown',
      isGrid: computed.display === 'grid',
      gridTemplateColumns: computed.gridTemplateColumns,
      gridTemplateRows: computed.gridTemplateRows,
      gap: computed.gap,
      children: {
        hasLabel: !!label,
        hasControl: !!control,
        hasChips: !!chips,
      },
      gridPositions: {},
    };

    // Check grid positions
    if (label) {
      const labelComputed = window.getComputedStyle(label);
      validation.gridPositions.label = {
        row: labelComputed.gridRow,
        column: labelComputed.gridColumn,
      };
    }

    if (control) {
      const controlComputed = window.getComputedStyle(control);
      validation.gridPositions.control = {
        row: controlComputed.gridRow,
        column: controlComputed.gridColumn,
      };
    }

    if (chips) {
      const chipsComputed = window.getComputedStyle(chips);
      validation.gridPositions.chips = {
        row: chipsComputed.gridRow,
        column: chipsComputed.gridColumn,
      };
    }

    // Validate expected layout
    const hasTwoColumns = validation.gridTemplateColumns.split(' ').length === 2;
    const hasTwoRows = validation.gridTemplateRows.split(' ').length === 2;

    validation.valid = (
      validation.isGrid &&
      hasTwoColumns &&
      hasTwoRows &&
      validation.gridPositions.label?.row === '1' &&
      validation.gridPositions.label?.column === '1' &&
      validation.gridPositions.control?.row === '1' &&
      validation.gridPositions.control?.column === '2' &&
      validation.gridPositions.chips?.row === '2' &&
      validation.gridPositions.chips?.column === '2'
    );

    results.push(validation);
  });

  logger.log('[IPC-CMD] Grid validation complete:', JSON.stringify(results, null, 2));

  return {
    success: true,
    totalEditors: results.length,
    validEditors: results.filter(r => r.valid).length,
    invalidEditors: results.filter(r => !r.valid).length,
    results,
  };
};

/**
 * Debug number stepper styles
 */
export const debugStepperStyles: CommandHandler = async (app: App, args: string[]) => {
  logger.log('[IPC-CMD] Debugging stepper styles...');

  const modal = document.querySelector('.sm-cc-create-modal');
  if (!modal) {
    return { success: false, error: 'No modal found' };
  }

  const stepper = modal.querySelector('.sm-inline-number input[type="number"]') as HTMLInputElement;
  if (!stepper) {
    return { success: false, error: 'No stepper found' };
  }

  const computed = window.getComputedStyle(stepper);
  const bbox = stepper.getBoundingClientRect();

  return {
    success: true,
    value: stepper.value,
    styles: {
      width: computed.width,
      minWidth: computed.minWidth,
      maxWidth: computed.maxWidth,
      padding: computed.padding,
      paddingLeft: computed.paddingLeft,
      paddingRight: computed.paddingRight,
      border: computed.border,
      borderWidth: computed.borderWidth,
      fontSize: computed.fontSize,
      fontFamily: computed.fontFamily,
      letterSpacing: computed.letterSpacing,
      boxSizing: computed.boxSizing,
    },
    boundingBox: {
      width: bbox.width,
      height: bbox.height,
    },
  };
};

/**
 * Validate UI layout (labels and number steppers) - Legacy command, replaced by measureUI
 */
export const validateUILegacy: CommandHandler = async (app: App, args: string[]) => {
  const [mode] = args;
  logger.log('[IPC-CMD] Validating UI layout (legacy)...', mode || 'all');

  const modal = document.querySelector('.sm-cc-create-modal');
  if (!modal) {
    return { success: false, error: 'No modal found' };
  }

  const result: any = { success: true };

  // Validate label widths
  if (!mode || mode === 'all' || mode === 'labels') {
    const labels = Array.from(modal.querySelectorAll<HTMLElement>('.setting-item-info'))
      .filter(label => label.offsetParent); // Only visible labels

    if (labels.length > 0) {
      // Group labels by section
      const labelsBySection = new Map<string, Array<{ label: string; width: number; minWidth: string }>>();

      labels.forEach(label => {
        let element: HTMLElement | null = label;
        let sectionTitle = 'unknown';

        while (element && element !== modal) {
          if (element.classList.contains('sm-cc-card')) {
            const titleEl = element.querySelector('.sm-cc-card__title');
            if (titleEl) sectionTitle = titleEl.textContent?.trim() || 'unknown';
            break;
          }
          element = element.parentElement;
        }

        const width = label.getBoundingClientRect().width;
        const minWidth = window.getComputedStyle(label).minWidth;
        const labelText = label.textContent?.trim() || 'unknown';

        if (!labelsBySection.has(sectionTitle)) {
          labelsBySection.set(sectionTitle, []);
        }
        labelsBySection.get(sectionTitle)!.push({ label: labelText, width, minWidth });
      });

      const sections: any[] = [];
      for (const [section, sectionLabels] of labelsBySection.entries()) {
        const widths = sectionLabels.map(l => l.width);
        const maxWidth = Math.max(...widths);
        const minWidth = Math.min(...widths);
        const widthVariance = maxWidth - minWidth;
        const synchronized = widthVariance <= 1;

        sections.push({
          section,
          labelCount: sectionLabels.length,
          synchronized,
          maxWidth,
          minWidth,
          widthVariance,
          labels: sectionLabels,
        });
      }

      result.labels = {
        sections,
        summary: {
          totalSections: sections.length,
          synchronizedSections: sections.filter(r => r.synchronized).length,
          unsynchronizedSections: sections.filter(r => !r.synchronized).length,
        },
      };
    }
  }

  // Validate number stepper widths
  if (!mode || mode === 'all' || mode === 'steppers') {
    const steppers = Array.from(modal.querySelectorAll<HTMLElement>('.sm-inline-number'))
      .filter(stepper => stepper.offsetParent); // Only visible steppers

    if (steppers.length > 0) {
      const stepperResults: any[] = [];

      steppers.forEach((stepper, index) => {
        const input = stepper.querySelector('input[type="number"]') as HTMLInputElement | null;
        if (!input) return;

        const width = input.getBoundingClientRect().width;
        const computedWidth = window.getComputedStyle(input).width;
        const value = input.value;
        const min = input.min;
        const max = input.max;

        // Find mirror element for expected width
        const mirror = stepper.querySelector('.sm-cc-number-stepper__mirror') as HTMLElement | null;
        let expectedWidth = 0;
        if (mirror && max) {
          mirror.textContent = max;
          expectedWidth = mirror.getBoundingClientRect().width + 8; // +8px buffer
        }

        // Find parent label
        let label = 'unknown';
        let element: HTMLElement | null = stepper;
        while (element) {
          const setting = element.closest('.setting-item');
          if (setting) {
            const labelEl = setting.querySelector('.setting-item-info');
            if (labelEl) label = labelEl.textContent?.trim() || 'unknown';
            break;
          }
          element = element.parentElement;
        }

        stepperResults.push({
          index,
          label,
          value,
          min,
          max,
          actualWidth: width,
          computedWidth,
          expectedWidth,
          widthMatch: expectedWidth > 0 ? Math.abs(width - expectedWidth) < 2 : undefined,
        });
      });

      result.steppers = {
        items: stepperResults,
        summary: {
          totalSteppers: stepperResults.length,
          correctlySized: stepperResults.filter(r => r.widthMatch === true).length,
          incorrectlySized: stepperResults.filter(r => r.widthMatch === false).length,
        },
      };
    }
  }

  logger.log('[IPC-CMD] UI validation complete:', JSON.stringify(result, null, 2));
  return result;
};

/**
 * Navigate to section in modal
 */
export const navigateToSection: CommandHandler = async (app: App, args: string[]) => {
  const [sectionId] = args;
  if (!sectionId) throw new Error('Section ID required');

  logger.log('[IPC-CMD] Navigating to section:', sectionId);

  const modal = document.querySelector('.sm-cc-create-modal');
  if (!modal) {
    return { success: false, error: 'No modal found' };
  }

  // Find navigation sidebar
  const sidebar = modal.querySelector('.sm-cc-shell__nav');
  if (!sidebar) {
    return { success: false, error: 'No navigation sidebar found' };
  }

  // Find all navigation buttons
  const buttons = sidebar.querySelectorAll('.sm-cc-shell__nav-button');
  let targetButton: HTMLElement | null = null;

  buttons.forEach((button) => {
    const buttonText = button.textContent?.trim().toUpperCase();
    const sectionName = sectionId.trim().toUpperCase();
    if (buttonText === sectionName) {
      targetButton = button as HTMLElement;
    }
  });

  if (!targetButton) {
    const availableSections = Array.from(buttons).map(b => b.textContent?.trim());
    return {
      success: false,
      error: `Section "${sectionId}" not found`,
      availableSections,
    };
  }

  // Simply trigger the button click - it has the built-in navigation logic
  targetButton.click();

  // Wait for smooth scrolling animation to complete
  await waitForAnimation(600);

  logger.log('[IPC-CMD] Navigated to section:', sectionId);

  return {
    success: true,
    section: sectionId,
  };
};

/**
 * Generic UI measurement command
 */
export const measureUI: CommandHandler = async (app: App, args: string[]) => {
  const [selector, ...dimensions] = args;

  if (!selector) {
    return { success: false, error: 'Selector required. Usage: measure-ui <selector> [dimension1] [dimension2] ...' };
  }

  const dims = dimensions.length > 0 ? dimensions : ['width', 'height'];

  logger.log('[IPC-CMD] Measuring UI elements:', { selector, dimensions: dims });

  try {
    const measurements = measureElements({
      selector,
      dimensions: dims,
    });

    if (measurements.length === 0) {
      return { success: false, error: `No elements found matching selector: ${selector}` };
    }

    // Summarize measurements
    const summary: Record<string, any> = {
      count: measurements.length,
    };

    for (const dim of dims) {
      const values = measurements.map(m => m.dimensions[dim]).filter(v => v !== undefined) as number[];
      if (values.length > 0) {
        summary[dim] = {
          min: Math.min(...values),
          max: Math.max(...values),
          avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2),
          variance: (Math.max(...values) - Math.min(...values)).toFixed(2),
        };
      }
    }

    return {
      success: true,
      selector,
      dimensions: dims,
      summary,
      measurements: measurements.map(m => ({
        dimensions: m.dimensions,
        styles: m.styles,
      })),
    };
  } catch (error) {
    logger.error('[IPC-CMD] Measurement failed:', error);
    return { success: false, error: String(error) };
  }
};

/**
 * Validate UI with specific rules
 */
export const validateUIWithRules: CommandHandler = async (app: App, args: string[]) => {
  const rulesJson = args.join(' ');

  if (!rulesJson) {
    return {
      success: false,
      error: 'Rules required. Usage: validate-ui-rule \'[{"name":"...", "selector":"...", ...}]\''
    };
  }

  logger.log('[IPC-CMD] Validating UI with rules...');

  try {
    const rules: ValidationRule[] = JSON.parse(rulesJson);
    const report = validateUI(rules);
    const formatted = formatReport(report);

    logger.log('[IPC-CMD] Validation complete:', formatted);

    return {
      success: report.failedRules === 0,
      report,
      formatted,
    };
  } catch (error) {
    logger.error('[IPC-CMD] Validation failed:', error);
    return { success: false, error: String(error) };
  }
};

/**
 * Validate UI with predefined config file
 */
export const validateUIWithConfig: CommandHandler = async (app: App, args: string[]) => {
  const [configName] = args;

  if (!configName) {
    return {
      success: false,
      error: 'Config name required. Usage: validate-ui-config <config-name>'
    };
  }

  logger.log('[IPC-CMD] Validating UI with config:', configName);

  try {
    // Load config file (YAML support would be added here)
    // For now, we use hardcoded configs
    const configs: Record<string, ValidationRule[]> = {
      'create-modal-labels': [
        {
          name: 'Single-column label synchronization',
          selector: '.sm-cc-card:not(.sm-cc-card--multi-column) .setting-item-info',
          groupBy: {
            ancestorSelector: '.sm-cc-card',
            extractLabel: '.sm-cc-card__title',
          },
          dimension: 'width',
          expect: 'synchronized',
          tolerance: 1,
        },
      ],
      'create-modal-steppers': [
        {
          name: 'Number stepper minimum width',
          selector: '.sm-inline-number input[type="number"]',
          dimension: 'width',
          expect: 'min',
          value: 30,
        },
      ],
    };

    const rules = configs[configName];
    if (!rules) {
      return {
        success: false,
        error: `Config not found: ${configName}. Available: ${Object.keys(configs).join(', ')}`,
      };
    }

    const report = validateUI(rules);
    const formatted = formatReport(report);

    logger.log('[IPC-CMD] Validation complete:', formatted);

    return {
      success: report.failedRules === 0,
      config: configName,
      report,
      formatted,
    };
  } catch (error) {
    logger.error('[IPC-CMD] Validation failed:', error);
    return { success: false, error: String(error) };
  }
};

/**
 * Click element by selector (for opening dropdowns, triggering interactions)
 */
export const clickElement: CommandHandler = async (app: App, args: string[]) => {
  const [selector, waitTimeStr] = args;

  if (!selector) {
    return {
      success: false,
      error: 'Selector required. Usage: click-element <selector> [wait-ms]'
    };
  }

  const waitTime = waitTimeStr ? parseInt(waitTimeStr, 10) : 300;

  logger.log('[IPC-CMD] Clicking element:', selector);

  const element = document.querySelector(selector);
  if (!element) {
    return {
      success: false,
      error: `Element not found: ${selector}`
    };
  }

  try {
    // Try both click and focus for maximum compatibility
    if (element instanceof HTMLElement) {
      element.click();
      element.focus();
    }

    // Wait for any animations or state changes
    await waitForAnimation(waitTime);

    logger.log('[IPC-CMD] Element clicked:', selector);

    return {
      success: true,
      selector,
      element: {
        tagName: element.tagName,
        classList: Array.from(element.classList),
      },
    };
  } catch (error) {
    logger.error('[IPC-CMD] Click failed:', error);
    return { success: false, error: String(error) };
  }
};

/**
 * Set value of input element by selector
 */
export const setInputValue: CommandHandler = async (app: App, args: string[]) => {
  const [selector, value] = args;

  if (!selector || value === undefined) {
    return {
      success: false,
      error: 'Selector and value required. Usage: set-input-value <selector> <value>'
    };
  }

  logger.log('[IPC-CMD] Setting input value:', { selector, value });

  const element = document.querySelector(selector);
  if (!element) {
    return {
      success: false,
      error: `Element not found: ${selector}`
    };
  }

  if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) {
    return {
      success: false,
      error: `Element is not an input or textarea: ${selector}`
    };
  }

  try {
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));

    logger.log('[IPC-CMD] Input value set:', { selector, value });

    return {
      success: true,
      selector,
      value,
    };
  } catch (error) {
    logger.error('[IPC-CMD] Set input value failed:', error);
    return { success: false, error: String(error) };
  }
};

/**
 * Get current value of a token field by label
 */
export const getTokenFieldValue: CommandHandler = async (app: App, args: string[]) => {
  const [fieldLabel] = args;

  if (!fieldLabel) {
    return {
      success: false,
      error: 'Field label required. Usage: get-token-field <field-label>'
    };
  }

  logger.log('[IPC-CMD] Getting token field value:', { fieldLabel });

  const modal = document.querySelector('.sm-cc-create-modal');
  if (!modal) {
    return { success: false, error: 'No modal found' };
  }

  // Find the setting
  const settings = modal.querySelectorAll('.sm-cc-setting--token-editor');
  let targetSetting: Element | null = null;

  for (const setting of settings) {
    const label = setting.querySelector('.setting-item-info');
    if (label && label.textContent?.trim() === fieldLabel) {
      targetSetting = setting;
      break;
    }
  }

  if (!targetSetting) {
    return { success: false, error: `Field not found: "${fieldLabel}"` };
  }

  // Get chips
  const chips = targetSetting.querySelectorAll('.sm-cc-chip');
  const tokens: any[] = [];

  chips.forEach((chip, index) => {
    const segments = chip.querySelectorAll('.sm-cc-chip__segment');
    const token: any = { _chipIndex: index };

    segments.forEach(segment => {
      const valueEl = segment.querySelector('.sm-cc-chip__value');
      if (valueEl) {
        const text = valueEl.textContent?.trim() || '';

        // Try to determine field type
        if (segment.classList.contains('sm-cc-chip__segment--checkbox')) {
          token._expertiseIcon = text;
          token.expertise = text === '★';
        } else if (segment.classList.contains('sm-cc-chip__segment--text')) {
          if (!token.skill) {
            token.skill = text;
          } else if (!token.value) {
            token.value = text;
          }
        }
      }
    });

    tokens.push(token);
  });

  logger.log('[IPC-CMD] Token field values:', JSON.stringify(tokens, null, 2));

  return {
    success: true,
    fieldLabel,
    tokens,
  };
};

/**
 * Add token to a specific token field by label
 */
export const addTokenToField: CommandHandler = async (app: App, args: string[]) => {
  const [fieldLabel, tokenValue] = args;

  if (!fieldLabel || !tokenValue) {
    return {
      success: false,
      error: 'Field label and token value required. Usage: add-token <field-label> <token-value>'
    };
  }

  logger.log('[IPC-CMD] Adding token to field:', { fieldLabel, tokenValue });

  const modal = document.querySelector('.sm-cc-create-modal');
  if (!modal) {
    return { success: false, error: 'No modal found' };
  }

  // Find all settings
  const settings = modal.querySelectorAll('.sm-cc-setting--token-editor');
  let targetSetting: Element | null = null;

  for (const setting of settings) {
    const label = setting.querySelector('.setting-item-info');
    if (label && label.textContent?.trim() === fieldLabel) {
      targetSetting = setting;
      break;
    }
  }

  if (!targetSetting) {
    const availableLabels = Array.from(settings).map(s =>
      s.querySelector('.setting-item-info')?.textContent?.trim()
    );
    return {
      success: false,
      error: `Field not found: "${fieldLabel}"`,
      availableFields: availableLabels,
    };
  }

  try {
    // Find input and button within this specific setting
    const input = targetSetting.querySelector('input.sm-cc-token-field__input-el') as HTMLInputElement;
    const button = targetSetting.querySelector('button.mod-cta') as HTMLButtonElement;

    if (!input || !button) {
      return {
        success: false,
        error: 'Input or button not found in target field',
      };
    }

    // Set value and trigger events
    input.value = tokenValue;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    // Wait a bit for any suggestion menus
    await waitForAnimation(100);

    // Click the add button
    button.click();

    // Wait for token to be added
    await waitForAnimation(300);

    logger.log('[IPC-CMD] Token added successfully:', { fieldLabel, tokenValue });

    return {
      success: true,
      fieldLabel,
      tokenValue,
    };
  } catch (error) {
    logger.error('[IPC-CMD] Add token failed:', error);
    return { success: false, error: String(error) };
  }
};

/**
 * Toggle a checkbox in a repeating field entry
 */
export const toggleRepeatingCheckbox: CommandHandler = async (app: App, args: string[]) => {
  const [abilityKey] = args;

  if (!abilityKey) {
    return {
      success: false,
      error: 'Ability key required. Usage: toggle-save-checkbox <ability-key> (e.g., "str", "dex")'
    };
  }

  logger.log('[IPC-CMD] Toggling save checkbox for ability:', abilityKey);

  const modal = document.querySelector('.sm-cc-create-modal');
  if (!modal) {
    return { success: false, error: 'No modal found' };
  }

  // Find the abilities repeating field
  const repeatingField = modal.querySelector('.sm-cc-repeating-list');
  if (!repeatingField) {
    return { success: false, error: 'No repeating field found' };
  }

  // Find all entries
  const entries = repeatingField.querySelectorAll('.sm-cc-repeating-item');
  let targetEntry: Element | null = null;

  // Find entry by heading text (ability key in uppercase)
  for (const entry of entries) {
    const heading = entry.querySelector('.sm-cc-field-heading');
    if (heading && heading.textContent?.trim().toUpperCase() === abilityKey.toUpperCase()) {
      targetEntry = entry;
      break;
    }
  }

  if (!targetEntry) {
    const availableKeys = Array.from(entries).map(e =>
      e.querySelector('.sm-cc-field--heading')?.textContent?.trim()
    );
    return {
      success: false,
      error: `Ability not found: "${abilityKey}"`,
      availableAbilities: availableKeys,
    };
  }

  try {
    // Find the save checkbox within this entry
    const checkbox = targetEntry.querySelector('input[type="checkbox"]') as HTMLInputElement;

    if (!checkbox) {
      return {
        success: false,
        error: `Checkbox not found in entry for ability: ${abilityKey}`,
      };
    }

    // Toggle checkbox
    const wasChecked = checkbox.checked;
    checkbox.click();

    // Wait for UI to update
    await waitForAnimation(300);

    logger.log('[IPC-CMD] Checkbox toggled:', { abilityKey, wasChecked, nowChecked: checkbox.checked });

    return {
      success: true,
      abilityKey: abilityKey.toUpperCase(),
      wasChecked,
      nowChecked: checkbox.checked,
    };
  } catch (error) {
    logger.error('[IPC-CMD] Toggle checkbox failed:', error);
    return { success: false, error: String(error) };
  }
};

/**
 * Get values from a repeating field entry
 */
export const getRepeatingEntryValues: CommandHandler = async (app: App, args: string[]) => {
  const [abilityKey] = args;

  if (!abilityKey) {
    return {
      success: false,
      error: 'Ability key required. Usage: get-ability-values <ability-key> (e.g., "str", "dex")'
    };
  }

  logger.log('[IPC-CMD] Getting values for ability:', abilityKey);

  const modal = document.querySelector('.sm-cc-create-modal');
  if (!modal) {
    return { success: false, error: 'No modal found' };
  }

  // Find the abilities repeating field
  const repeatingField = modal.querySelector('.sm-cc-repeating-list');
  if (!repeatingField) {
    return { success: false, error: 'No repeating field found' };
  }

  // Find all entries
  const entries = repeatingField.querySelectorAll('.sm-cc-repeating-item');
  let targetEntry: Element | null = null;

  // Find entry by heading text (ability key in uppercase)
  for (const entry of entries) {
    const heading = entry.querySelector('.sm-cc-field-heading');
    if (heading && heading.textContent?.trim().toUpperCase() === abilityKey.toUpperCase()) {
      targetEntry = entry;
      break;
    }
  }

  if (!targetEntry) {
    return {
      success: false,
      error: `Ability not found: "${abilityKey}"`,
    };
  }

  try {
    const values: Record<string, any> = {
      ability: abilityKey.toUpperCase(),
    };

    // Get score
    const scoreInput = targetEntry.querySelector('input[type="number"]') as HTMLInputElement;
    if (scoreInput) {
      values.score = parseInt(scoreInput.value, 10);
    }

    // Get modifier (display field)
    const modDisplay = targetEntry.querySelectorAll('.sm-cc-display-field')[0] as HTMLInputElement;
    if (modDisplay) {
      values.modifier = modDisplay.value?.trim();
    }

    // Get save checkbox
    const saveCheckbox = targetEntry.querySelector('input[type="checkbox"]') as HTMLInputElement;
    if (saveCheckbox) {
      values.saveProf = saveCheckbox.checked;
    }

    // Get save modifier (number stepper - only visible if checkbox is checked)
    const saveModSteppers = targetEntry.querySelectorAll('input[type="number"]');
    if (saveModSteppers.length > 1) {
      const saveModInput = saveModSteppers[1] as HTMLInputElement;
      values.saveMod = parseInt(saveModInput.value, 10);
    }

    // Get save final (display field - only visible if checkbox is checked)
    const saveFinalDisplay = targetEntry.querySelectorAll('.sm-cc-display-field')[1] as HTMLInputElement;
    if (saveFinalDisplay) {
      values.saveFinal = saveFinalDisplay.value?.trim();
    }

    logger.log('[IPC-CMD] Ability values:', JSON.stringify(values, null, 2));

    return {
      success: true,
      ability: abilityKey.toUpperCase(),
      values,
    };
  } catch (error) {
    logger.error('[IPC-CMD] Get values failed:', error);
    return { success: false, error: String(error) };
  }
};