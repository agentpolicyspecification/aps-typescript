export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  globalSetup: "./test/globalSetup.cjs",
  globalTeardown: "./test/globalTeardown.cjs",
  testMatch: ["**/test/**/*.test.ts"],
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageProvider: "v8",
  collectCoverageFrom: ["src/**/*.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "./tsconfig.test.json",
      },
    ],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};
