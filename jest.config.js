module.exports = {
  clearMocks: true,
  restoreMocks: true,
  preset: 'ts-jest',
  testMatch: ['**/*test.ts'],
  testPathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/node_modules/'],
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
};
