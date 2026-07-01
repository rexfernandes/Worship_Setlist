# Drop new songs here

Add a plain `.txt` file to this folder — any filename is fine, e.g.
`Way Maker.txt`. Within a minute or two of uploading, a GitHub Action will
parse it and merge it into the live song library automatically. No app,
no login beyond GitHub, no build step to run yourself.

**On your phone:** open this folder on github.com (or in the GitHub app),
tap **Add file → Create new file** (or **Upload files** if you already
typed it up in Notes/Google Docs and saved it as .txt), paste the content,
commit.

## Format

```
Title: Way Maker
Key: G
Capo: 3
Language: English
Tags: Upbeat, Christmas
---
G                D
Way maker, miracle worker
Em                    C
Promise keeper, light in the darkness

CHORUS:
G          D
My God, that is who You are
```

**Required:**
- `Title:` — must be there, and must exactly match if you're updating an
  existing song (matching is by title, so a typo creates a duplicate
  instead of updating the original).
- The `---` line, on its own, separating the metadata from the song itself.
- At least one chord line + lyric line below the `---`.

**Optional** (leave the line out entirely if you don't need it):
- `Key:` — if omitted, it's auto-detected from the first chord.
- `Capo:` — a number, if the song is written with a capo.
- `Language:` — `English`, `Hindi`, or `Other`. Defaults to English.
- `Tags:` — comma-separated, e.g. `Christmas, Upbeat`.

**Song body:**
- Put the chord line directly above the lyric line it goes with.
- Leave a blank line between verses.
- Mark sections with a line that just says `CHORUS:`, `BRIDGE:`, `VERSE 2:`,
  `TAG:`, etc.

See `_template.txt` in this folder for a copyable starting point — that
file is ignored by the build (filenames starting with `_` are skipped),
so it's safe to leave it here as a reference.

## What happens after you upload

1. GitHub Actions runs `scripts/build_songs.py`, which parses your file(s)
   and merges them into `songs_data.js` — updating an existing song if the
   title matches, or adding a new one if it doesn't.
2. Your `.txt` file moves into `new-songs/processed/` once it's
   successfully merged, so this folder only ever shows what's still
   pending.
3. If something's wrong with a file (missing title, missing `---`, etc.)
   it's **left in place** here instead of being moved, so you can see what
   needs fixing. Check the failed run under the repo's **Actions** tab for
   the exact reason.
4. The live site updates within a minute or two of the Action finishing —
   no separate deploy step needed if you're using GitHub Pages from this
   branch.
