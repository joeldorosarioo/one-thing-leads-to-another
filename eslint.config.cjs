const { defineConfig } = require('eslint/config');

const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const obsidianmd = require('eslint-plugin-obsidianmd').default;

const safetyRules = {
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error'
};

const functionalRules = [
  {
    selector: 'ClassDeclaration',
    message: 'Use functions and composition. Obsidian subclasses belong in infrastructure/obsidian.'
  },
  {
    selector: 'ClassExpression',
    message: 'Use functions and composition. Obsidian subclasses belong in infrastructure/obsidian.'
  }
];

module.exports = defineConfig(
  {
    ignores: ['node_modules/**', '.build/**', 'main.js']
  },
  {
    files: ['**/*.js', '**/*.cjs'],
    extends: [js.configs.recommended],

    languageOptions: {
      sourceType: 'commonjs',

      globals: {
        __dirname: 'readonly',
        require: 'readonly',
        module: 'readonly',
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        Buffer: 'readonly',
        structuredClone: 'readonly'
      }
    },

    rules: {
      ...safetyRules,

      'no-unused-vars': [
        'error',
        {
          caughtErrors: 'none',
          argsIgnorePattern: '^_'
        }
      ]
    }
  },
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommended],

    rules: {
      ...safetyRules,

      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrors: 'none'
        }
      ],

      '@typescript-eslint/consistent-type-imports': 'error',

      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'function',
          format: ['camelCase']
        },
        {
          selector: 'parameter',
          leadingUnderscore: 'allow',
          format: ['camelCase']
        },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase']
        },
        {
          selector: 'typeLike',
          format: ['PascalCase']
        }
      ]
    }
  },
  {
    files: ['src/**/*.ts'],
    plugins: { obsidianmd },
    languageOptions: {
      parserOptions: { project: './tsconfig.json', tsconfigRootDir: __dirname }
    },
    rules: {
      'no-empty': 'error',
      '@typescript-eslint/unbound-method': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-deprecated': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'all' }],
      'obsidianmd/no-unsupported-api': 'error',
      'obsidianmd/prefer-window-timers': 'error',
      'obsidianmd/prefer-create-el': 'error',
      'obsidianmd/hardcoded-config-path': 'error',
      'obsidianmd/settings-tab/prefer-setting-definitions': 'error'
    }
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/infrastructure/obsidian/**'],

    rules: {
      'no-restricted-syntax': ['error', ...functionalRules]
    }
  },
  {
    files: ['src/infrastructure/obsidian/**/*.ts'],

    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ClassDeclaration:not([superClass.name=/^(Plugin|ItemView|PluginSettingTab|FuzzySuggestModal)$/])',
          message: 'Only the subclasses required by Obsidian are allowed.'
        },
        {
          selector: 'ClassExpression:not([superClass.name=/^(Plugin|ItemView|PluginSettingTab|FuzzySuggestModal)$/])',
          message: 'Only the subclasses required by Obsidian are allowed.'
        },
        {
          selector: 'MethodDefinition[kind="constructor"]',
          message: 'Compose adapter dependencies with functions instead of custom constructors.'
        }
      ]
    }
  },
  {
    files: ['src/domain/**/*.ts', 'src/application/**/*.ts', 'src/shared/**/*.ts'],

    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['obsidian'],
          patterns: ['**/infrastructure/**', '**/features/**']
        }
      ]
    }
  },
  {
    files: ['src/features/**/*.ts'],

    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['**/plugin-entry', '**/plugin-lifecycle', '**/editor-workspace', '**/data-editor-view']
        }
      ]
    }
  }
);
