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
        projectService: {
          allowDefaultProject: ['tests/*.test.ts'],
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 20,
        },
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

      // Allow numbers in template literals
      '@typescript-eslint/restrict-template-expressions': ['error', {
        allowNumber: true,
      }],

      // Allow empty methods (interface compliance)
      '@typescript-eslint/no-empty-function': ['error', {
        allow: ['methods'],
      }],

      // Allow async methods without await (interface compliance)
      '@typescript-eslint/require-await': 'off',

      // Allow string + number in concatenation (Redis key building)
      '@typescript-eslint/restrict-plus-operands': ['error', {
        allowNumberAndString: true,
      }],
    },
  },
  // Relax strict rules for test files (mocks involve `any`, assertions use `!`)
  {
    files: ['tests/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'coverage/', '*.config.mjs', '*.config.ts'],
  }
);
