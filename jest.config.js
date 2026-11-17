/** Unit/integration tests for the data layer and statistics (run with `npm test`). */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { strict: true, esModuleInterop: true, types: ['jest', 'node'] }, diagnostics: { ignoreCodes: [151001] } }] },
};
