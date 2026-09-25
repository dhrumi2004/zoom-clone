import puppeteer from "puppeteer-core";
const SP = process.argv[2];
const APP = "http://localhost:3000", API = "http://127.0.0.1:8000";
const launch = () => puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true, defaultViewport: { width: 1280, height: 800 },
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--disable-features=AudioServiceOutOfProcess"],
});
const [hb, gb, g2b] = await Promise.all([launch(), launch(), launch()]);
const host = await hb.newPage(), guest = await gb.newPage(), guest2 = await g2b.newPage();
const errors = [];
for (const [who, p] of [["host", host], ["guest", guest], ["guest2", guest2]]) {
  p.on("pageerror", (e) => errors.push(`${who}: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && !m.text().includes("Failed to load resource") && errors.push(`${who}: ${m.text()}`));
}
const waitText = (p, t, timeout = 15000) => p.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, t);
const clickText = async (p, t) => {
  const match = `[normalize-space()="${t}" or @aria-label="${t}"]`;
  const inDialog = await p.$(`::-p-xpath(//div[@role="dialog"]//button${match})`);
  (inDialog ?? (await p.waitForSelector(`::-p-xpath(//button${match})`, { timeout: 8000 }))).click();
};
const ok = (n, msg) => console.log(`${n} ✓ ${msg}`);
const post = (path, body) => fetch(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

// A scheduled meeting with the waiting room on
const start = new Date(Date.now() + 10 * 60_000).toISOString();
const m = await post("/api/meetings", { title: "Waiting Room Test", scheduled_start: start, duration_min: 30, settings: { waiting_room: true } });

// Host starts it
await host.goto(APP);
await host.evaluate((code) => sessionStorage.setItem(`zoom:join:${code}`, JSON.stringify({ displayName: "Dhrumi Upadhyay", asHost: true, audioOn: true, videoOn: true })), m.meeting_code);
await host.goto(`${APP}/meeting/${m.meeting_code}`); await clickText(host, "Start"); await waitText(host, "(You)");
ok(1, "host started the meeting");

// Guest joins -> waiting room
const joinAsGuest = async (p, name) => {
  await p.goto(m.invite_link); await p.waitForSelector("#join-name"); await p.locator("#join-name").fill(name);
  await clickText(p, "Join"); await p.waitForFunction(() => location.pathname.startsWith("/meeting/")); await clickText(p, "Join");
};
await joinAsGuest(guest, "Guest Tester");
await waitText(guest, "Please wait, the meeting host will let you in soon.");
ok(2, "guest is held in the waiting room");
await waitText(host, "has entered the waiting room");
ok(3, "host sees 'Guest Tester has entered the waiting room'");
await clickText(host, "Admit"); await waitText(guest, "Participants"); await waitText(host, "Guest Tester");
ok(4, "host admits -> guest enters the meeting");

// Chat both ways + unread badge
await clickText(guest, "Chat"); await guest.waitForSelector('textarea[aria-label="Chat message"]');
await guest.type('textarea[aria-label="Chat message"]', "Hello from guest"); await guest.keyboard.press("Enter");
await host.waitForFunction(() => [...document.querySelectorAll("footer span")].some((s) => s.textContent === "1"), { timeout: 8000 });
ok(5, "host sees unread chat badge");
await clickText(host, "Chat"); await waitText(host, "Hello from guest");
await host.type('textarea[aria-label="Chat message"]', "Hi guest!"); await host.keyboard.press("Enter");
await waitText(guest, "Hi guest!");
ok(6, "chat works both ways (Enter to send)");
await host.screenshot({ path: `${SP}/chat.png` });

// Host controls from the Participants panel
await clickText(host, "Participants"); await waitText(host, "Guest Tester");
const guestRow = await host.waitForSelector(`::-p-xpath(//li[contains(., "Guest Tester")])`);
await guestRow.hover(); await clickText(host, "Mute");
await waitText(guest, "You have been muted by the host"); await guest.waitForSelector('footer button[aria-label="Unmute"]');
ok(7, "host mutes guest");
await guestRow.hover(); await clickText(host, "Ask to Unmute");
await waitText(guest, "The host would like you to unmute"); await clickText(guest, "Unmute");
await guest.waitForSelector('footer button[aria-label="Mute"]');
ok(8, "host asks to unmute -> guest accepts");
await host.screenshot({ path: `${SP}/participants.png` });
await clickText(host, "Mute All"); await host.waitForSelector('[role="dialog"]'); await clickText(host, "Mute All");
await guest.waitForSelector('footer button[aria-label="Unmute"]', { timeout: 8000 });
ok(9, "Mute All mutes the guest");

// Second guest: host removes them from the waiting room
await joinAsGuest(guest2, "Second Guest");
await waitText(guest2, "Please wait");
await waitText(host, "Waiting Room (1)");
const waitRow = await host.waitForSelector(`::-p-xpath(//div[contains(., "Second Guest")]/button[normalize-space()="Remove"])`);
await waitRow.click(); await waitText(guest2, "removed");
ok(10, "host removes someone from the waiting room");

// Remove the admitted guest
await guestRow.hover();
await (await host.waitForSelector(`::-p-xpath(//button[@aria-label="More options for Guest Tester"])`)).click();
await clickText(host, "Remove"); await host.waitForSelector('[role="dialog"]'); await clickText(host, "Remove");
await waitText(guest, "You have been removed from this meeting by the host");
await host.waitForFunction(() => !document.body.innerText.includes("Guest Tester"), { timeout: 8000 });
ok(11, "host removes guest from the meeting");

const rejoin = await post(`/api/meetings/${m.meeting_code}/verify`, { passcode: m.passcode });
ok(12, `meeting still live for others: ${rejoin.status}`);
console.log(errors.length ? "BROWSER ERRORS:\n" + errors.join("\n") : "no browser errors");
await Promise.all([hb.close(), gb.close(), g2b.close()]);
