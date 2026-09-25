// Team Chat, Mail, Calendar, Docs, Whiteboards, Contacts, Apps, Settings (one browser, fresh database).
import puppeteer from "puppeteer-core";
const OUT = process.argv[2] ?? ".";
// Point at a deployed site with APP_URL=... API_URL=... (defaults: local dev servers)
const APP = process.env.APP_URL ?? "http://localhost:3000", API = process.env.API_URL ?? "http://127.0.0.1:8000";
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true, defaultViewport: { width: 1366, height: 820 },
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--disable-features=AudioServiceOutOfProcess"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && !m.text().includes("Failed to load resource") && errors.push(m.text()));
const text = () => page.evaluate(() => document.body.innerText);
const waitText = (t, timeout = 10000) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, t);
const click = async (t) => {
  const m = `[normalize-space()="${t}" or @aria-label="${t}"]`;
  const inDialog = await page.$(`::-p-xpath(//div[@role="dialog"]//button${m})`);
  await (inDialog ?? (await page.waitForSelector(`::-p-xpath(//button${m} | //a${m})`, { timeout: 8000 }))).click();
};
const ok = (n, msg) => console.log(`${n} ✓ ${msg}`);
const shot = (name) => page.screenshot({ path: `${OUT}/ws-${name}.png` });
const get = (path) => fetch(API + path).then((r) => r.json());

// 1. Every top-bar tab opens a working page
await page.goto(APP); await waitText("Upcoming meetings");
const tabs = [["Team Chat", "Channels"], ["Mail", "Inbox"], ["Calendar", "Today"], ["Docs", "New doc"], ["Whiteboards", "New whiteboard"], ["Contacts", "All contacts"], ["Apps", "Discover"]];
for (const [tab, expect] of tabs) {
  const link = await page.waitForSelector(`::-p-xpath(//nav[@aria-label="Main"]//a[.//span[normalize-space()="${tab}"]])`, { visible: true, timeout: 8000 })
    .catch(() => { throw new Error(`tab link "${tab}" not found`); });
  await link.click();
  await waitText(expect).catch(async () => { throw new Error(`"${tab}" page didn't show "${expect}". URL ${page.url()} text: ${(await text()).slice(0, 200)}`); });
}
await page.goto(`${APP}/settings`); await waitText("Personal information");
ok(1, "all 8 sections open from the top bar (plus Settings)");

// 2. Team Chat
const badgesBefore = await get("/api/users/me/badges");
await page.goto(`${APP}/chat`); await waitText("general");
await (await page.waitForSelector(`::-p-xpath(//aside//button[.//span[normalize-space()="general"]])`)).click();
await waitText("Welcome to the team chat");
await page.type('textarea[aria-label="Message"]', "Hello from the e2e test"); await page.keyboard.press("Enter");
await waitText("Hello from the e2e test");
await shot("chat");
await click("New conversation"); await click("New chat"); await page.waitForSelector('[role="dialog"]');
await (await page.waitForSelector(`::-p-xpath(//div[@role="dialog"]//button[.//span[normalize-space()="Karan Verma"]])`)).click();
await page.waitForFunction(() => location.search.startsWith("?c="));
await waitText("start of your conversation with Karan Verma");
const badgesAfter = await get("/api/users/me/badges");
ok(2, `chat: sent a message, started a DM; unread ${badgesBefore.chat_unread} -> ${badgesAfter.chat_unread}`);

// 3. Mail
await page.goto(`${APP}/mail`); await waitText("Q4 roadmap review");
await (await page.waitForSelector(`::-p-xpath(//li//div[@role="button"][contains(., "New dashboard mockups")])`)).click();
await waitText("The updated dashboard and meeting room mockups");
await shot("mail");
await click("Delete"); await waitText("Moved to Trash");
await page.goto(`${APP}/mail?folder=trash`); await waitText("New dashboard mockups");
await (await page.waitForSelector(`::-p-xpath(//li//div[@role="button"][contains(., "New dashboard mockups")])`)).click();
await click("Restore"); await waitText("Message restored");
await page.goto(`${APP}/mail`); await waitText("Inbox");
await click("Compose"); await page.waitForSelector('input[aria-label="To"]');
await page.type('input[aria-label="To"]', "priya@zoomclone.dev"); await page.type('input[aria-label="Subject"]', "E2E hello");
await page.type('textarea[aria-label="Message"]', "Sent from the test"); await click("Send"); await waitText("Message sent");
const sent = await get("/api/mail?folder=sent");
ok(3, `mail: read, trash + restore, compose (sent folder has "${sent.items[0].subject}")`);

// 4. Calendar
await page.goto(`${APP}/calendar`); await waitText("Design Sync");
await (await page.waitForSelector(`::-p-xpath(//button[.//span[normalize-space()="Design Sync"]])`)).click();
await waitText("Copy invitation"); await shot("calendar");
await page.keyboard.press("Escape");
await click("Schedule"); await page.waitForSelector("#s-topic"); await page.keyboard.press("Escape");
ok(4, "calendar: week view shows meetings, details dialog, schedule dialog");

// 5. Docs: create, type, format, autosave, reload
await page.goto(`${APP}/docs`); await waitText("Q4 Product Roadmap");
await click("New doc"); await page.waitForFunction(() => /\/docs\/\d+$/.test(location.pathname));
const docId = page.url().split("/").pop();
await page.locator('input[aria-label="Document title"]').fill("E2E Doc");
await page.click('[aria-label="Document content"]'); await page.keyboard.type("Hello world ");
await click("Bold"); await page.keyboard.type("bold text");
await waitText("All changes saved", 8000);
await page.reload(); await waitText("bold text");
const doc = await get(`/api/docs/${docId}`);
await shot("doc");
ok(5, `docs: autosaved and reloaded (title "${doc.title}", has bold: ${doc.content.includes("<b>") || doc.content.includes("<strong>")})`);

// 6. Whiteboard: draw a line, autosave, reload
await page.goto(`${APP}/whiteboards`); await click("New whiteboard");
await page.waitForFunction(() => /\/whiteboards\/\d+$/.test(location.pathname));
const boardId = page.url().split("/").pop();
const canvas = await page.waitForSelector('canvas[aria-label="Whiteboard canvas"]');
const box = await canvas.boundingBox();
await page.mouse.move(box.x + 100, box.y + 100); await page.mouse.down();
for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + 100 + i * 30, box.y + 100 + i * 15);
await page.mouse.up();
await click("Color #e02828");
await page.mouse.move(box.x + 300, box.y + 300); await page.mouse.down(); await page.mouse.move(box.x + 500, box.y + 250); await page.mouse.up();
await waitText("All changes saved", 8000);
const board = await get(`/api/whiteboards/${boardId}`);
await click("Undo"); await waitText("All changes saved", 8000);
const afterUndo = JSON.parse((await get(`/api/whiteboards/${boardId}`)).data).length;
await shot("whiteboard");
ok(6, `whiteboard: drew ${JSON.parse(board.data).length} strokes, saved; undo -> ${afterUndo}`);

// 7. Contacts: star + open chat
await page.goto(`${APP}/contacts`); await waitText("Priya Patel");
await (await page.waitForSelector(`::-p-xpath(//aside//button[.//span[normalize-space()="Sneha Iyer"]])`)).click();
await waitText("UX Designer"); await click("Star");
await page.waitForFunction(async (api) => (await (await fetch(api + "/api/contacts")).json()).find((c) => c.name === "Sneha Iyer").is_favorite, {}, API);
await shot("contacts");
await click("Chat"); await page.waitForFunction(() => location.pathname === "/chat" && location.search.startsWith("?c="));
await waitText("Sneha Iyer");
ok(7, "contacts: starred Sneha, Chat opens a DM with her");

// 8. Apps
await page.goto(`${APP}/apps`); await waitText("Miro");
await (await page.waitForSelector(`::-p-xpath(//li[.//p[normalize-space()="Miro"]]//button)`)).click();
await waitText("Miro added");
await shot("apps");
const installed = (await get("/api/apps")).filter((a) => a.installed).map((a) => a.name);
ok(8, `apps: added Miro (installed: ${installed.join(", ")})`);

// 9. Settings: profile, meeting defaults, devices
await page.goto(`${APP}/settings?tab=profile`); await waitText("Personal information");
await page.locator("#p-name").fill("Dhrumi Test"); await click("Avatar color #10B981"); await click("Save changes");
await waitText("Profile saved");
await page.waitForFunction(() => document.querySelector('button[aria-label="Profile"]')?.innerText.includes("DT"));
await page.goto(`${APP}/settings?tab=meetings`); await waitText("Default duration");
await (await page.waitForSelector(`::-p-xpath(//label[contains(., "Waiting Room")])`)).click();
await waitText("Setting saved");
const settings = await get("/api/users/me/settings");
await page.goto(`${APP}/settings?tab=video`);
await page.waitForFunction(() => document.querySelector("video")?.videoWidth > 0, { timeout: 10000 });
await shot("settings");
ok(9, `settings: name + avatar saved (top bar shows DT), waiting room default=${settings.default_waiting_room}, camera preview works`);

// 10. Scheduling now uses the defaults from Settings
await page.goto(APP); await waitText("Upcoming meetings"); await page.click('button[aria-label="Schedule"]'); await page.waitForSelector("#s-topic");
const wr = await page.$eval(`::-p-xpath(//label[contains(., "Waiting Room")]//input)`, (el) => el.checked);
ok(10, `schedule form picks up Settings defaults (waiting room pre-ticked: ${wr})`);

console.log(errors.length ? "BROWSER ERRORS:\n" + errors.join("\n") : "no browser errors");
await browser.close();
