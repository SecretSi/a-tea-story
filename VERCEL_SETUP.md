# Deploy A Tea Story with NPC voice on Vercel

The current public site is on GitHub Pages. GitHub Pages serves the HTML, CSS, and browser JavaScript, so it cannot run the private API code or keep an ElevenLabs key secret. This project adds Vercel API functions and a client-side voice player. GitHub Pages will continue to serve the old version until you choose to use the Vercel deployment.

## What this setup provides

- `/api/auth/config` supplies the Supabase project URL and public anon key to the existing sign-in screen.
- `/api/agents/speech` checks the caller's Supabase sign-in and sends text to ElevenLabs. The ElevenLabs API key stays in Vercel's server environment.
- NPC chat falls back to the game's built-in teacher replies when the existing `/api/agents/chat` service is unavailable. That fallback is rule-based; it does not add a language model.

## Deploy

1. Import `SecretSi/a-tea-story` into Vercel, keep `main` as the production branch, and use the repository root with the "Other" framework preset. Vercel should create a Preview deployment for this pull request’s `codex/vercel-elevenlabs-voice` branch.
2. In Vercel, open the project’s **Settings → Environment Variables** and add these variables for the Preview environment first:
   - `ELEVENLABS_API_KEY`: your ElevenLabs key.
   - `ELEVENLABS_MALE_VOICE_ID`: the male voice ID used by 阿德 (Ade).
   - `ELEVENLABS_FEMALE_VOICE_ID`: the female voice ID used by 小陳 (Xiaochen).
   - Optional: `ELEVENLABS_VOICE_ID` as a fallback voice if one of the character-specific IDs is missing.
   - `SUPABASE_URL`: the project URL from Supabase project settings.
   - `SUPABASE_ANON_KEY`: the public anon/publishable key from Supabase project settings.
3. Redeploy the preview after saving the variables. Open the preview URL and sign in; NPC replies should offer a **Listen** button and attempt to play automatically.
4. In Supabase **Authentication → URL Configuration**, add the Vercel preview URL to the allowed redirect URLs. For production, add the final Vercel URL too.
5. When the preview works, merge the pull request and promote the Vercel deployment. The GitHub Pages URL will remain separate unless you later configure a custom domain.

Do not put `ELEVENLABS_API_KEY` in `game.js`, `index.html`, GitHub files, or chat. Enter it only in Vercel's Environment Variables screen. The Supabase anon key is the browser-facing key; never use a Supabase service-role/secret key here.

## Current limits

The existing repository has no `/api/agents/chat` implementation or AI-provider configuration. The browser therefore uses the built-in teacher replies when that route is unavailable. ElevenLabs voices those replies; a separate language-model service would be needed for open-ended AI conversation.
