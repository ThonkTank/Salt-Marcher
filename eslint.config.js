import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

const relativeLayerImports = (...layers) =>
  layers.flatMap((layer) =>
    Array.from(
      { length: 8 },
      (_, depth) => `${'../'.repeat(depth + 1)}${layer}/**`
    )
  )

const rendererProcessRestrictions = [
  {
    group: ['node:*'],
    message: 'Renderer code cannot import Node.js modules.'
  },
  {
    group: ['electron'],
    message: 'Renderer code must use the preload capability bridge.'
  },
  {
    group: relativeLayerImports('core', 'main', 'preload', 'utility'),
    message: 'Renderer code may import only renderer and shared modules.'
  }
]

export default tseslint.config(
  {
    ignores: [
      '.cache/',
      '.tmp/',
      'out/',
      'dist/',
      'release/',
      'node_modules/',
      'docs/project/references/*.js',
      'scripts/render-dialog-reference-electron.cjs',
      'eslint.config.js'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true }
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true }
      ]
    }
  },
  {
    files: ['src/renderer/**/*.ts', 'src/renderer/**/*.tsx'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: false,
        project: './tsconfig.renderer.json'
      }
    },
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'process', message: 'Renderer code has no Node.js process.' },
        { name: 'Buffer', message: 'Renderer code has no Node.js Buffer.' }
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [...rendererProcessRestrictions]
        }
      ]
    }
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'electron',
                ...relativeLayerImports(
                  'renderer',
                  'main',
                  'preload',
                  'utility'
                )
              ],
              message: 'Core may import only core and shared modules.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/main/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                ...relativeLayerImports(
                  'renderer',
                  'preload',
                  'utility',
                  'core'
                )
              ],
              message: 'Main may import only main and shared modules.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/preload/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                ...relativeLayerImports('renderer', 'main', 'utility', 'core')
              ],
              message: 'Preload may import only preload and shared modules.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/utility/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: relativeLayerImports('renderer', 'main', 'preload'),
              message:
                'Utility may import only utility, core and shared modules.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/renderer/shell/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...rendererProcessRestrictions,
            {
              group: ['../features/**'],
              message: 'Shell primitives cannot depend on product features.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/renderer/features/catalog/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...rendererProcessRestrictions,
            {
              group: ['../session/**', '../hex/**'],
              message: 'Catalog cannot depend directly on Session or Hex.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/renderer/features/session/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...rendererProcessRestrictions,
            {
              group: ['../catalog/**'],
              message: 'Session cannot depend directly on Catalog.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/renderer/features/worldplanner/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...rendererProcessRestrictions,
            {
              group: [
                '../hex/**',
                '../workspace/**',
                '../encounter-table/encounter-table-manager*'
              ],
              message:
                'World Planner receives Hex, Workspace and concrete dialog behavior through ports.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/renderer/features/hex/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...rendererProcessRestrictions,
            {
              group: ['../catalog/**'],
              message: 'Hex cannot depend directly on Catalog.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/renderer/features/creature-collection/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...rendererProcessRestrictions,
            {
              group: ['../catalog/**', '../session/**'],
              message: 'Creature Collection cannot depend on its consumers.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/renderer/features/creatures/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...rendererProcessRestrictions,
            {
              group: [
                '../catalog/**',
                '../session/**',
                '../creature-collection/**'
              ],
              message: 'Creature primitives cannot depend on consumers.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['tests/e2e/**/*.e2e.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/await-thenable': 'off'
    }
  }
)
