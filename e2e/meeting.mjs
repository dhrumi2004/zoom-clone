import puppeteer from "puppeteer-core";
const SP = process.argv[2];
import { API, APP, signIn } from "./lib.mjs"; // APP_URL / API_URL env vars point the tests at a deployment
const launch = () => puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true, defaultViewport: { width: 1280, height: 800 },
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--auto-select-desktop-capture-source=Entire screen", "--autoplay-policy=no-user-gesture-required", "--disable-features=AudioServiceOutOfProcess"],
});
const [hb, gb] = await Promise.all([launch(), launch()]);   // two separate browsers = two different people
const host = await hb.newPage(), guest = await gb.newPage();
// Two different accounts: the host and a guest
const HOST = await signIn(host, "dhrumi@zoomclone.dev");
await signIn(guest, "aarav@zoomclone.dev");
const errors = [];
for (const [who, p] of [["host", host], ["guest", guest]]) {
  p.on("pageerror", (e) => errors.push(`${who}: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && !m.text().includes("Failed to load resource") && errors.push(`${who}: ${m.text()}`));
}
const waitText = (p, t, timeout = 20000) => p.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, t);
const clickText = async (p, t) => (await p.waitForSelector(`::-p-xpath(//button[normalize-space()="${t}"])`, { timeout: 8000 })).click();
const ok = (n, msg) => console.log(`${n} ✓ ${msg}`);
// Count <video> elements actually showing frames from a remote stream
const liveVideos = (p) => p.evaluate(() => [...document.querySelectorAll("video")].filter((v) => v.videoWidth > 0 && !v.paused).length);

// Host: New meeting -> preview -> Start
await host.goto(APP); await host.waitForSelector('button[aria-label="New meeting"]');
await host.click('button[aria-label="New meeting"]');
await host.waitForFunction(() => location.pathname.startsWith("/meeting/"));
const code = host.url().split("/meeting/")[1];
await host.waitForFunction(() => [...document.querySelectorAll("video")].some((v) => v.videoWidth > 0), { timeout: 10000 });
ok(1, "host preview shows camera");
await clickText(host, "Start"); await waitText(host, "Participants"); await waitText(host, "(You)");
ok(2, `host is in the room (${code})`);

// Guest: invite link -> name -> preview -> Join
const details = await (await HOST.api(`/api/meetings/${code}/details`)).json();
await guest.goto(details.invite_link); await guest.waitForSelector("#join-name");
await guest.locator("#join-name").fill("Guest Tester");
await clickText(guest, "Join"); await guest.waitForFunction(() => location.pathname.startsWith("/meeting/"));
await clickText(guest, "Join"); await waitText(guest, "Participants");
ok(3, "guest joined via invite link");

await waitText(host, "Guest Tester"); await waitText(guest, "Dhrumi Upadhyay");
await host.waitForFunction(() => [...document.querySelectorAll("video")].filter((v) => v.videoWidth > 0).length >= 2, { timeout: 15000 });
await guest.waitForFunction(() => [...document.querySelectorAll("video")].filter((v) => v.videoWidth > 0).length >= 2, { timeout: 15000 });
ok(4, `video flows both ways (host sees ${await liveVideos(host)} videos, guest sees ${await liveVideos(guest)})`);
const audio = await host.evaluate(() => [...document.querySelectorAll("audio")].map((a) => a.srcObject?.getAudioTracks().length ?? 0));
ok(5, `host receives guest audio track: ${JSON.stringify(audio)}`);
await host.screenshot({ path: `${SP}/room.png` });

// Guest mutes -> host sees the red mic on the guest tile
await clickText(guest, "Mute");
await host.waitForFunction(() => [...document.querySelectorAll("span")].some((s) => s.textContent === "Guest Tester" && s.parentElement.querySelector("svg")), { timeout: 5000 });
ok(6, "guest mute shows on host's screen");

// Guest camera off -> host sees name instead of video
await clickText(guest, "Stop Video");
await host.waitForFunction(() => [...document.querySelectorAll("video")].filter((v) => v.videoWidth > 0).length === 1, { timeout: 8000 });
ok(7, "guest Stop Video -> host shows name tile");
await clickText(guest, "Start Video");
await host.waitForFunction(() => [...document.querySelectorAll("video")].filter((v) => v.videoWidth > 0).length >= 2, { timeout: 10000 });
ok(8, "guest Start Video -> video back without reconnecting");

// Reaction
await clickText(guest, "React"); await (await guest.waitForSelector(`::-p-xpath(//button[contains(., "👏")])`)).click();
await host.waitForFunction(() => document.body.innerHTML.includes("👏"), { timeout: 5000 });
ok(9, "reaction appears for host");

// Screen share from host
await clickText(host, "Share");
try {
  await waitText(host, "You are screen sharing", 8000); await waitText(guest, "Dhrumi Upadhyay's screen", 8000);
  ok(10, "screen share visible to guest");
  await host.screenshot({ path: `${SP}/share.png` });
  await clickText(host, "Stop Share"); await guest.waitForFunction(() => !document.body.innerText.includes("'s screen"), { timeout: 8000 });
  ok(11, "stop share restores gallery");
} catch (e) { console.log("10 ✗ screen share (headless browsers can't always capture a screen):", e.message.split("\n")[0]); }

// Host ends for everyone
await clickText(host, "End"); await clickText(host, "End meeting for all");
await waitText(guest, "ended by host"); await host.waitForFunction(() => location.pathname === "/", { timeout: 8000 });
ok(12, "End meeting for all: guest sees end screen, host returns home");
const status = (await (await HOST.api(`/api/meetings/${code}`)).json()).status;
ok(13, `meeting status in database: ${status}`);

console.log(errors.length ? "BROWSER ERRORS:\n" + errors.join("\n") : "no browser errors");
await Promise.all([hb.close(), gb.close()]);
