# Jumino ♡ — a cosy styling diary

Static HTML/CSS/JS app backed by Firebase (Auth + Firestore + Storage) with optional Anthropic AI and OpenWeather. UI uses kaomoji in place of emoji throughout.

## Quickstart

1. `npm i -g serve` (or `python3 -m http.server`)
2. Create a Firebase project → enable Auth (Email/Password), Firestore, Storage.
3. Copy `firebaseConfig` into `js/config.js`.
4. Paste `firebase-rules.txt` contents into Firestore and Storage rules.
5. `serve .` and open `http://localhost:3000`.

## What works

- Signup/login (username@jumino.local), profile picture upload, per-user data.
- Home page checklist, synced with AI chat, completed items drop to the bottom.
- Colour Analysis — drape session with 22 fabrics, peel animation, verdicts, compare mode; AI feedback via Anthropic with heuristic fallback; saved palette.
- Body Analysis — apple form, envelope reveal, tabbed suggestions.
- Face Analysis — same pattern with face-specific tabs.
- Wardrobe — colour-customisable closet, 7 categories, subcategory filter, search, camera + upload, edit, delete.
- Outfits — AI chat using your wardrobe + analyses + weather; essentials have OK buttons that add to the checklist.
- Profile — edit username/country/picture, change password, delete account.

## The donkey (Jumino)

Jumino is the site's mascot and guide. It is a chibi donkey drawn as a hand-authored inline SVG (`js/donkey.js`, function `donkeySVG(mood, size)`). It is not an image asset — it's built from paths and ellipses, so it scales cleanly, inherits crisp rendering on every device, and needs no network fetch.

### Appearance

Jumino shares the same visual identity everywhere, so users recognise the character at a glance:

- **Tiny chibi proportions** — large head, small rounded body.
- **Long floppy ears** (`#9fb0c7`) — rotated ellipses on either side of the head.
- **Big round head** (`#c8d4e3`) with a pale muzzle (`#efe6d6`).
- **Gentle expression** — two dark eyes, two soft eyebrows, tiny nostrils.
- **Signature mint-green polka-dot neckerchief** (`#bfe3d0` with three white dots). This is drawn in every mood and every appearance.
- **Signature brown envelope crossbody bag** with mint polka dots and a flap. Also drawn in every appearance.
- **Short stubby legs** in the same dusty blue-grey as the ears.

The neckerchief and envelope bag are the two visual anchors — they never change, so the character always reads as "Jumino" even when the mood shifts.

### Moods

The `mood` argument controls the expression and body pose. Six moods are supported:

| Mood | Expression | When it's used |
|---|---|---|
| `idle` | Soft eyes, level brows | Auth screen, home hero, chat avatars, after a drape session settles |
| `think` | Head tilted, brows angled | While the drape session is initialised before a colour is picked |
| `point` | Eyes wider, head tilted slightly forward | When a fabric drape is applied, drawing attention to the new colour |
| `cheer` | Head tilted the other way, bright eyes | Home page hero greeting |
| `present` | Bright eyes plus a small hand-held sign that reads "here!" | When an outfit recommendation is shown in the chat |
| `sad` | Brows lowered, eyes softer | Reserved — currently unused, available for future error states |

The tilt changes automatically per mood via the SVG `transform` attribute, so the pose shifts even at small sizes.

### Where Jumino appears

| File / location | Mood | Size | Context |
|---|---|---|---|
| `index.html` + `js/app.js` bootstrap | `idle` | 110 | Floating over the sign-up/login card on the auth screen |
| `js/app.js` `mountHome` | `cheer` | 150 | Beside the greeting bubble on the home page hero |
| `js/drapes.js` init | `think` | 90 | Pinned to the top-right of the camera preview before the camera starts |
| `js/drapes.js` after camera start | `idle` | 90 | Same corner, relaxed while waiting for a drape |
| `js/drapes.js` when a drape applies | `point` | 90 | Same corner, pointing at the fabric |
| `js/app.js` `outfitsView` | `idle` | 36 | Inline avatar before the first chat message |
| `js/app.js` `appendAI` | `idle` | 32 | Inline avatar in every AI reply |
| `js/app.js` `appendOutfit` | `present` | 40 | Inline avatar in each outfit recommendation card |

### What the donkey *does* (per feature)

**Auth screen**
- Sits above the sign-up/login card as a welcoming presence.
- Stays in `idle` mood while the user types.

**Home page**
- Greets the user in `cheer` mood next to a speech bubble that says "Hi {username}! Ready for a styling adventure?".
- The speech bubble uses the same dotted-border scrapbook style as the rest of the site.

**Colour Analysis**
- Appears in the corner of the camera preview area.
- Starts in `think` — signalling that the session is warming up.
- Switches to `idle` once the camera is live.
- Switches to `point` every time a new fabric drape is applied, visually guiding the user's eye to the colour.
- Returns to `idle` when the user stops interacting.

**Outfit chat**
- The very first AI bubble includes a small `idle` donkey as an avatar, so the user sees who they're talking to.
- Every AI reply carries the same `idle` avatar inline.
- When an outfit is recommended, the header switches to a larger `present` donkey with a sign — a small visual cue that a suggestion is being handed over.

### The donkey's voice

The donkey's dialogue is generated by the AI itself (Anthropic via `js/ai.js`). The system prompt instructs it to be:

- Gentle, warm and specific.
- Never judgemental about body, face or skin.
- Honest about its own limits — it never claims to physically measure undertones from a photo.
- Never fabricating wardrobe items — only ever recommends clothing that actually exists in the user's saved wardrobe.

The heuristic fallback (when no AI key is configured) uses the same voice, and always includes the note "(AI not configured)" so the user knows it isn't real AI output.

### The donkey's accessories as UI motifs

The neckerchief and envelope bag aren't just decoration — they echo the envelope animation used in Body and Face analysis:

- The **envelope reveal** in Body/Face analysis is a direct callback to the donkey's envelope bag: a brown envelope with mint polka dots slides in, the user taps Open, and the result card peels out.
- The **mint polka dot pattern** appears on the wardrobe's floating swatches, the fabric drape overlay, and the tag chips in the To Bring checklist.

This creates visual continuity — the donkey's accessories "leak" into the UI so the whole site feels like it lives inside the donkey's world.

### Adding a new mood

To add a new expression (e.g. `sleepy`, `wink`, `surprised`):

1. Open `js/donkey.js`.
2. Inside `donkeySVG`, extend the ternary chains for `tilt`, `eyeRy`, `browY`, or add new optional SVG groups.
3. Every caller that uses `mountDonkey(el, "newmood")` will pick it up automatically.

No other file needs to change — the mascot is centralised in one function by design, so there's only ever one source of truth for what Jumino looks like.

## Kaomoji

All UI emoji have been replaced with kaomoji. The relevant files are `index.html`, `js/drapes.js` and `js/app.js`. Kaomoji are plain UTF-8 text, so no extra assets are required. If a kaomoji ever looks cramped inside a button, wrap it in `<span class="hand" style="font-size:1.1em">…</span>`.

## AI notes

- The Anthropic key lives client-side in this demo. Do not deploy this publicly with a live key. Move `requestOutfit` and `requestColourFeedback` in `js/ai.js` to a Cloud Function for production.
- When `ANTHROPIC_KEY` is empty, both functions fall back to labelled heuristics with the note "(AI not configured)". Never mistaken for real AI.
- The still photo sent with colour feedback is never saved — it exists only in memory for the API call.

## Testing

- Signup/login/logout — data persists.
- Two accounts see separate data.
- Drape 3+ colours → AI feedback appears → palette saves.
- Empty ANTHROPIC_KEY → heuristic feedback shows clearly.
- Body/Face → envelope animation plays.
- Wardrobe → camera and upload both save; edit and delete work.
- Outfits → OK essential appears in To Bring.
- Profile → username change reflects in nav avatar.
- Donkey appears on auth screen, home page, colour analysis corner, and outfit chat avatars.
