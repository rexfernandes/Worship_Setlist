#!/usr/bin/env python3
"""
Scans new-songs/*.txt for new or updated songs, parses them into the same
structure used by songs_data.js, merges them in (matched by title), and
moves successfully processed files into new-songs/processed/.

Files with parsing errors are left in place (not moved) so the contributor
can see and fix them; the script exits non-zero in that case so the GitHub
Action shows a failed run, while still committing whatever DID succeed.

Run manually with:  python3 scripts/build_songs.py
"""
import re
import json
import sys
import shutil
import pathlib

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
NEW_SONGS_DIR = REPO_ROOT / "new-songs"
PROCESSED_DIR = NEW_SONGS_DIR / "processed"
SONGS_DATA_PATH = REPO_ROOT / "songs_data.js"

CHORD_TOKEN = re.compile(
    r'^\(?[A-G](#|b)?(maj7|maj|min7|min|sus2|sus4|sus|dim7|dim|aug|add\d|m7sus|m7|m|7sus|7|9|11|13)*'
    r'(/[A-G](#|b)?(m)?)?\)?$'
)
LABEL_RE = re.compile(
    r'^(CHORUS|BRIDGE|VERSE\s*\d*|TAG|ENDING|CODA|INTRO)[:.]?\s*\(?(men|women|all)?\)?[:.]?$',
    re.I,
)
CHORD_ROOT_RE = re.compile(r'^\(?([A-G](?:#|b)?)(m(?!aj))?')
FLAT_TO_SHARP = {'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#', 'Fb': 'E', 'Cb': 'B'}


def normalize_root(root):
    return FLAT_TO_SHARP.get(root, root)


def is_chord_line(text):
    toks = text.split()
    if not toks:
        return False
    return all(CHORD_TOKEN.match(t) for t in toks)


def parse_body(text):
    lines = []
    for raw in text.split('\n'):
        t = raw.strip()
        if not t:
            if lines and lines[-1]['type'] != 'blank':
                lines.append({'type': 'blank'})
            continue
        if LABEL_RE.match(t.rstrip(':')):
            lines.append({'type': 'label', 'text': t})
        elif is_chord_line(t):
            lines.append({'type': 'chord', 'text': t})
        else:
            lines.append({'type': 'lyric', 'text': t})
    while lines and lines[0]['type'] == 'blank':
        lines.pop(0)
    while lines and lines[-1]['type'] == 'blank':
        lines.pop()
    return lines


def detect_key(lines):
    for l in lines:
        if l['type'] == 'chord':
            first = l['text'].split()[0]
            m = CHORD_ROOT_RE.match(first)
            if m:
                root = normalize_root(m.group(1))
                minor = bool(m.group(2))
                return root + ('m' if minor else '')
    return None


def parse_meta_block(block_text):
    meta = {}
    for line in block_text.split('\n'):
        line = line.strip()
        if not line or ':' not in line:
            continue
        key, val = line.split(':', 1)
        meta[key.strip().lower()] = val.strip()
    return meta


def parse_song_file(path):
    # utf-8-sig strips a leading BOM if present (common from phone note apps);
    # normalizing line endings guards against lone '\r' (old Mac-style) breaks.
    raw = path.read_text(encoding='utf-8-sig')
    raw = raw.replace('\r\n', '\n').replace('\r', '\n')
    if '---' not in raw:
        raise ValueError(f"{path.name}: missing '---' separator between metadata and song body")
    meta_block, body = raw.split('---', 1)
    meta = parse_meta_block(meta_block)

    title = meta.get('title', '').strip()
    if not title:
        raise ValueError(f"{path.name}: missing required 'Title:' field")

    lines = parse_body(body)
    if not lines:
        raise ValueError(f"{path.name}: no chords/lyrics found after the '---' line")

    key = meta.get('key', '').strip() or detect_key(lines) or '?'
    capo_raw = meta.get('capo', '').strip()
    capo = int(capo_raw) if capo_raw.isdigit() else None
    language = (meta.get('language', '').strip() or 'English').title()
    if language not in ('English', 'Hindi', 'Other'):
        language = 'Other'
    tags = [t.strip() for t in meta.get('tags', '').split(',') if t.strip()]

    # Optional: other keys this song is commonly sung in, e.g. "Keys: C, D, G".
    # Always includes the primary key even if the contributor left it out.
    keys_raw = meta.get('keys', '').strip()
    if keys_raw:
        keys = [k.strip() for k in keys_raw.split(',') if k.strip()]
        if key not in keys:
            keys.insert(0, key)
    else:
        keys = [key]

    return {
        'title': title,
        'key': key,
        'keys': keys,
        'capo': capo,
        'language': language,
        'tags': tags,
        'lines': lines,
    }


def load_current_songs():
    text = SONGS_DATA_PATH.read_text(encoding='utf-8')
    m = re.search(r'const\s+SONGS_DATA\s*=\s*(\[.*\])\s*;?\s*$', text, re.S)
    if not m:
        raise ValueError("Could not find a SONGS_DATA array in songs_data.js")
    return json.loads(m.group(1))


def save_songs(songs):
    songs_sorted = sorted(songs, key=lambda s: s['title'].lower())
    content = "const SONGS_DATA = " + json.dumps(songs_sorted, indent=1, ensure_ascii=False) + ";\n"
    SONGS_DATA_PATH.write_text(content, encoding='utf-8')


def main():
    if not NEW_SONGS_DIR.exists():
        print("No new-songs/ directory found — nothing to do.")
        return

    txt_files = sorted(
        p for p in NEW_SONGS_DIR.glob('*.txt')
        if not p.name.startswith('_')  # skip template/example files
    )
    if not txt_files:
        print("No new song files waiting in new-songs/.")
        return

    songs = load_current_songs()
    by_title = {s['title']: i for i, s in enumerate(songs)}
    PROCESSED_DIR.mkdir(exist_ok=True)

    changed = []
    errors = []

    for path in txt_files:
        try:
            song = parse_song_file(path)
        except ValueError as e:
            errors.append(str(e))
            continue

        if song['title'] in by_title:
            songs[by_title[song['title']]] = song
            changed.append(f"{song['title']}  (updated)")
        else:
            songs.append(song)
            by_title[song['title']] = len(songs) - 1
            changed.append(f"{song['title']}  (new)")

        shutil.move(str(path), str(PROCESSED_DIR / path.name))

    if changed:
        save_songs(songs)
        print(f"Processed {len(changed)} song(s):")
        for c in changed:
            print(" -", c)
    else:
        print("No files parsed successfully.")

    if errors:
        print(f"\n{len(errors)} file(s) left in new-songs/ for fixing:")
        for e in errors:
            print(" -", e)
        sys.exit(1)


if __name__ == '__main__':
    main()
