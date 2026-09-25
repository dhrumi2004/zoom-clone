import puppeteer from "puppeteer-core";
const SP = process.argv[2];
// Point at a deployed site with APP_URL=... API_URL=... (defaults: local dev servers)
const APP = process.env.APP_URL ?? "http://localhost:3000", API = process.env.API_URL ?? "http://127.0.0.1:8000";
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true, defaultViewport: { width: 1440, height: 900 },
  args: ["--disable-features=AudioServiceOutOfProcess"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const text = () => page.evaluate(() => document.body.innerText);
const waitText = (t, timeout = 5000) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, t);
const clickText = async (t) => {
  // Prefer a button inside an open dialog, so "Join" doesn't hit the dashboard tile behind it.
  const inDialog = await page.$(`::-p-xpath(//div[@role="dialog"]//button[normalize-space()="${t}"])`);
  const el = inDialog ?? (await page.waitForSelector(`::-p-xpath(//button[normalize-space()="${t}"])`, { timeout: 5000 }));
  await el.click();
};
// Clear an input the way a user would (select all + delete), so React sees the change.
const fill = (sel, value) => page.locator(sel).fill(value);
const ok = (n, msg) => console.log(`${n} ✓ ${msg}`);

await page.goto(APP); await waitText("Upcoming meetings"); ok(1, "dashboard loaded");

await page.click('button[aria-label="Join"]'); await page.waitForSelector("#join-id");
await page.type("#join-id", "1111111111"); await clickText("Join");
await waitText("not valid"); ok(2, "invalid meeting ID rejected");

const live = await (await fetch(`${API}/api/meetings/instant`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).json();
await fill("#join-id", live.meeting_code.replace(/(\d{3})(\d{3})/, "$1 $2 "));
await fill("#join-name", "Test Guest");
await clickText("Join"); await page.waitForSelector("#join-passcode"); ok(3, "passcode step shown for spaced meeting ID");
await page.type("#join-passcode", "wrong1"); await clickText("Join"); await waitText("Wrong passcode"); ok(4, "wrong passcode rejected");
await fill("#join-passcode", live.passcode); await clickText("Join");
// Lands on the video preview with the name carried over and a guest "Join" button
await waitText("Hosted by");
const name5 = await page.$eval("form input", (el) => el.value);
await page.waitForSelector(`::-p-xpath(//button[normalize-space()="Join"])`);
ok(5, `passcode accepted -> preview at ${page.url().replace(APP, "")} as "${name5}"`);

await page.goto(APP); await waitText("Upcoming meetings");
await page.click('button[aria-label="Schedule"]'); await page.waitForSelector("#s-topic");
await page.screenshot({ path: `${SP}/schedule.png` });
await fill("#s-topic", "E2E Planning Session");
await page.type("#s-desc", "Created by the automated test");
await clickText("Save"); await waitText("Meeting scheduled");
const invite = await page.$eval("dl a", (a) => a.href); ok(6, `scheduled, invite link ${invite.replace(/pwd=.*/, "pwd=…")}`);
await clickText("Done"); await waitText("E2E Planning Session"); ok(7, "new meeting appears in Upcoming list");

await page.goto(invite); await waitText("E2E Planning Session"); await page.waitForSelector("#join-name");
await clickText("Join"); await waitText("Hosted by");
await page.waitForSelector(`::-p-xpath(//button[normalize-space()="Join"])`);
ok(8, "invite link reaches the preview without typing a passcode");

await page.goto(APP); await waitText("Upcoming meetings");
await page.click('button[aria-label="New meeting"]');
await page.waitForFunction(() => location.pathname.startsWith("/meeting/"), { timeout: 5000 });
await page.waitForSelector(`::-p-xpath(//button[normalize-space()="Start"])`);
ok(9, `New meeting -> ${page.url().replace(APP, "")} host preview with "Start"`);

await page.goto(APP); await waitText("Upcoming meetings"); await waitText("Live");
ok(10, "the instant meeting shows as Live in Upcoming");
await page.click('button[aria-label="Join"]'); await page.waitForSelector("#join-id");
await page.screenshot({ path: `${SP}/join.png` });
console.log(errors.length ? "BROWSER ERRORS:\n" + errors.join("\n") : "no browser errors");
await browser.close();
