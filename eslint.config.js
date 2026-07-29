const js = require('@eslint/js');
const pluginSecurity = require('eslint-plugin-security');
const globals = require('globals');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = [
  js.configs.recommended,
  pluginSecurity.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { ignoreRestSiblings: true, argsIgnorePattern: '^_' }],
    },
  },
  {
    // CLI tools: all file paths originate from process.argv, which is
    // supplied by the operator invoking the tool directly. There is no
    // network-facing input boundary here, so path-traversal via untrusted
    // input is not applicable. If these scripts are ever wrapped by a
    // service/API, this override must be revisited.
    files: ['scripts/**/*.js'],
    rules: {
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
  {
    files: ['**/*.test.js', '**/tests/**/*.js'],
    rules: {
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
  eslintConfigPrettier,
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**', 'repo-digest.txt'],
  },
];
