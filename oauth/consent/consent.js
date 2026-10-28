// Float's OAuth consent page (rynecheow/float#956, "Details for A"). Supabase's OAuth 2.1 server sends
// the person here with ?authorization_id=…; they sign in with their emailed code, see which app is
// asking and what it can do, and approve or deny. Only the treasurer of a household may connect an
// app (a demo person can't be treasurer, so that covers demo households), and only a client on the
// allowlist below: every other client is refused here as the MCP server refuses it.
// supabase-js 2.117.3 is vendored beside this file (vendor/, sha256 in the README) and loaded first by
// index.html, so nothing runs from another origin; its UMD build defines the global `supabase`.
const { createClient } = globalThis.supabase ?? {};

const SUPABASE_URL = "https://jfilqmwsnjskfgljspwc.supabase.co";
// The publishable key is public by design: it names the project, and row-level security decides
// what anyone can read.
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_FQwCuXH-XV4wqU11pmLh2A_B-5qjf_z";
// Client ids registered in Supabase (Authentication > OAuth Server > Clients) that may ask. Kept in
// step with the MCP server's FLOAT_MCP_CLIENTS. Empty refuses every client.
const ALLOWED_CLIENTS = [
  "0f186468-70c9-45ef-ae2d-4c4bda05401c", // Claude (registered 28 Oct 2026)
];

const $ = (id) => document.getElementById(id);
const views = ["loading", "signin", "code", "consent", "refused", "done"];

export function show(view, message) {
  for (const v of views) $(v).hidden = v !== view;
  if (message !== undefined) $(`${view}-message`).textContent = message;
  const heading = $(view).querySelector("h1, h2");
  if (heading) heading.focus();
}

/** Why this person or client may not connect, or null when they may. Pure, so it can be tested. */
/** Whether an authorization_id has a shape Supabase issues: a UUID or a URL-safe token. */
export function validAuthorizationId(id) {
  return typeof id === "string" &&
    (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || /^[A-Za-z0-9_-]{16,128}$/.test(id));
}

/** The logo URL when it's on this site, else null: anything else would break the CSP. */
export function sameOriginImage(uri, origin = location.origin) {
  if (!uri) return null;
  try {
    const url = new URL(uri, origin);
    return url.origin === origin ? url.href : null;
  } catch {
    return null;
  }
}

export function refusal(person, clientId, allowed = ALLOWED_CLIENTS) {
  if (!allowed.includes(clientId)) return "Float doesn't know this app, so it can't connect. Nothing was shared.";
  if (!person) return "This email isn't a member of a Float household.";
  if (!person.is_treasurer) return "Only your household's treasurer can connect an app to Float.";
  return null;
}

async function main() {
  // Never inside another page's frame: a framed consent page could be clickjacked into approving.
  if (window.top !== window.self) {
    show("refused", "Open this page on its own to connect an app to Float.");
    return;
  }
  const authorizationId = new URLSearchParams(location.search).get("authorization_id");
  if (!authorizationId) {
    show("refused", "This page opens from an app asking to connect to Float. There's nothing to approve here.");
    return;
  }
  if (!validAuthorizationId(authorizationId)) {
    show("refused", "This link isn't a valid request to connect. Start connecting again from the app.");
    return;
  }
  // The session lives in this tab only, and ends locally once the person has decided.
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, detectSessionInUrl: false, storage: window.sessionStorage },
  });
  let email = "";

  async function load() {
    show("loading");
    const { data: details, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
    if (error) {
      show("refused", "This request has expired or isn't valid. Start connecting again from the app.");
      return;
    }
    // Already approved before: Supabase hands back where to go.
    if (!details.authorization_id && details.redirect_url) {
      location.assign(details.redirect_url);
      return;
    }
    const { data: people, error: personError } = await supabase.rpc("current_person");
    const person = personError ? null : (people ?? [])[0] ?? null;
    const why = refusal(person, details.client.id);
    if (why) {
      $("refused-deny").hidden = false;
      show("refused", why);
      return;
    }
    $("client-name").textContent = details.client.name;
    // The client's logo, only from this site (the CSP allows images from here alone).
    const logo = sameOriginImage(details.client.logo_uri);
    if (logo) {
      $("client-logo").src = logo;
      $("client-logo").hidden = false;
    }
    $("signed-in-as").textContent = details.user.email;
    show("consent");
  }

  async function decide(approve) {
    for (const b of document.querySelectorAll("button")) b.disabled = true;
    const call = approve ? supabase.auth.oauth.approveAuthorization : supabase.auth.oauth.denyAuthorization;
    const { data, error } = await call.call(supabase.auth.oauth, authorizationId, { skipBrowserRedirect: true });
    if (error || !data?.redirect_url) {
      for (const b of document.querySelectorAll("button")) b.disabled = false;
      show("refused", "That didn't go through. Start connecting again from the app.");
      return;
    }
    show("done", approve ? "Connected. Taking you back to the app…" : "Not connected. Taking you back to the app…");
    // Local only: the global default would also sign the person's Float apps out.
    await supabase.auth.signOut({ scope: "local" });
    location.assign(data.redirect_url);
  }

  $("signin-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    email = $("email").value.trim();
    $("signin-error").textContent = "";
    // Never creates an account: only people already in a household get a code.
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) {
      $("signin-error").textContent = "That email can't sign in to Float.";
      return;
    }
    show("code", `We emailed a 6-digit code to ${email}.`);
  });

  $("code-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    $("code-error").textContent = "";
    const { error } = await supabase.auth.verifyOtp({ email, token: $("otp").value.trim(), type: "email" });
    if (error) {
      $("code-error").textContent = "That code didn't work. Check it, or go back and send a new one.";
      return;
    }
    await load();
  });

  $("code-back").addEventListener("click", () => show("signin"));
  $("approve").addEventListener("click", () => decide(true));
  $("deny").addEventListener("click", () => decide(false));
  $("refused-deny").addEventListener("click", () => decide(false));
  $("sign-out").addEventListener("click", async () => {
    await supabase.auth.signOut({ scope: "local" });
    show("signin");
  });

  const { data } = await supabase.auth.getSession();
  if (data.session) await load();
  else show("signin");
}

if (typeof document !== "undefined" && !globalThis.__FLOAT_CONSENT_TEST__) main();
