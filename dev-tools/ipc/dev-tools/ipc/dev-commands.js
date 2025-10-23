"use strict";
// dev-tools/ipc/dev-commands.ts
// Development command implementations for IPC server
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUIWithConfig = exports.validateUIWithRules = exports.measureUI = exports.navigateToSection = exports.validateUILegacy = exports.debugStepperStyles = exports.validateGridLayout = exports.screenshotModal = void 0;
const plugin_logger_1 = require("../../src/app/plugin-logger");
const measurement_api_1 = require("../ui-measurement/measurement-api");
const validation_engine_1 = require("../ui-measurement/validation-engine");
const dom_utils_1 = require("../ui-measurement/dom-utils");
/**
 * Take screenshot of modal
 */
const screenshotModal = async (app, args) => {
    plugin_logger_1.logger.log('[IPC-CMD] Taking screenshot of modal...');
    const modal = document.querySelector('.sm-cc-create-modal');
    if (!modal) {
        return { success: false, error: 'No modal found' };
    }
    try {
        // Get Electron APIs
        const { remote } = require('electron');
        const fs = require('fs');
        const path = require('path');
        // Capture the current window
        const win = remote.getCurrentWindow();
        const image = await win.webContents.capturePage();
        // Save to vault directory
        const vaultPath = app.vault.adapter.basePath;
        const screenshotPath = path.join(vaultPath, '.obsidian/plugins/salt-marcher/screenshot.png');
        fs.writeFileSync(screenshotPath, image.toPNG());
        plugin_logger_1.logger.log('[IPC-CMD] Screenshot saved to:', screenshotPath);
        return {
            success: true,
            path: screenshotPath,
        };
    }
    catch (error) {
        plugin_logger_1.logger.error('[IPC-CMD] Screenshot failed:', error);
        return { success: false, error: String(error) };
    }
};
exports.screenshotModal = screenshotModal;
/**
 * Validate grid layout of tag editors
 */
const validateGridLayout = async (app, args) => {
    plugin_logger_1.logger.log('[IPC-CMD] Validating grid layout...');
    // Find all tag editor fields in the current modal
    const modal = document.querySelector('.sm-cc-create-modal');
    if (!modal) {
        return { success: false, error: 'No modal found' };
    }
    const tagEditors = modal.querySelectorAll('.sm-cc-setting--token-editor, .sm-cc-setting--structured-token-editor');
    const results = [];
    tagEditors.forEach((editor, index) => {
        const computed = window.getComputedStyle(editor);
        const label = editor.querySelector('.setting-item-info');
        const control = editor.querySelector('.setting-item-control');
        const chips = editor.querySelector('.sm-cc-chips');
        const validation = {
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
        validation.valid = (validation.isGrid &&
            hasTwoColumns &&
            hasTwoRows &&
            validation.gridPositions.label?.row === '1' &&
            validation.gridPositions.label?.column === '1' &&
            validation.gridPositions.control?.row === '1' &&
            validation.gridPositions.control?.column === '2' &&
            validation.gridPositions.chips?.row === '2' &&
            validation.gridPositions.chips?.column === '2');
        results.push(validation);
    });
    plugin_logger_1.logger.log('[IPC-CMD] Grid validation complete:', JSON.stringify(results, null, 2));
    return {
        success: true,
        totalEditors: results.length,
        validEditors: results.filter(r => r.valid).length,
        invalidEditors: results.filter(r => !r.valid).length,
        results,
    };
};
exports.validateGridLayout = validateGridLayout;
/**
 * Debug number stepper styles
 */
const debugStepperStyles = async (app, args) => {
    plugin_logger_1.logger.log('[IPC-CMD] Debugging stepper styles...');
    const modal = document.querySelector('.sm-cc-create-modal');
    if (!modal) {
        return { success: false, error: 'No modal found' };
    }
    const stepper = modal.querySelector('.sm-inline-number input[type="number"]');
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
exports.debugStepperStyles = debugStepperStyles;
/**
 * Validate UI layout (labels and number steppers) - Legacy command, replaced by measureUI
 */
const validateUILegacy = async (app, args) => {
    const [mode] = args;
    plugin_logger_1.logger.log('[IPC-CMD] Validating UI layout (legacy)...', mode || 'all');
    const modal = document.querySelector('.sm-cc-create-modal');
    if (!modal) {
        return { success: false, error: 'No modal found' };
    }
    const result = { success: true };
    // Validate label widths
    if (!mode || mode === 'all' || mode === 'labels') {
        const labels = Array.from(modal.querySelectorAll('.setting-item-info'))
            .filter(label => label.offsetParent); // Only visible labels
        if (labels.length > 0) {
            // Group labels by section
            const labelsBySection = new Map();
            labels.forEach(label => {
                let element = label;
                let sectionTitle = 'unknown';
                while (element && element !== modal) {
                    if (element.classList.contains('sm-cc-card')) {
                        const titleEl = element.querySelector('.sm-cc-card__title');
                        if (titleEl)
                            sectionTitle = titleEl.textContent?.trim() || 'unknown';
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
                labelsBySection.get(sectionTitle).push({ label: labelText, width, minWidth });
            });
            const sections = [];
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
        const steppers = Array.from(modal.querySelectorAll('.sm-inline-number'))
            .filter(stepper => stepper.offsetParent); // Only visible steppers
        if (steppers.length > 0) {
            const stepperResults = [];
            steppers.forEach((stepper, index) => {
                const input = stepper.querySelector('input[type="number"]');
                if (!input)
                    return;
                const width = input.getBoundingClientRect().width;
                const computedWidth = window.getComputedStyle(input).width;
                const value = input.value;
                const min = input.min;
                const max = input.max;
                // Find mirror element for expected width
                const mirror = stepper.querySelector('.sm-cc-number-stepper__mirror');
                let expectedWidth = 0;
                if (mirror && max) {
                    mirror.textContent = max;
                    expectedWidth = mirror.getBoundingClientRect().width + 8; // +8px buffer
                }
                // Find parent label
                let label = 'unknown';
                let element = stepper;
                while (element) {
                    const setting = element.closest('.setting-item');
                    if (setting) {
                        const labelEl = setting.querySelector('.setting-item-info');
                        if (labelEl)
                            label = labelEl.textContent?.trim() || 'unknown';
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
    plugin_logger_1.logger.log('[IPC-CMD] UI validation complete:', JSON.stringify(result, null, 2));
    return result;
};
exports.validateUILegacy = validateUILegacy;
/**
 * Navigate to section in modal
 */
const navigateToSection = async (app, args) => {
    const [sectionId] = args;
    if (!sectionId)
        throw new Error('Section ID required');
    plugin_logger_1.logger.log('[IPC-CMD] Navigating to section:', sectionId);
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
    let targetButton = null;
    buttons.forEach((button) => {
        const buttonText = button.textContent?.trim().toUpperCase();
        const sectionName = sectionId.trim().toUpperCase();
        if (buttonText === sectionName) {
            targetButton = button;
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
    await (0, dom_utils_1.waitForAnimation)(600);
    plugin_logger_1.logger.log('[IPC-CMD] Navigated to section:', sectionId);
    return {
        success: true,
        section: sectionId,
    };
};
exports.navigateToSection = navigateToSection;
/**
 * Generic UI measurement command
 */
const measureUI = async (app, args) => {
    const [selector, ...dimensions] = args;
    if (!selector) {
        return { success: false, error: 'Selector required. Usage: measure-ui <selector> [dimension1] [dimension2] ...' };
    }
    const dims = dimensions.length > 0 ? dimensions : ['width', 'height'];
    plugin_logger_1.logger.log('[IPC-CMD] Measuring UI elements:', { selector, dimensions: dims });
    try {
        const measurements = (0, measurement_api_1.measureElements)({
            selector,
            dimensions: dims,
        });
        if (measurements.length === 0) {
            return { success: false, error: `No elements found matching selector: ${selector}` };
        }
        // Summarize measurements
        const summary = {
            count: measurements.length,
        };
        for (const dim of dims) {
            const values = measurements.map(m => m.dimensions[dim]).filter(v => v !== undefined);
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
    }
    catch (error) {
        plugin_logger_1.logger.error('[IPC-CMD] Measurement failed:', error);
        return { success: false, error: String(error) };
    }
};
exports.measureUI = measureUI;
/**
 * Validate UI with specific rules
 */
const validateUIWithRules = async (app, args) => {
    const rulesJson = args.join(' ');
    if (!rulesJson) {
        return {
            success: false,
            error: 'Rules required. Usage: validate-ui-rule \'[{"name":"...", "selector":"...", ...}]\''
        };
    }
    plugin_logger_1.logger.log('[IPC-CMD] Validating UI with rules...');
    try {
        const rules = JSON.parse(rulesJson);
        const report = (0, validation_engine_1.validateUI)(rules);
        const formatted = (0, validation_engine_1.formatReport)(report);
        plugin_logger_1.logger.log('[IPC-CMD] Validation complete:', formatted);
        return {
            success: report.failedRules === 0,
            report,
            formatted,
        };
    }
    catch (error) {
        plugin_logger_1.logger.error('[IPC-CMD] Validation failed:', error);
        return { success: false, error: String(error) };
    }
};
exports.validateUIWithRules = validateUIWithRules;
/**
 * Validate UI with predefined config file
 */
const validateUIWithConfig = async (app, args) => {
    const [configName] = args;
    if (!configName) {
        return {
            success: false,
            error: 'Config name required. Usage: validate-ui-config <config-name>'
        };
    }
    plugin_logger_1.logger.log('[IPC-CMD] Validating UI with config:', configName);
    try {
        // Load config file (YAML support would be added here)
        // For now, we use hardcoded configs
        const configs = {
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
        const report = (0, validation_engine_1.validateUI)(rules);
        const formatted = (0, validation_engine_1.formatReport)(report);
        plugin_logger_1.logger.log('[IPC-CMD] Validation complete:', formatted);
        return {
            success: report.failedRules === 0,
            config: configName,
            report,
            formatted,
        };
    }
    catch (error) {
        plugin_logger_1.logger.error('[IPC-CMD] Validation failed:', error);
        return { success: false, error: String(error) };
    }
};
exports.validateUIWithConfig = validateUIWithConfig;
