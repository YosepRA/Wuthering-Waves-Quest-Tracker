import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import stylistic from '@stylistic/eslint-plugin';

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: { globals: globals.node },
  },
  tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    plugins: { '@stylistic': stylistic },
    rules: {
      '@stylistic/indent': [
        'error',
        2,
        { offsetTernaryExpressions: true, SwitchCase: 1 },
      ],
      '@stylistic/linebreak-style': ['error', 'windows'],
      '@stylistic/quotes': ['error', 'single'],
      '@stylistic/semi': ['error', 'always'],
      'prettier/prettier': [
        'error',
        {
          singleQuote: true,
          semi: true,
          arrowParens: 'always',
          endOfLine: 'crlf',
          trailingComma: 'all',
        },
      ],
    },
  },
]);
