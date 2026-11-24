# من اسمه نصيب — DSC site, Arabic Language Day

The Data Science Club (DSC) at Al Yamamah University, Khobar campus, takes part in the university's
Arabic Language Day celebration on **Wednesday 25 Nov 2026** (held mainly in the university theatre).
Amr (club president, Software Engineering student) owns this project. Club friends contribute through the public repo
https://github.com/AmrShaar13006/dsc-name-quote (MIT, see `CONTRIBUTING.md`).
Reply in Arabic, to Amr and to contributors. Code identifiers in English; code comments and all UI copy in Arabic.

## The site: three experiences

There is **no booth or corner**. This is a standalone public website that people open on their own phones from a QR code
(or any link), mostly on **mobile data**. Design mobile-first.

| # | Experience | State |
|---|---|---|
| 1 | **من اسمه نصيب**: the visitor's name → meaning, root, theme → a fitting verse, on a card with the name in Arabic calligraphy | Engine, data, 76 verses from Wikisource (27 poets) and the **visitor page** (`ui/index.html`) are done. The test bench moved to `ui/test.html`. |
| 2 | **سحابة كلمات حية**: a live word cloud | **Postponed** until the concept, form and use are developed further |
| 3 | **شاعر أم آلة؟**: visitors guess whether a verse is by a poet or a machine | **Built** (`ui/game.html`): 34 machine verses written by Claude, each meter-checked, plus the 76 poets' verses from Wikisource. The machine verses are **not yet reviewed by a human**. |

Decisions settled with Amr (23 Nov):
- Visitors use their own phones via QR. Nothing runs on club hardware.
- The card is a **high-resolution PNG**: a 1080×1920 story layout drawn on canvas at ×2 (2160×3840, about 0.5 MB).
  On phones, «احفظ البطاقة» opens a sheet showing the image (long-press to save; works in in-app browsers too), plus share and download. On desktop it downloads directly.
- شاعر أم آلة؟: generate as many machine verses as possible **before** the event. They must be reliable and match human eloquence and precision, so the challenge is genuinely hard.
  Store them as static data with no live AI calls. Start with about 10–12 poet/machine pairs. Who reviews them is decided later.
- Name calligraphy: Amr wants decorative, professional, artistic calligraphy, **not** the familiar, widely used Arabic fonts, and is still looking for the right tool or method.
  For now the visitor picks from the `STYLES` table in `ui/index.template.html`:
  - Gulzar (نستعليق), the default;
  - Qahiri (manuscript Kufi);
  - Aref Ruqaa.

  The card's ornament is an octagram built from two squares (the DSC square module).
  Research notes (23 Nov):
  - No free Thuluth or Diwani font with a confirmed licence and good quality was found. The Layla fonts have an unverified licence and missing glyphs.
  - Commercial options: Boutros Thuluth (web licence on request) and JH Diwani.
  - The «Ink» colour fonts (Aref Ruqaa Ink, Reem Kufi Ink) use COLRv1, which iPhones do not render. Avoid them.
- شاعر أم آلة؟ rules (24 Nov):
  - 10 rounds per game. Machine verses are 4–6 of them, at random, so players can't count the rest.
  - Verses the visitor already saw are avoided next time (stored on the visitor's device).
  - **Both sides are shown without diacritics or punctuation.** The poets' verses are only partly vocalised (as in their source), so diacritics would reveal the source.
  - The reveal names the model honestly («كتبه نموذج الذكاء الاصطناعي Claude قبل الفعالية»). Human verses get the poet + a link to the poem on Wikisource.
  - Zero AI calls at runtime.
  - The page must not claim the machine verses were reviewed by the team until they are (status «معتمد»).
- Fonts still load from Google Fonts (visitors are online). The Arabic subsets are Gulzar ~200 KB, Amiri ~200 KB, Plex ~130 KB and Qahiri 6 KB. The page itself is ~110 KB with all data inlined.
- Names never leave the device: everything resolves client-side, and the page says so.

## Commands (Amr is on Windows, PowerShell)

```powershell
npm test                  # build data + export review sheets + 52 tests (must stay green)
npm run ui                # build ui/index.html (visitor page) and ui/test.html (test bench), engine + data inlined
npm run serve             # preview ui/ at http://localhost:5173 (scripts/serve.js, no dependencies)
npm run report            # root-fallback accuracy report
node scripts/import-review.js <sheet.csv>   # bring a reviewed sheet back (names or quotes, auto-detected)
node scripts/wikisource.js find <candidates.csv> [out.json]   # look up candidate verses on Wikisource (network, ~1 request / 2 s)
node scripts/wikisource.js check   # re-verify every verse in quotes.csv against its Wikisource page
npx vercel --prod         # deploy (folder is linked to team bada-creative-house, project dsc-name-quote)
```

Live: https://dsc-name-quote.vercel.app (`/` visitor page, `/test.html` test bench, `/api/diwan` proxy).
No dependencies: plain Node (ES modules) and `node:test`. Do not add packages unless they earn their place.

## Repo map

| Path | What it is |
|---|---|
| `data/*.csv` | **Source of truth.** `names.csv` (357 names), `roots.csv` (187 roots), `divine.csv` (38 divine names), `themes.csv` (14 themes), `quotes.csv` (76 verses from Wikisource, all status مقترح), `blocked.csv` (222 words never written on a card: insults, vulgar, religious, racial, sectarian, extremism, religious/national/tribal identities, animals, ambiguous) |
| `scripts/build.js` | Parses and validates the CSVs. Fails with line numbers. Writes `src/data.js` and `data/bundle.json` |
| `src/engine.js` | The engine: `createEngine(data)` returns `{ resolve, quoteFor, pickQuote, quotesByTheme, lookup, findRoot, themes }` |
| `scripts/wikisource.js` | Finds and verifies verses on Arabic Wikisource: search, read the poem page (`{{ترويسة|مؤلف=…}}`, `{{أبيات|…\…}}`), match the letters without diacritics, confirm the poet |
| `src/verse.js`, `api/diwan.js`, `scripts/diwan-probe.js` | **Legacy** from the AlDiwan period (verse splitter, API proxy, probe). Nothing in the content pipeline uses them now |
| `ui/index.template.html` → `scripts/build-ui.js` → `ui/index.html` | **Visitor page** (experience 1): input → card drawn on canvas → PNG. Fonts in the `STYLES` table |
| `ui/test.template.html` → `ui/test.html` | Test bench for the team (single name + batch). Same injection |
| `ui/poster.html` | Posters drawn on canvas, for both experiences (`#name`, `#game`): each gets a 16:9 screen slide (3840×2160, ink) and an A4 print poster (2480×3508, cream), with download buttons. The name sample card is drawn by loading `index.html` in a hidden iframe and calling its own `drawCard`. The game poster shows a mock round on a phone screen; its verse is `GAME_VERSE` (m01), read from `game.html`'s own `POOL`, so it follows the data and is never revealed. Uses `ui/qr.svg` and `ui/game-qr.svg`, which `build-ui.js` copies from `qr/` |
| `data/machine.csv` | Machine verses for شاعر أم آلة؟, fully vocalised. The build checks each one's meter |
| `src/prosody.js` | Meter checker (عروض): fully vocalised hemistich → متحرك/ساكن → syllables → 9 meters. Strict: an unvoweled consonant is an error. Handles وصل, ال شمسية/قمرية, مد, التقاء الساكنين, صلة هاء الضمير, إشباع, dagger alef. 296/296 single-word mutations of the verses fail it |
| `src/game.js` | Game logic: `plain` (strip marks), `gamePool`, `pickRounds`, `verdict`. Import-free, injected into `ui/game.html` |
| `ui/game.template.html` → `ui/game.html` | The game page and its result card (PNG). Gets only themes, quotes and machine data (40 KB) |
| `scripts/serve.js` | Local static server for previewing `ui/`. Never serve the project root: it would expose `.env.local`. Dotfiles are refused anyway |
| `qr/` ← `scripts/make-qr.py` | QR codes, level H, with and without the ember step mark, SVG + PNG: `dsc-name-quote-qr` → the site, `dsc-game-qr` → `/game.html`. Usage: `python scripts/make-qr.py [dir] [url] [name]`. The script decodes each code with two decoders (classic and Aruco). It sweeps 8–60% sizes with blur and JPEG. The classic decoder alone misreads synthetic images at exact half-pixel module sizes; this is not a defect in the code. It is Python + OpenCV + Pillow, not part of the Node build; rerun it if the URL changes |
| `scripts/export-review.js` / `import-review.js` | Round trip with the reviewers' Sheet |
| `review/*.csv` | Exported reviewer copies (Arabic headers, theme labels) |
| `test/*.test.js` | Engine, quotes and verse-splitting tests |

Generated, never edit by hand, git-ignored: `src/data.js`, `data/bundle.json`, `ui/index.html`, `ui/test.html`, `ui/game.html`, `ui/figures.html`, `ui/qr.svg`, `ui/game-qr.svg`.

## Semantic attributes and historical figures (Phase A, added 25 Nov)

Two reviewed datasets, same workflow as `quotes.csv` (status مقترح/معتمد/مستبعد, exported to `review/*.csv`, re-imported via `import-review.js`):

- `data/attributes.csv`: `name,attribute,relation,justification,source,status,review_note`. «ما يستوحيه الاسم من صفات» — attributes derived from each name's already-reviewed **meaning**, never from its root alone (سعيد and مساعد share root س-ع-د but have different attributes). `relation` is one of مباشر/مرتبط/ثقافي/تأويل أدبي (`build.js` rejects any other value). `name` must match a dictionary canonical name/variant or an «عبد + اسم من أسماء الله» compound (`validTargets` in `build.js`). Shown inline on the result card as chips, under «الموضوع» and above «البيت».
  - Covers 347 of the 357 dictionary names (25 Nov). The 10 left out on purpose have no quality in their own meaning text to derive from — only an identity reference (آدم، إبراهيم، موسى، مريم، خديجة، مي، ليلى، البندري، هلا، إسراء) — rather than invent one.
  - `build.js` also rejects (as a templating guard) any exact attribute **set** repeated on more than 3 names: a repeat that large usually means a pattern got generalized instead of read from that one name's own meaning.
- `data/figures.csv`: `id,name,full_name,era,birth,death,field,bio,contribution,url,religious,image,image_credit,image_license,status,review_note`. «شخصيات تاريخية تحمل اسمك» — matched on the **exact canonical name** (حسان ≠ حسن), never root or similar spelling. Shown on its own page, `ui/figures.template.html` → `ui/figures.html`, linked from the result card only when a match exists; the name is passed via the URL fragment (`figures.html#n=<canonical>`), never a query string, to keep the "اسمك لا يُرسل إلى أي خادم" promise.
  - **`religious` (نعم/لا) is a hard build rule, not a convention**: if `نعم`, `image`/`image_credit`/`image_license` must be empty — build.js errors otherwise. No image for a religious figure, ever, including an artistic rendering (decided with Amr 25 Nov, given depicting companions/religious figures is sensitive). All 7 current figures (علي، عمر، خالد، زيد، أحمد بن حنبل، حسان — all صحابة أو أئمة) are `نعم`. جابر بن حيان (عالِم كيمياء، لا شخصية دينية) is `لا`, with no image yet — adding one needs Amr's sign-off first.
  - If `لا` and `image` is set, it must be a `https://upload.wikimedia.org/...` file, with `image_credit` and `image_license` both required (no AI-generated images). No image → the UI shows a «؟» placeholder avatar.

## How the engine resolves a name

`resolve(input)` returns `{ input, canonical, source, meaning, root, themes, confidence }`. Steps, in order:
1. Normalise: strip tashkeel and tatweel, أإآٱ→ا, ؤ→و, ئ→ي, ى→ي, ة→ه, then drop everything that is not an Arabic letter or a space. Keep only the first name of a full name, but keep compounds.
2. Latin letters → `latin`. Empty → `empty`.
3. Compounds → `compound`: عبد + a divine name; X الدين / الهدى / الإيمان / الإسلام / الحق; X الله (ضيف الله, عطا الله…).
   عبد + a known non-divine name (`NOT_DIVINE`: النبي، المطلب، الحسين…) → `choose` with the name kept, never «المتعبّد لله باسمه».
4. Dictionary (name + variants, with or without ال) → `dictionary`.
5. Root extraction by morphological templates: exact match first, then weak-letter variants → `root` (approximate meaning).
6. Otherwise `choose`: three deterministic themes; the visitor picks one. Never invent a meaning.

Anything not from the dictionary (unknown عبد/الله parts, root, choose) is checked against `blocked.csv` first → `blocked`: no card.
The check strips ال / عبد / عبدال and the compound suffixes, and squeezes repeated letters. Dictionary names are never blocked.

`quoteFor(result, themeId = result.themes[0], offset = 0)` picks a verse deterministically. It uses an FNV-1a hash of
(normalised name + theme) over the theme's pool sorted by id. Same name + theme gives the same verse. `offset` gives
"بيت آخر" (another verse). Changing the hash or the sort changes every visitor's verse.

`build-ui.js` injects `engine.js` into both pages with `export ` stripped. So `engine.js` must stay import-free and browser-safe.
The visitor page shows the visitor's own first name. When it matches the dictionary form after normalisation, it uses the dictionary spelling (اسراء → إسراء). Latin input asks for Arabic letters.

## Data rules (enforced by `build.js` and the tests)

- `names.csv`: `name,variants,gender,root,meaning,themes,confidence,review_note`.
  - gender is ذكر, أنثى or مشترك; confidence is عالية or متوسطة.
  - Variants and themes are separated by `|`. Themes can be ids or Arabic labels.
  - Every strong root letter must appear in the name. No duplicate keys after normalisation.
  - Meanings are shown in their **positive** sense (e.g. متعب, هديل), with the source noted in `review_note`.
- `roots.csv`: three-letter roots, unambiguous positive meanings only.
- `quotes.csv`: `id,status,themes,first,second,author,url,topic,review_note`.
  - status is مقترح, معتمد or مستبعد. مستبعد is kept in the file but excluded from the build.
  - **Source: Arabic Wikisource only** (decided with Amr, 24 Nov). id is `w` + number.
    `url` is the poem's page (`https://ar.wikisource.org/wiki/<title>`), `topic` holds the page title, and `author` is required.
    The build **rejects AlDiwan URLs**: AlDiwan's terms forbid keeping its text past 24 hours.
  - `first`/`second` are the page's own text, letter for letter. You may fix only typing: spacing, tatweel, quote marks, a detached «و», and wrong diacritics (e.g. «مَنْ خليقة» → «مِنْ»).
    Never change a letter, even where the popular version differs. The source says «ومن يتهيّب صعود الجبال», not «ومن لا يحب».
    `node scripts/wikisource.js check` re-verifies every verse online. The build also rejects Persian ک/ی (a Wikisource OCR artefact).
  - Public-domain poets only, i.e. dead for 50+ years (Saudi law). Contemporary poets are out, however good.
  - To add verses: write candidates (`first,second,author,themes`), run `wikisource.js find`, keep only `exact` matches with the same poet, then copy the page's text.
  - Fewer than 3 verses in a theme is a build error. Fewer than 4 is a warning, and the tests require at least 4.
- **Verse curation rules**:
  - one complete verse with both halves;
  - positive meaning;
  - no ghazal, elegy, satire or reproach;
  - nothing derogatory or pessimistic;
  - no visible typos (the build rejects doubled diacritics, a detached «و» and a fatha on an alef);
  - phrasing that suits everyone, so not male-only exhortations like «كن رجلاً»;
  - nothing addressed to the Prophet ﷺ in the second person (it would read as said to the visitor), and nothing political.
- `blocked.csv`: `word,category`. The build fails if a word is also a dictionary name, or a duplicate.
  Only FNV-1a hashes (`blockHashes`) reach `data.blocked` and the published pages; the words themselves never do.
- `machine.csv`: `id,status,themes,meter,first,second,model,review_note`.
  - id is `m` + number; status as for quotes.
  - **Every consonant must carry a vowel, sukun or shadda** (use ٰ for hidden alef: اللّٰه، لٰكِنْ، الرَّحْمٰن).
  - The verse must scan on `meter`, one of the 9 in `METERS`, or the build fails with the line number.
  - Same curation rules as quotes, original wording (no borrowing from known verses), and the same themes and meters as the human pool.
  - Avoid verse-final «long vowel + sukun» (ـينْ، ـادْ): the checker shortens it.
- Themes (ids): nur, saada, hikma, karam, shajaa, iman, rahma, jamal, izza, sabr, sidq, hayat, salam, hamd. Verses per theme (24 Nov): hamd 5, rahma 6, salam 8, sabr 8, sidq 9, shajaa 9, hayat 10, iman 10, saada 12, jamal 13, nur 13, karam 15, hikma 17, izza 17.

## Reviewer loop

Reviewers work in a Claude Sheet that Amr owns (tabs القاموس, الاقتباسات, المواضيع). Its link is not kept in this public repo: ask Amr. `review/machine-review.csv` is the «أبيات الآلة» sheet (not in the Sheet yet); import it the same way.
You cannot edit that Sheet from here. Amr downloads a tab as CSV, then runs `node scripts/import-review.js <file>` and `npm test`.
**The Sheet's الاقتباسات tab still holds the old AlDiwan rows** (numeric ids). Importing it now fails by design. Replace the tab with a fresh `review/quotes-review.csv` first.
Column order does not matter, because the Arabic headers are mapped in `HEADER_ALIASES` in `build.js`.

## AlDiwan API: rules and facts

- Base `https://api.aldiwan.net/v1` with `Authorization: Bearer <key>`.
- Free plan: 1000 general units/month, plus 100 full-text units/month (10/day), and 30 requests/min. About 918 were left on 23 Nov, and 917 on 24 Nov.
- Attribution (poet + link) is required. **Scraping is not allowed.**
- The quotes database is small: about 2,180 quotes, most topics nearly empty, and حكمة is the richest. After the single-verse filter, few remain.
- The API also has poems (≈132,779) and poets (≈2,907): `/poems`, `/poems/{id}`, `/search`, `/poets/{id}/poems`, `/meters`, `/eras`, `/rhymes`.
  List and search return only an excerpt (≤240 chars); full text is `GET /poems/{id}` on the full-text quota. Poem themes and categories are excluded on every plan (filters return 422).
- **Storage terms (checked 24 Nov 2026; policy dated 28 Sep 2026):**
  - Sources: developers.aldiwan.net/content-rights and /developer-agreement.
  - Temporary caching is allowed for up to 24 hours, then the content must be deleted. No permanent archive, database reconstruction, "mass storage", or dataset creation.
  - AI training or **evaluation** needs a separate written licence.
  - **Decision (24 Nov):** Amr chose public sources. Of the 41 AlDiwan verses, 21 were found on Wikisource and re-sourced; 20 were dropped (mostly contemporary poets). 55 new verses were added, all from Wikisource.
    Wikisource corrected two attributions: «بُثَّ النوال» is بشار بن برد's, not العتابي's, and «أليس من الخسران» is التهامي's («بلا نفعٍ»), not الشافعي's.
    The build rejects AlDiwan URLs. **Never store AlDiwan text in the repo again.**
  - The public GitHub history starts after the switch, so it holds no AlDiwan text. The older commits (with AlDiwan rows) stay only in the local branch `pre-github-history` on Amr's machine. **Never push that branch.**
- Quote `text` comes with both halves glued together. Use `splitVerse(title, text)` from `src/verse.js`.
- Proxy actions on `/api/diwan`:
  - `ping` (calls AlDiwan `/quotes/random`, so it **spends one request**: ask first like any other call)
  - `topics`
  - `quotes&topic=`
  - `probe&topics=a,b`
  - `pool&topics=a,b&pages=1-3`

  Responses are CDN-cached for 1 day, except `ping` and partial (rate-limited) results. Add `&v=N` to bypass a cached response.
- **The site makes zero runtime calls to AlDiwan.** All content is static and reviewed.

## Secrets (hard rules)

- The AlDiwan key lives **only** in the Vercel env var `ALDIWAN_API_KEY` (sensitive, production). For a local probe, Amr sets `$env:ALDIWAN_API_KEY` in his PowerShell session.
- Never write the key into any file, log, test, commit or message, and never print it.
- `.env.local` was created by the Vercel CLI. Do not read it, print it or commit it (`.gitignore` covers `.env*`).
- Remind Amr to **rotate the key after the event**.

## Windows and test gotchas (already bitten)

- Use `fileURLToPath(new URL(rel, import.meta.url))`, not `URL.pathname`.
- Use `isAbsolute()`, not `startsWith('/')`.
- Spawn with `process.execPath`, not `'node'`.
- `node --test` runs test files **in parallel**, so a test must never write a file another test reads. That is why `npm test` runs `export-review.js` before the tests.
- Line endings are LF (`.gitattributes`). The CSV reader also handles CRLF and a BOM (Excel exports).
- Arabic in monospace with letter-spacing breaks the shaping. Keep mono for Latin micro-labels only.

## Brand (DSC design system)

If the «Data Science Club Design System» folder (from Amr) is available, its `tokens/*.css` and `readme.md` win over these notes.

- **Colours:**
  - Ember `#EB5A33` is a signal only (5–10% of a screen: rules, one highlight, the primary button), never a background.
  - Ink is `#111111`, cream is `#FAF7F2`, and the hairline is `#E3E3E3`.
- **Shape:** radii are 12 (cards), 8 (controls) and 4 (badges). Use a 4px ember rule on one edge, and exactly one uppercase mono micro-label per card.
- **Fonts:**
  - Arabic UI: IBM Plex Sans Arabic. This is a flagged substitute, because there is no official Arabic face.
  - The name on the card: see the calligraphy decision above (Gulzar, Qahiri or Aref Ruqaa for now).
  - Verses: Amiri.
- **Motion:** 250ms `cubic-bezier(.2,.6,.2,1)`. Hover lifts the element; nothing bounces.
- **Never:** emoji, decorative gradients, sparkles, neural-network or robot imagery.

## Working with Amr

- Execute; don't extend planning. Challenge assumptions and name trade-offs briefly. Keep output clean and minimal.
- On top of Claude Code's own permission prompts, **always ask first** before you:
  - deploy to production;
  - touch Vercel env vars or the key;
  - call the AlDiwan API (it spends quota);
  - delete files;
  - change the quote-pick algorithm.
- Commit after every green `npm test`, with small, descriptive messages.
- **GitHub workflow:** contributors work on a branch (or a fork) and open a pull request to `main`. CI (`.github/workflows/test.yml`) runs `npm test` and `npm run ui`, and fails if `review/*.csv` was not regenerated and committed. Only Amr deploys. When helping a contributor, never push to `main`.
- The repo is **public**: never commit secrets, personal data, private links (the reviewers' Sheet) or AlDiwan text.
- Before the event, the priority order is: experience 1 live on the site (with a QR) → شاعر أم آلة؟ (built 24 Nov; needs human review of the machine verses) → polish. The word cloud is postponed.
