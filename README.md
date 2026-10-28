# float-site

The public pages for Float, served by GitHub Pages at https://float.rhine.work:
the home page, `privacy/` (the privacy policy the App Store listing and the app link to), `support/`, and
`oauth/consent/`, the consent page Supabase's OAuth server sends people to when an app such as Claude
asks to connect (rynecheow/float#956). Its `ALLOWED_CLIENTS` must list the client ids registered in
Supabase, in step with the Float MCP's `FLOAT_MCP_CLIENTS`; empty, it refuses every app.
Plain HTML and one stylesheet; no build step.

`oauth/consent/vendor/supabase-js-2.117.3.umd.js` is `dist/umd/supabase.js` from the npm package
`@supabase/supabase-js@2.117.3`, unchanged (sha256 `d6a5c4414a5d4ce646d9c1de223aa7067d3ff664c15394ffeb7fcffc763354a3`), so the consent page loads no script
from another origin. Its Content-Security-Policy allows scripts from this site and connections to Float's
Supabase project only.

`oauth/claude.png` is Claude's app icon from claude.ai (`https://claude.ai/images/claude_app_icon.png`),
scaled to 128 px. Register Claude's OAuth client with `logo_uri` `https://float.rhine.work/oauth/claude.png`
so the consent page shows it; a logo from any other site isn't shown (the page's CSP allows images from
here only).
