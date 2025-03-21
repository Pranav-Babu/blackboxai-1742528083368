module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test setup and teardown
  globalSetup: './tests/setup.js',
  globalTeardown: './tests/teardown.js',

  // Test match patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],

  // Test timeout
  testTimeout: 30000,

  // Coverage settings
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/coverage/'
  ],

  // Reporter settings
  verbose: true,

  // Environment variables
  setupFiles: ['dotenv/config'],

  // Module file extensions
  moduleFileExtensions: ['js', 'json'],

  // Transform settings
  transform: {},

  // Test path ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/'
  ],

  // Watch settings
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/'
  ],

  // Automatically clear mock calls and instances between tests
  clearMocks: true,

  // Indicates whether the coverage information should be collected while executing the test
  collectCoverageFrom: [
    'controllers/**/*.js',
    'models/**/*.js',
    'routes/**/*.js',
    'middleware/**/*.js',
    'utils/**/*.js',
    '!**/node_modules/**'
  ]
};