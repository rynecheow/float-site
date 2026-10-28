# float-site

The public pages for Float, served by GitHub Pages at https://float.rhine.work:
the home page, `privacy/` (the privacy policy the App Store listing and the app link to), `support/`, and
`oauth/consent/`, the consent page Supabase's OAuth server sends people to when an app such as Claude
asks to connect (rynecheow/float#956). Its `ALLOWED_CLIENTS` must list the client ids registered in
Supabase, in step with the Float MCP's `FLOAT_MCP_CLIENTS`; empty, it refuses every app.
Plain HTML and one stylesheet; no build step.
