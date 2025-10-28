#!/usr/bin/env node
// tests/integration/lib/test-generator.mjs
// Automatically generate integration tests from CreateSpec definitions

import * as fs from 'fs/promises';
import * as path from 'path';
import yaml from 'js-yaml';

/**
 * Generate a YAML test from a CreateSpec
 * @param {Object} spec - CreateSpec definition
 * @param {string} entityType - Entity type (creature, spell, etc.)
 * @param {string} testType - Test type (create, edit, validate)
 */
export function generateTestFromSpec(spec, entityType, testType = 'create') {
  const test = {
    name: `Auto-generated ${entityType} ${testType} test`,
    description: `Tests ${entityType} ${testType} workflow based on CreateSpec`,
    debugConfig: {
      enabled: true,
      logFields: ['*'],
      logCategories: ['field-creation', 'onChange', 'init']
    },
    setup: [
      {
        name: 'Reload plugin',
        command: 'reload-plugin',
        wait: 1000
      }
    ],
    steps: [],
    cleanup: [
      {
        name: 'Close modal',
        command: 'close-modal',
        wait: 200
      }
    ]
  };

  // Open modal
  test.steps.push({
    name: `Open ${entityType} editor`,
    command: `edit-${entityType}`,
    args: testType === 'edit' ? ['TestEntity'] : [],
    wait: 500,
    expect: { success: true }
  });

  // Generate steps for each field in spec
  if (spec.fields) {
    const sections = groupFieldsBySection(spec.fields);

    for (const [section, fields] of Object.entries(sections)) {
      // Navigate to section
      if (section !== 'default') {
        test.steps.push({
          name: `Navigate to ${section}`,
          command: 'navigate-to-section',
          args: [section],
          wait: 300
        });
      }

      // Add field interactions
      for (const field of fields) {
        const step = generateFieldStep(field);
        if (step) test.steps.push(step);
      }
    }
  }

  // Add validation
  test.steps.push({
    name: 'Validate UI layout',
    command: 'validate-ui',
    args: ['all'],
    expect: { success: true }
  });

  return test;
}

/**
 * Generate a step for a specific field
 */
function generateFieldStep(field) {
  const fieldId = field.id || field.name;
  const selector = getFieldSelector(field);

  switch (field.type) {
    case 'text':
    case 'number':
      return {
        name: `Set ${field.label || fieldId}`,
        command: 'set-input-value',
        args: [selector, getTestValue(field)],
        wait: 200
      };

    case 'select':
      const options = field.options || field.enum || [];
      if (options.length > 0) {
        return {
          name: `Select ${field.label || fieldId}`,
          command: 'set-input-value',
          args: [selector, options[0].value || options[0]],
          wait: 200
        };
      }
      break;

    case 'checkbox':
    case 'toggle':
      return {
        name: `Toggle ${field.label || fieldId}`,
        command: 'click-element',
        args: [selector],
        wait: 200
      };

    case 'textarea':
      return {
        name: `Set ${field.label || fieldId} description`,
        command: 'set-input-value',
        args: [selector, 'Test description text'],
        wait: 200
      };

    case 'structured-tags':
      return {
        name: `Add token to ${field.label || fieldId}`,
        command: 'add-token',
        args: [fieldId, field.options?.[0] || 'test'],
        wait: 200
      };

    case 'repeating':
      return {
        name: `Add ${field.label || fieldId} entry`,
        command: 'click-element',
        args: ['button.add-repeating-entry'],
        wait: 200
      };
  }

  return null;
}

/**
 * Get the appropriate selector for a field
 */
function getFieldSelector(field) {
  const fieldId = field.id || field.name;
  const inputType = getInputType(field);
  return `${inputType}[data-field-id='${fieldId}']`;
}

/**
 * Get the HTML input type for a field
 */
function getInputType(field) {
  switch (field.type) {
    case 'select':
      return 'select';
    case 'textarea':
      return 'textarea';
    case 'checkbox':
    case 'toggle':
      return 'input[type="checkbox"]';
    default:
      return 'input';
  }
}

/**
 * Generate a test value for a field
 */
function getTestValue(field) {
  switch (field.type) {
    case 'number':
      if (field.min !== undefined) return String(field.min);
      if (field.max !== undefined) return String(Math.floor(field.max / 2));
      return '10';

    case 'text':
      if (field.id === 'name' || field.name === 'name') return 'Test Entity';
      return `Test ${field.label || field.id || 'Value'}`;

    default:
      return 'test-value';
  }
}

/**
 * Group fields by their section
 */
function groupFieldsBySection(fields) {
  const sections = {};

  for (const field of fields) {
    const section = field.section || field.tab || 'default';
    if (!sections[section]) sections[section] = [];
    sections[section].push(field);
  }

  return sections;
}

/**
 * Generate a comprehensive test suite for an entity type
 */
export async function generateTestSuite(spec, entityType, outputDir) {
  const tests = [];

  // Generate create test
  tests.push({
    filename: `${entityType}-create-auto.yaml`,
    content: generateTestFromSpec(spec, entityType, 'create')
  });

  // Generate edit test
  tests.push({
    filename: `${entityType}-edit-auto.yaml`,
    content: generateTestFromSpec(spec, entityType, 'edit')
  });

  // Generate validation test
  tests.push({
    filename: `${entityType}-validate-auto.yaml`,
    content: generateValidationTest(spec, entityType)
  });

  // Write test files
  for (const test of tests) {
    const filepath = path.join(outputDir, test.filename);
    const yamlContent = yaml.dump(test.content, { lineWidth: -1 });
    await fs.writeFile(filepath, yamlContent);
    console.log(`Generated: ${test.filename}`);
  }

  return tests;
}

/**
 * Generate a validation-focused test
 */
function generateValidationTest(spec, entityType) {
  return {
    name: `${entityType} validation test`,
    description: `Validates all field interactions and UI consistency`,
    debugConfig: {
      enabled: true,
      logFields: ['*'],
      logCategories: ['validation', 'update']
    },
    setup: [
      {
        name: 'Reload plugin',
        command: 'reload-plugin',
        wait: 1000
      }
    ],
    steps: [
      {
        name: `Open ${entityType} editor`,
        command: `edit-${entityType}`,
        wait: 500,
        expect: { success: true }
      },
      {
        name: 'Validate initial state',
        command: 'validate-ui',
        args: ['all'],
        expect: { success: true }
      },
      {
        name: 'Validate grid layout',
        command: 'validate-grid-layout',
        expect: { success: true }
      },
      {
        name: 'Validate label synchronization',
        command: 'validate-ui',
        args: ['labels'],
        expect: { success: true }
      },
      {
        name: 'Validate number steppers',
        command: 'validate-ui',
        args: ['steppers'],
        expect: { success: true }
      }
    ],
    cleanup: [
      {
        name: 'Close modal',
        command: 'close-modal'
      }
    ]
  };
}

/**
 * Load a CreateSpec from file
 */
export async function loadCreateSpec(specPath) {
  try {
    const content = await fs.readFile(specPath, 'utf-8');
    // Assuming specs are in TypeScript/JavaScript files
    // This is simplified - in practice you'd need proper module loading
    const spec = eval(content);
    return spec;
  } catch (error) {
    console.error(`Failed to load spec from ${specPath}:`, error);
    return null;
  }
}

/**
 * CLI interface for test generation
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: test-generator.mjs <entity-type> <output-dir> [spec-file]');
    console.log('Example: test-generator.mjs creature ./test-cases');
    process.exit(1);
  }

  const [entityType, outputDir, specFile] = args;

  // Create output directory if needed
  await fs.mkdir(outputDir, { recursive: true });

  // Load or create spec
  let spec;
  if (specFile) {
    spec = await loadCreateSpec(specFile);
  } else {
    // Use a basic default spec
    spec = {
      fields: [
        { id: 'name', type: 'text', label: 'Name' },
        { id: 'description', type: 'textarea', label: 'Description' }
      ]
    };
  }

  // Generate test suite
  await generateTestSuite(spec, entityType, outputDir);
  console.log(`Test suite generated in ${outputDir}`);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default {
  generateTestFromSpec,
  generateTestSuite,
  generateValidationTest,
  loadCreateSpec
};