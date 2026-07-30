import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['out/', 'dist/', 'release/', 'node_modules/', 'eslint.config.js']
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
          patterns: [
            {
              group: ['node:*'],
              message: 'Renderer code cannot import Node.js modules.'
            },
            {
              group: ['electron'],
              message: 'Renderer code must use the preload capability bridge.'
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
