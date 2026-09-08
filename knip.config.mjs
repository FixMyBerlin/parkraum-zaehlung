/** @type {import('knip').KnipConfig} */
const strict = process.env.KNIP_STRICT === '1'

export default {
  entry: [
    'src/main.tsx',
    'src/routes/**/*.ts',
    'src/routes/**/*.tsx',
    'src/**/*.test.ts',
    'src/**/*.test.tsx',
    'vite.config.ts',
    'playwright.config.ts',
    'tests/**/*.ts',
  ],
  ignore: ['.agents/**', 'src/routeTree.gen.ts'],
  ignoreBinaries: ['code', 'gh', 'rg'],
  ignoreDependencies: ['@typescript/typescript-darwin-arm64', '@typescript/typescript-linux-x64'],
  rules: {
    files: 'error',
    dependencies: 'error',
    devDependencies: 'error',
    unlisted: 'error',
    binaries: 'error',
    exports: strict ? 'error' : 'warn',
    types: strict ? 'error' : 'warn',
    enumMembers: strict ? 'error' : 'warn',
    duplicates: 'warn',
  },
}
