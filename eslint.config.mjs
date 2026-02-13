import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Enforce strict null checks
      '@typescript-eslint/no-non-null-assertion': 'error',

      // Prefer const over let
      'prefer-const': 'error',

      // Disallow var
      'no-var': 'error',

      // Require explicit return types on functions
      '@typescript-eslint/explicit-function-return-type': ['warn', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
      }],

      // Disallow unused variables (but allow underscore prefix)
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],

      // Consistent type imports
      '@typescript-eslint/consistent-type-imports': 'warn',

      // Allow console (we have a proper logger, but console for startup is ok)
      'no-console': 'off',
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'coverage/', '*.config.mjs', '*.config.ts'],
  }
);
