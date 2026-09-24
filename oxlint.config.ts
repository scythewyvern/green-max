import { defineConfig } from 'oxlint'

export default defineConfig({
  ignorePatterns: ['node_modules', 'dist'],
  plugins: ['oxc', 'react', 'react-perf', 'import', 'typescript', 'promise', 'unicorn'],
  env: { builtin: true },
  rules: {
    complexity: 'error',
  },
  categories: {
    correctness: 'error',
  },
  options: {
    typeAware: true,
    typeCheck: true,
  },
})
