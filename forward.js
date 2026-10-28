// Supabase's sign-in email has a fallback link ("Sign in with this link instead"). The app asks for no
// redirect, so that link lands here, on the Site URL, carrying the sign-in in the query or the
// fragment. Hand it to the app unchanged, through its float:// scheme. Nothing here reads, keeps or
// sends the token anywhere else; any other visit to this page is left alone.
const AUTH_PARAMS = ["access_token", "refresh_token", "code", "token_hash", "type", "error", "error_code", "error_description"];

/** The float:// URL for this page's auth parameters, or null when it carries none. */
export function forwardTarget(search, hash) {
  const query = new URLSearchParams(search.replace(/^\?/, ""));
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const carries = AUTH_PARAMS.some((name) => query.has(name) || fragment.has(name));
  return carries ? `float://${search}${hash}` : null;
}

const target = forwardTarget(location.search, location.hash);
if (target) {
  const link = document.getElementById("open-float");
  link.href = target;
  document.getElementById("forward").hidden = false;
  if (!globalThis.__FLOAT_FORWARD_TEST__) location.replace(target);
}
