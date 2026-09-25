// Runs test files one after another. Each gets a time limit, and its whole process group
// (including the headless Chrome browsers it started) is killed afterwards, so a crashed or
// stuck test can never leave browsers running in the background.
import { execSync, spawn } from "node:child_process";

/** Puppeteer starts Chrome in its own process group, so close test browsers by their temporary profile. */
const killTestBrowsers = () => {
  try {
    execSync("pkill -f puppeteer_dev_chrome_profile", { stdio: "ignore" });
  } catch {} // nothing left to kill
};

const LIMIT_MS = 4 * 60_000;
const suites = process.argv.slice(2);
let failed = 0;

for (const name of suites) {
  console.log(`\n=== ${name} ===`);
  const code = await new Promise((resolve) => {
    const child = spawn(process.execPath, [`${name}.mjs`, "."], { stdio: "inherit", detached: true });
    const kill = () => {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {}
    };
    const timer = setTimeout(() => {
      console.log(`✗ ${name} took longer than ${LIMIT_MS / 60_000} minutes`);
      kill();
    }, LIMIT_MS);
    child.on("exit", (exitCode) => {
      clearTimeout(timer);
      kill();
      killTestBrowsers(); // clean up any browser left behind
      resolve(exitCode ?? 1);
    });
  });
  if (code !== 0) failed++;
}

console.log(failed ? `\n${failed} of ${suites.length} test files failed` : `\nAll ${suites.length} test files passed`);
process.exit(failed ? 1 : 0);
