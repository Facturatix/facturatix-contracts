import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'
import eslintPluginPrettier from 'eslint-plugin-prettier'

/**
 * Lint configuration for the TypeScript half of the contract package.
 *
 * This repository was C#-only until the contract gained a TypeScript twin, so it shipped ~1 500
 * lines of validator, canonicalizer and vocabulary with no linter at all. That is a worse gap here
 * than in a normal package: these files are the reference implementation three services agree on,
 * and a silent `any` in the validator would make it accept a document the C# half rejects.
 *
 * Type-aware rules are on for exactly that reason — `no-unsafe-*` and `no-floating-promises` need
 * type information, and they are the ones that catch a validator quietly widening to `any`.
 */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'nupkg/**', 'src/Facturatix.Contracts/**'] },

  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    plugins: { prettier: eslintPluginPrettier },
    rules: {
      'prettier/prettier': 'error',

      // Bans `{ ... } as SomeType`, matching the Modeler's configuration.
      //
      // Asserting an object literal tells the compiler to stop checking it. In a package whose job
      // is to describe shapes, an assertion that drifts from its interface produces a contract that
      // documents one thing and validates another.
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' }
      ],

      // The rule exists to stop `${someObject}` becoming "[object Object]" and `${anyValue}`
      // becoming anything at all. Numbers are not that hazard — they stringify predictably, and the
      // validator interpolates counts and indexes into human messages constantly. `allowNumber` is
      // the option the rule ships for this; the alternative would be wrapping every count in
      // `String()`, which adds noise without adding a single guarantee.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],

      // Every exported symbol here is part of a published contract; an unused one is either dead
      // surface or a rename someone forgot to finish.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ]
    }
  },

  {
    // The lint config and the build scripts run under plain Node and are not part of the TypeScript
    // project, so the type-aware rules have no program to consult for them.
    files: ['scripts/**/*.mjs', 'eslint.config.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly' }
    }
  },

  eslintConfigPrettier
)
