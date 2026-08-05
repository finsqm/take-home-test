/** @type {import('jest').Config} */
module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	testMatch: ["<rootDir>/tests/e2e/**/*.e2e.test.ts"],
	globalSetup: "<rootDir>/tests/e2e/setup/global-setup.ts",
	globalTeardown: "<rootDir>/tests/e2e/setup/global-teardown.ts",
	setupFilesAfterEnv: ["<rootDir>/tests/e2e/setup/provider-mocks.ts"],
	testTimeout: 30000,
	// All e2e test files share one Postgres database/pg-boss schema (see global-setup.ts).
	// pg-boss uses SKIP LOCKED so any worker process's consumer can legitimately dequeue
	// any other process's jobs on the same queue name - correct for production horizontal
	// scaling, but it breaks per-file mock isolation if test files run in parallel worker
	// processes. Forcing a single worker keeps exactly one file's consumer active at a time.
	maxWorkers: 1,
};
