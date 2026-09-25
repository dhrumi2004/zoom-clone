// Shared test helpers: sign a browser in as a (demo) account and call the API as that account.
export const APP = process.env.APP_URL ?? "http://localhost:3000";
export const API = process.env.API_URL ?? "http://127.0.0.1:8000";
export const DEMO_PASSWORD = "zoom1234";

/**
 * Signs `page` in as `email` (the token is put in localStorage before the app loads) and returns
 * `api(path, init)` for calling the backend as that user, like fetch() with the session token.
 */
export async function signIn(page, email, password = DEMO_PASSWORD) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Couldn't sign in as ${email}: ${res.status}`);
  const { token } = await res.json();
  if (page) await page.evaluateOnNewDocument((t) => localStorage.setItem("zoom:token", t), token);
  const api = (path, init = {}) =>
    fetch(API + path, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init.headers } });
  return { token, api };
}
