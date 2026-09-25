// Sign up / sign in / sign out, protected pages, and a multi-account meeting joined through an invite link:
// Riya signs up and schedules a future meeting -> Sam opens the link signed out, signs up, lands back in the
// meeting -> Aarav (demo account) joins the same link -> all three are in one working call.
import puppeteer from "puppeteer-core";
import { API, APP } from "./lib.mjs";

const launch = () => puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true, defaultViewport: { width: 1280, height: 800 },
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--disable-features=AudioServiceOutOfProcess"],
});
const browsers = await Promise.all([launch(), launch(), launch()]);
setTimeout(() => { console.log("TIMEOUT"); process.exit(2); }, 220_000).unref();
const [riya, sam, aarav] = await Promise.all(browsers.map((b) => b.newPage()));
const errors = [];
for (const [who, p] of [["riya", riya], ["sam", sam], ["aarav", aarav]]) {
  p.on("pageerror", (e) => errors.push(`${who}: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(`${who}: ${m.text()}`));
}
const waitText = (p, t, timeout = 15000) => p.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, t);
const waitPath = (p, re, timeout = 15000) => p.waitForFunction((re) => new RegExp(re).test(location.pathname + location.search), { timeout }, re);
const click = async (p, t) => {
  const m = `[normalize-space()="${t}" or @aria-label="${t}"]`;
  const inDialog = await p.$(`::-p-xpath(//div[@role="dialog"]//button${m})`);
  await (inDialog ?? (await p.waitForSelector(`::-p-xpath(//button${m} | //a${m})`, { timeout: 10000 }))).click();
};
const fill = (p, sel, v) => p.locator(sel).fill(v);
const ok = (n, msg) => console.log(`${n} ✓ ${msg}`);
const stamp = Date.now();
const riyaEmail = `riya${stamp}@example.com`, samEmail = `sam${stamp}@example.com`;

// 1. Protected pages redirect to Sign In
await riya.goto(`${APP}/mail`); await waitPath(riya, "^/login\\?next=%2Fmail");
ok(1, "signed-out visit to /mail redirects to /login?next=/mail");

// 2. Sign up (with validation)
await click(riya, "Sign Up Free"); await riya.waitForSelector("#name");
await fill(riya, "#name", "Riya Sen"); await fill(riya, "#email", riyaEmail); await fill(riya, "#password", "short"); await fill(riya, "#confirm", "short");
await click(riya, "Sign Up"); await waitText(riya, "doesn't meet the requirements");
await fill(riya, "#password", "secret123"); await fill(riya, "#confirm", "secret124"); await click(riya, "Sign Up"); await waitText(riya, "Passwords don't match");
await fill(riya, "#confirm", "secret123"); await click(riya, "Sign Up");
await waitPath(riya, "^/mail"); await waitText(riya, "Inbox");
await riya.goto(APP); await waitText(riya, "No upcoming meetings");
await riya.waitForFunction(() => document.querySelector('button[aria-label="Profile"]')?.innerText.includes("RS"));
ok(2, "sign up validates, then lands back on /mail; new account starts with no meetings (avatar RS)");

// 3. Sign out, wrong password, sign in
await click(riya, "Profile"); await click(riya, "Sign out"); await waitPath(riya, "^/login");
await riya.goto(`${APP}/`); await waitPath(riya, "^/login");
await fill(riya, "#email", riyaEmail); await fill(riya, "#password", "wrongpass1"); await click(riya, "Sign In");
await waitText(riya, "Incorrect email or password");
await fill(riya, "#password", "secret123"); await click(riya, "Sign In"); await waitText(riya, "Upcoming meetings");
ok(3, "sign out, protected page redirects again, wrong password rejected, sign in works");

// 4. Duplicate email
await sam.goto(`${APP}/signup`); await sam.waitForSelector("#name");
await fill(sam, "#name", "Copy Cat"); await fill(sam, "#email", riyaEmail); await fill(sam, "#password", "secret123"); await fill(sam, "#confirm", "secret123");
await click(sam, "Sign Up"); await waitText(sam, "already exists");
ok(4, "signing up with an existing email is refused");

// 5. Riya schedules a meeting for tomorrow and gets the invite link
await riya.click('button[aria-label="Schedule"]'); await riya.waitForSelector("#s-topic");
await fill(riya, "#s-topic", "Riya's Planning Call");
const tomorrow = new Date(Date.now() + 86_400_000); const pad = (n) => String(n).padStart(2, "0");
await riya.$eval("#s-date", (el, v) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }, `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`);
await click(riya, "Save"); await waitText(riya, "Meeting scheduled");
const invite = await riya.$eval("dl a", (a) => a.href);
await click(riya, "Done"); await waitText(riya, "Riya's Planning Call");
ok(5, `Riya scheduled a meeting for tomorrow: ${invite.replace(/pwd=.*/, "pwd=…")}`);

// 6. Sam opens the link signed out -> Sign In -> "Sign up free" -> creates an account -> back to the meeting
await sam.goto(invite); await waitPath(sam, "^/login\\?next=%2Fj%2F"); await waitText(sam, "Sign in to join the meeting");
await click(sam, "Sign up free"); await sam.waitForSelector("#name");
await fill(sam, "#name", "Sam Lee"); await fill(sam, "#email", samEmail); await fill(sam, "#password", "secret123"); await fill(sam, "#confirm", "secret123");
await click(sam, "Sign Up"); await waitPath(sam, "^/j/"); await waitText(sam, "Riya's Planning Call");
await sam.waitForFunction(() => document.querySelector("#join-name")?.value === "Sam Lee" || document.querySelector("#join-name")?.placeholder === "Sam Lee");
await click(sam, "Join"); await waitPath(sam, "^/meeting/"); await click(sam, "Join"); await waitText(sam, "Participants");
ok(6, "Sam: invite link -> sign in page -> sign up -> back to the invite -> joined with his own name");

// 7. Aarav opens the same link and uses a demo account from the sign-in page
await aarav.goto(invite); await waitPath(aarav, "^/login");
await (await aarav.waitForSelector(`::-p-xpath(//button[contains(., "Aarav Shah")])`)).click();
await waitPath(aarav, "^/j/"); await click(aarav, "Join"); await waitPath(aarav, "^/meeting/"); await click(aarav, "Join"); await waitText(aarav, "Participants");
ok(7, "Aarav: same link -> demo account sign-in -> joined");

// 8. Riya (the owner) joins from her dashboard and is the host
await riya.goto(APP); await waitText(riya, "Live");
await (await riya.waitForSelector(`::-p-xpath(//li[contains(., "Riya's Planning Call")]//button[normalize-space()="Join"])`)).click();
await waitPath(riya, "^/meeting/"); await click(riya, "Start"); await waitText(riya, "Riya Sen (You)");
await waitText(riya, "End"); // hosts get "End", guests get "Leave"
ok(8, "Riya joins her own meeting as host (End button, host controls)");

// 9. Everyone sees everyone, with live video
for (const [who, p] of [["riya", riya], ["sam", sam], ["aarav", aarav]]) {
  await waitText(p, "Riya Sen"); await waitText(p, "Sam Lee"); await waitText(p, "Aarav Shah");
  await p.waitForFunction(() => [...document.querySelectorAll("video")].filter((v) => v.videoWidth > 0).length >= 3, { timeout: 25000 })
    .catch(() => { throw new Error(`${who} doesn't see 3 live videos`); });
}
await riya.screenshot({ path: "auth-meeting.png" });
ok(9, "3 accounts in one meeting: each sees all 3 names and 3 live videos");

// 10. Host controls work across accounts; chat reaches everyone
await click(riya, "Participants"); await waitText(riya, "Riya Sen (Host, me)");
const row = await riya.waitForSelector(`::-p-xpath(//li[contains(., "Sam Lee")])`); await row.hover();
await (await riya.waitForSelector(`::-p-xpath(//li[contains(., "Sam Lee")]//button[normalize-space()="Mute"])`)).click();
await waitText(sam, "You have been muted by the host");
await click(sam, "Chat"); await sam.waitForSelector('textarea[aria-label="Chat message"]');
await sam.type('textarea[aria-label="Chat message"]', "Hi from Sam's account"); await sam.keyboard.press("Enter");
await click(aarav, "Chat"); await waitText(aarav, "Hi from Sam's account");
ok(10, "host mutes a guest from another account; chat reaches everyone");

// 11. Host ends the meeting; guests see it; Sam's Recent meetings lists it
await click(riya, "End"); await click(riya, "End meeting for all");
await waitText(sam, "ended by host"); await waitText(aarav, "ended by host");
const samToken = await sam.evaluate(() => localStorage.getItem("zoom:token"));
const recent = await (await fetch(`${API}/api/meetings/recent`, { headers: { Authorization: `Bearer ${samToken}` } })).json();
ok(11, `end for all; Sam's Recent meetings includes it: ${recent.some((m) => m.title === "Riya's Planning Call")}`);

console.log(errors.length ? "BROWSER ERRORS:\n" + [...new Set(errors)].join("\n") : "no browser errors");
await Promise.race([Promise.all(browsers.map((b) => b.close())), new Promise((r) => setTimeout(r, 5000))]);
process.exit(errors.length ? 1 : 0);
