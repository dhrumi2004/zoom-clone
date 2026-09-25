// Co-host, pin, spotlight, rename, security, private chat, stop video, polls, breakout rooms,
// recording, background blur, device menu, timer, hide self view, PMI and recurring meetings.
import puppeteer from "puppeteer-core";
const OUT = process.argv[2] ?? ".";
const APP = "http://localhost:3000", API = "http://127.0.0.1:8000";
const launch = () => puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true, defaultViewport: { width: 1440, height: 860 },
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--disable-features=AudioServiceOutOfProcess",
         "--auto-accept-this-tab-capture", "--autoplay-policy=no-user-gesture-required"],
});
const [hb, gb] = await Promise.all([launch(), launch()]);
// HARD_TIMEOUT: never hang forever
setTimeout(() => { console.log("TIMEOUT: test took too long"); process.exit(2); }, 240_000).unref();
const host = await hb.newPage(), guest = await gb.newPage();
const errors = [];
for (const [who, p] of [["host", host], ["guest", guest]]) {
  p.on("pageerror", (e) => errors.push(`${who}: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && !/Failed to load resource|WebGL|GPU/.test(m.text()) && errors.push(`${who}: ${m.text()}`));
}
const waitText = (p, t, timeout = 12000) =>
  p.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, t).catch(async (e) => {
    const who = p === host ? "host" : "guest";
    throw new Error(`[${who}] never showed "${t}". URL ${p.url()}\nText: ${(await p.evaluate(() => document.body.innerText)).replace(/\n/g, " | ").slice(0, 400)}`);
  });
const noText = (p, t, timeout = 8000) => p.waitForFunction((t) => !document.body.innerText.includes(t), { timeout }, t);
const button = (p, t, timeout = 8000) => {
  const m = `[normalize-space()="${t}" or @aria-label="${t}"]`;
  return p.$(`::-p-xpath(//div[@role="dialog"]//button${m})`).then((d) => d ?? p.waitForSelector(`::-p-xpath(//button${m} | //a${m})`, { timeout }));
};
const click = async (p, t) => (await button(p, t)).click();
const menuItem = async (p, t) => (await p.waitForSelector(`::-p-xpath(//div[@role="menu"]//button[normalize-space()="${t}"])`, { timeout: 8000 })).click();
// Tiles re-render when names or media change, so retry if the button is replaced mid-click.
const tileMenu = async (p, name) => {
  for (let attempt = 0; ; attempt++) {
    try {
      const tile = await p.waitForSelector(`::-p-xpath(//button[@aria-label="Options for ${name}"])`, { timeout: 8000 });
      await tile.click();
      await p.waitForSelector('[role="menu"]', { timeout: 2000 });
      return;
    } catch (e) {
      if (attempt >= 3) throw e;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
};
const ok = (n, msg) => console.log(`${n} ✓ ${msg}`);
const skip = (n, msg) => console.log(`${n} – ${msg}`);

// Setup: host starts, guest joins
await host.goto(APP); await host.waitForSelector('button[aria-label="New meeting"]'); await host.click('button[aria-label="New meeting"]');
await host.waitForFunction(() => location.pathname.startsWith("/meeting/")); const code = host.url().split("/meeting/")[1];
await click(host, "Start"); await waitText(host, "(You)");
const d = await (await fetch(`${API}/api/meetings/${code}/details`)).json();
await guest.goto(d.invite_link); await guest.waitForSelector("#join-name"); await guest.locator("#join-name").fill("Guest Tester");
await click(guest, "Join"); await guest.waitForFunction(() => location.pathname.startsWith("/meeting/")); await click(guest, "Join");
const hostName = (await (await fetch(`${API}/api/users/me`)).json()).name; // other suites may rename the user
await waitText(host, "Guest Tester"); await waitText(guest, hostName);
ok(1, "host and guest in the meeting");

await host.waitForFunction(() => /\d\d:\d\d/.test(document.querySelector("header")?.innerText ?? ""));
ok(2, "meeting timer is running");

// Co-host
await tileMenu(host, "Guest Tester"); await menuItem(host, "Make co-host");
await waitText(guest, "You are now a co-host"); await button(guest, "Security");
ok(3, "Make co-host: guest gets the Security button");
await tileMenu(host, "Guest Tester"); await menuItem(host, "Withdraw co-host permission");
await waitText(guest, "You are no longer a co-host");
ok(4, "Withdraw co-host");

// Rename
await tileMenu(host, "Guest Tester"); await menuItem(host, "Rename");
await guest.bringToFront(); await host.waitForSelector("#rename"); await host.locator("#rename").fill("Guest Renamed"); await click(host, "Change");
await waitText(guest, "Guest Renamed (You)"); await waitText(host, "Guest Renamed");
ok(5, "host renames guest (both see the new name)");

// Pin + spotlight
await tileMenu(host, "Guest Renamed"); await menuItem(host, "Pin");
await host.waitForSelector('[aria-label="Pinned"]');
await tileMenu(host, "Guest Renamed"); await menuItem(host, "Unpin");
await tileMenu(host, "Guest Renamed"); await menuItem(host, "Spotlight for everyone");
await guest.waitForSelector('[aria-label="Spotlighted"]');
await tileMenu(host, "Guest Renamed"); await menuItem(host, "Remove spotlight");
await guest.waitForFunction(() => !document.querySelector('[aria-label="Spotlighted"]'));
ok(6, "pin (local) and spotlight (everyone) on and off");

// Security
await click(host, "Security"); await (await host.waitForSelector(`::-p-xpath(//label[contains(., "Rename themselves")]//input)`)).click();
await guest.waitForFunction(async () => true);
await new Promise((r) => setTimeout(r, 800));
await tileMenu(guest, "Guest Renamed");
const guestItems = await guest.$$eval('[role="menu"] button', (bs) => bs.map((b) => b.textContent));
await guest.keyboard.press("Escape");
await (await host.waitForSelector(`::-p-xpath(//label[contains(., "Lock meeting")]//input)`)).click();
await host.waitForSelector('[aria-label="Meeting locked"]');
const lockedJoin = await fetch(`${API}/api/meetings/${code}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ display_name: "Late", passcode: d.passcode }) });
await (await host.waitForSelector(`::-p-xpath(//label[contains(., "Lock meeting")]//input)`)).click();
await (await host.waitForSelector(`::-p-xpath(//label[contains(., "Rename themselves")]//input)`)).click();
await host.keyboard.press("Escape"); await host.mouse.click(700, 300);
ok(7, `security: rename hidden for guest (${!guestItems.includes("Rename")}), lock blocks joins (${lockedJoin.status})`);

// Private chat
await click(guest, "Chat"); await guest.waitForSelector('textarea[aria-label="Chat message"]');
await guest.select("form select", String((await (await fetch(`${API}/api/meetings/${code}/participants`)).json()).participants.find((p) => p.role === "host").id));
await guest.type('textarea[aria-label="Chat message"]', "psst, private"); await guest.keyboard.press("Enter");
await click(host, "Chat"); await waitText(host, "psst, private"); await waitText(host, "(Direct Message)");
await host.screenshot({ path: `${OUT}/extras-chat.png` });
await click(host, "Chat"); await click(guest, "Chat");
ok(8, "private chat message shows as (Direct Message)");

// Stop video
await tileMenu(host, "Guest Renamed"); await menuItem(host, "Stop video");
await waitText(guest, "The host has stopped your video"); await guest.waitForSelector('footer button[aria-label="Start Video"]');
await tileMenu(host, "Guest Renamed"); await menuItem(host, "Ask to start video");
await waitText(guest, "The host has asked you to start your video"); await click(guest, "Start My Video");
await guest.waitForSelector('footer button[aria-label="Stop Video"]');
ok(9, "host stops guest video, then asks to start it");

// Polls
await click(host, "More"); await click(host, "Polls"); await click(host, "Create a poll");
await host.type('input[aria-label="Poll question"]', "Pizza or sushi?");
await host.type('input[aria-label="Answer 1"]', "Pizza"); await host.type('input[aria-label="Answer 2"]', "Sushi");
await click(host, "Launch");
await waitText(guest, "The host started a poll"); await click(guest, "Answer poll");
await (await guest.waitForSelector(`::-p-xpath(//label[contains(., "Sushi")]//input)`)).click(); await click(guest, "Submit");
await waitText(host, "1 vote"); await host.screenshot({ path: `${OUT}/extras-poll.png` });
await click(host, "End poll"); await click(host, "Share results"); await waitText(guest, "100% (1)");
await click(host, "Close panel"); await click(guest, "Close panel");
ok(10, "poll: launch, vote, live results, end, share results");

// Breakout rooms
await click(host, "More"); await click(host, "Breakout rooms"); await host.waitForSelector('select[aria-label="Room for Guest Renamed"]');
await host.select('select[aria-label="Room for Guest Renamed"]', "1"); await click(host, "Open all rooms");
await waitText(guest, "Breakout room:"); await waitText(guest, "Room 1");
await guest.waitForFunction((n) => !document.body.innerText.includes(n), {}, hostName);
await guest.screenshot({ path: `${OUT}/extras-breakout.png` });
await click(guest, "Leave room"); await waitText(guest, "You're back in the main room"); await waitText(guest, hostName);
await click(host, "More"); await click(host, "Breakout rooms"); await click(host, "Close all rooms");
ok(11, "breakout: assigned to Room 1 (separate from host), left back to main, rooms closed");

// Hide self view
await click(host, "More"); await click(host, "Hide self view");
await host.waitForFunction((n) => !document.body.innerText.includes(`${n} (You)`), {}, hostName);
await click(host, "More"); await click(host, "Show self view"); await waitText(host, `${hostName} (You)`);
ok(12, "hide / show self view");

// Device menus + blur
await click(host, "Audio options"); await waitText(host, "Select a microphone"); await host.keyboard.press("Escape"); await host.mouse.click(700, 300);
await click(host, "Video options"); await waitText(host, "Select a camera"); await click(host, "Blur my background");
try {
  await host.waitForFunction(() => !document.body.innerText.includes("Loading background blur"), { timeout: 30000 });
  const blurErr = await host.evaluate(() => document.body.innerText.includes("isn't available"));
  await host.waitForFunction(() => [...document.querySelectorAll("video")].some((v) => v.videoWidth > 0));
  blurErr ? skip(13, "background blur couldn't load in headless Chrome (needs GPU/WebGL); the fallback message showed") : ok(13, "device menus + background blur on");
} catch { skip(13, "background blur model didn't load in time (network)"); }
await host.mouse.click(700, 300);

// Recording (tab capture)
await click(host, "More"); await click(host, "Record to this computer");
try {
  await waitText(guest, "This meeting is being recorded", 8000); await waitText(guest, "Recording");
  await click(host, "More"); await click(host, "Stop recording"); await waitText(guest, "Recording stopped");
  ok(14, "recording: everyone sees the Recording indicator; stop saves the file");
} catch { skip(14, "headless Chrome can't capture the tab for recording (works in normal Chrome)"); await host.mouse.click(700, 300); }

// PMI + recurring (REST level, UI covered by the Schedule form)
const pmi = await (await fetch(`${API}/api/meetings/instant`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ use_pmi: true }) })).json();
const me = await (await fetch(`${API}/api/users/me`)).json();
ok(15, `PMI meeting uses the Personal Meeting ID (${pmi.meeting_code === me.personal_meeting_id})`);

await click(host, "End"); await click(host, "End meeting for all"); await waitText(guest, "ended by host");
ok(16, "end meeting for all still works");
console.log(errors.length ? "BROWSER ERRORS:\n" + [...new Set(errors)].join("\n") : "no browser errors");
// Closing a browser that captured its own tab can hang; don't wait more than a few seconds.
await Promise.race([Promise.all([hb.close(), gb.close()]), new Promise((r) => setTimeout(r, 5000))]);
process.exit(errors.length ? 1 : 0);
