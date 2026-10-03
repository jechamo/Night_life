import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// PRD 3.3: no component may touch device APIs directly; everything goes through
// src/platform. These rules make that boundary a build error, not a convention.
const PLATFORM_ONLY = 'Use the platform layer (src/platform) instead of calling device APIs.'
const restrictedDeviceProperties = [
  ['navigator', 'geolocation'],
  ['navigator', 'mediaDevices'],
  ['navigator', 'vibrate'],
  ['navigator', 'share'],
  ['navigator', 'canShare'],
  ['navigator', 'clipboard'],
  ['navigator', 'permissions'],
  ['navigator', 'credentials'],
  ['navigator', 'serviceWorker'],
  ['window', 'localStorage'],
  ['window', 'sessionStorage'],
  ['window', 'indexedDB'],
  ['window', 'open'],
  ['window', 'Notification'],
  ['URL', 'createObjectURL'],
].map(([object, property]) => ({ object, property, message: PLATFORM_ONLY }))

const restrictedDeviceGlobals = [
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'Notification',
  'PaymentRequest',
].map((name) => ({ name, message: PLATFORM_ONLY }))

export default defineConfig(
  // Edge Functions run on Deno (checked by the Supabase runtime); database types are generated.
  {
    ignores: [
      'dist',
      'dev-dist',
      'coverage',
      'node_modules',
      '.tmp',
      'supabase/functions',
      'src/adapters/supabase/database.types.ts',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.flat['recommended-latest'].rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-properties': ['error', ...restrictedDeviceProperties],
      'no-restricted-globals': ['error', ...restrictedDeviceGlobals],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@supabase/*'],
              message: 'PRD 3.4: the UI never calls Supabase. Use a feature service/adapter.',
            },
            {
              group: ['@/platform/*/web', '@/platform/**/*.web'],
              message: 'Import platform services through usePlatform(), not web implementations.',
            },
          ],
        },
      ],
    },
  },
  {
    // The platform layer is the only place allowed to touch device/browser APIs.
    files: ['src/platform/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-properties': 'off',
      'no-restricted-globals': 'off',
      'no-restricted-imports': 'off',
    },
  },
  {
    // Adapters are the only layer that talks to Supabase (PRD 3.4, ADR 0009).
    files: ['src/adapters/supabase/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/platform/*/web', '@/platform/**/*.web'],
              message: 'Import platform services through the Platform object.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-properties': 'off',
      'no-restricted-globals': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    files: ['*.config.{js,ts}', 'scripts/**/*.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
)
