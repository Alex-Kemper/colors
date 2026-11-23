/**
 * Jest is used only as a test runner. The COLORS app itself is PHP served by
 * Apache (or `php -S` in CI); Node never runs the application.
 */
module.exports = {
	projects: [
		{
			displayName: "unit",
			testEnvironment: "jsdom",
			testMatch: ["<rootDir>/tests/unit/**/*.test.js"],
		},
		{
			displayName: "integration",
			testEnvironment: "node",
			testMatch: ["<rootDir>/tests/integration/**/*.test.js"],
		},
	],
};
