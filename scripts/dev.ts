import { execSync } from "child_process";
import { ROOT_DIR, setupVendor, startVite } from "./common";

setupVendor();

// Always rebuild the test DB from sample data to ensure tests use the correct fixture.
// A stale full-archive DB here causes E2E test failures.
console.log("Building test database from sample data...");
execSync("cargo run -p dril-builder -- testdata/dir-test site/vendor/dril.db", {
	stdio: "inherit",
	cwd: ROOT_DIR,
});

await startVite();
