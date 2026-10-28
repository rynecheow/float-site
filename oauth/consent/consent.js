// Float's OAuth consent page (rynecheow/float#956, "Details for A"). Supabase's OAuth 2.1 server sends
// the person here with ?authorization_id=…; they sign in with their emailed code, see which app is
// asking and what it can do, and approve or deny. Only the treasurer of a household may connect an
// app (a demo person can't be treasurer, so that covers demo households), and only a client on the
// allowlist below: every other client is refused here as the MCP server refuses it.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm";

const SUPABASE_URL = "https://jfilqmwsnjskfgljspwc.supabase.co";
// The publishable key is public by design: it names the project, and row-level security decides
// what anyone can read.
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_FQwCuXH-XV4wqU11pmLh2A_B-5qjf_z";
// Client ids registered in Supabase (Authentication > OAuth Server > Clients) that may ask. Kept in
// step with the MCP server's FLOAT_MCP_CLIENTS. Empty refuses every client.
const ALLOWED_CLIENTS = [];

const $ = (id) => document.getElementById(id);
const views = ["loading", "signin", "code", "consent", "refused", "done"];

export function show(view, message) {
  for (const v of views) $(v).hidden = v !== view;
  if (message !== undefined) $(`${view}-message`).textContent = message;
  const heading = $(view).querySelector("h1, h2");
  if (heading) heading.focus();
}

/** Why this person or client may not connect, or null when they may. Pure, so it can be tested. */
export function refusal(person, clientId, allowed = ALLOWED_CLIENTS) {
  if (!allowed.includes(clientId)) return "Float doesn't know this app, so it can't connect. Nothing was shared.";
  if (!person) return "This email isn't a member of a Float household.";
  if (!person.is_treasurer) return "Only your household's treasurer can connect an app to Float.";
  return null;
}

async function main() {
  const authorizationId = new URLSearchParams(location.search).get("authorization_id");
  if (!authorizationId) {
    show("refused", "This page opens from an app asking to connect to Float. There's nothing to approve here.");
    return;
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, detectSessionInUrl: false },
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
    await supabase.auth.signOut();
    show("signin");
  });

  const { data } = await supabase.auth.getSession();
  if (data.session) await load();
  else show("signin");
}

if (typeof document !== "undefined" && !globalThis.__FLOAT_CONSENT_TEST__) main();
