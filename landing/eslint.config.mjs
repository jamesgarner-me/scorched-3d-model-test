import vitest from '@vitest/eslint-plugin'
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier/flat'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import testingLibrary from 'eslint-plugin-testing-library'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // `eslint-config-next` ships only a handful of a11y rules; a page whose whole
  // job is links and semantics warrants the full set. The rules are spread
  // rather than the config extended, because Next already registers the plugin.
  {
    rules: jsxA11y.flatConfigs.recommended.rules,
  },

  {
    files: ['**/*.test.{ts,tsx}'],
    extends: [testingLibrary.configs['flat/react'], vitest.configs.recommended],
    rules: {
      // Catches assertions that were never awaited, which otherwise surface as
      // act() warnings rather than as failures.
      'vitest/valid-expect': ['error', { alwaysAwait: true }],
      // A stray `.only` silently stops running the rest of the suite.
      'vitest/no-focused-tests': 'error',
    },
  },

  // Last, so formatting is Prettier's job alone.
  prettier,

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
])

export default eslintConfig
