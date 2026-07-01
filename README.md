# Worship Song Library

Fully offline, mobile-friendly tool for browsing worship songs (chords + lyrics).
New songs are added by dropping a text file into a folder — no app, no login
beyond GitHub, no build step to run yourself.

## Files
- `index.html` + `app.js` — the library (search, filter, transpose, focus mode).
  This is the only thing people actually use day-to-day.
- `chords.js` — chord-transposition engine used by the library.
- `songs_data.js` — the song database. Generated/updated automatically —
  don't edit this by hand.
- `new-songs/` — **drop new song `.txt` files here.** See
  `new-songs/README.md` for the exact format.
- `scripts/build_songs.py` — parses files from `new-songs/` and merges them
  into `songs_data.js`. Runs automatically via GitHub Actions; only run it
  yourself if you want to test locally (`python3 scripts/build_songs.py`).
- `.github/workflows/build-songs.yml` — the automation. Triggers whenever
  something changes under `new-songs/`.

## Adding a new song
1. On github.com (or the GitHub mobile app), open the `new-songs/` folder.
2. Add a `.txt` file — see `new-songs/_template.txt` for the format, or
   `new-songs/README.md` for the full explanation.
3. Commit. Within a minute or two, a GitHub Action parses it and merges it
   into the live library automatically.
4. If something's off (missing title, wrong format), the file stays in
   `new-songs/` instead of disappearing, and the failed run under the repo's
   **Actions** tab explains why. Fix and re-commit.

Multiple people can drop files in at the same time — each one is matched
and merged by its `Title:` field, so re-uploading a song with the same
title updates it rather than duplicating it.

## Hosting on GitHub Pages
Push this whole folder structure to a repo, then point Pages at that
branch/folder. `index.html` is the entry point.

**Important:** the GitHub Action workflow assumes your default branch is
called `main`. If yours is `master`, edit the `branches:` line in
`.github/workflows/build-songs.yml` accordingly.

## Design
Dark, high-contrast theme (violet/pink/lime gradient) inspired by stage
monitors — mobile-first with a thumb-reach bottom toolbar for transpose
controls, and a "Focus mode" that enlarges text further for low-light
singing.

## Known limitations
- Auto-detected keys (when `Key:` is left blank) are a heuristic based on
  the first chord — reliable in testing, but worth a glance if a song looks
  off.
- The language-mix slider sorts English vs. Hindi/Other first; it's a sort,
  not a weighted shuffle.
- No setlist builder or usage tracking yet.
- A handful of songs in the original bundled set carry real copyright
  (CCLI-covered) — worth confirming your church's CCLI license covers
  digital display if this ever goes beyond internal use.
