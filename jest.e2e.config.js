/** @type {import('jest').Config} */
module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	testMatch: ["<rootDir>/tests/e2e/**/*.e2e.test.ts"],
	globalSetup: "<rootDir>/tests/e2e/setup/global-setup.ts",
	globalTeardown: "<rootDir>/tests/e2e/setup/global-teardown.ts",
	setupFilesAfterEnv: ["<rootDir>/tests/e2e/setup/provider-mocks.ts"],
	testTimeout: 30000,
};
