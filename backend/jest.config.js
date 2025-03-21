module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test files pattern
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
  collectCoverageFrom: [
    'controllers/**/*.js',
    'middleware/**/*.js',
    'models/**/*.js',
    'routes/**/*.js',
    'utils/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**'
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Test timeout
  testTimeout: 30000,

  // Setup files
  setupFiles: ['<rootDir>/tests/setup.js'],

  // Test environment variables
  setupFilesAfterEnv: ['<rootDir>/tests/setupAfterEnv.js'],

  // Module file extensions
  moduleFileExtensions: ['js', 'json'],

  // Module name mapper for aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/'
  ],

  // Watch plugins
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Automatically clear mock calls and instances
  resetMocks: true,

  // Automatically restore mock state between every test
  restoreMocks: true,

  // Global teardown
  globalTeardown: '<rootDir>/tests/teardown.js',

  // Reporter configuration
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'test-results/jest',
        outputName: 'results.xml'
      }
    ]
  ],

  // Custom resolver
  resolver: '<rootDir>/tests/resolver.js',

  // Transform configuration
  transform: {
    '^.+\\.js$': 'babel-jest'
  },

  // Transform ignore patterns
  transformIgnorePatterns: [
    '/node_modules/',
    '\\.pnp\\.[^\\/]+$'
  ],

  // Global setup
  globalSetup: '<rootDir>/tests/setup.js',

  // Test environment options
  testEnvironmentOptions: {
    url: 'http://localhost'
  },

  // Notify mode configuration
  notify: true,
  notifyMode: 'failure-change',

  // Bail configuration
  bail: 1,

  // Cache configuration
  cache: true,
  cacheDirectory: '.jest-cache',

  // Error handling
  errorOnDeprecated: true,

  // Force coverage collection from ignored files
  forceCoverageMatch: ['**/*.js'],

  // Maximum number of workers
  maxWorkers: '50%',

  // Module load timeout
  moduleLoadTimeout: 60000,

  // Test sequence
  testSequencer: '<rootDir>/tests/sequencer.js',

  // Snapshot configuration
  snapshotSerializers: [
    'jest-serializer-path'
  ],
  snapshotFormat: {
    escapeString: true,
    printBasicPrototype: true
  }
};