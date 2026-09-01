import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['lib/**', 'node_modules/**', 'dist/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
)