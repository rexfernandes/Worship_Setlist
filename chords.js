/* ===== Shared chord engine (used by app.js and editor.js) ===== */
const SHARP_SCALE = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLAT_TO_SHARP = {Db:'C#',Eb:'D#',Gb:'F#',Ab:'G#',Bb:'A#',Fb:'E',Cb:'B'};

function normalizeRoot(root){
  return FLAT_TO_SHARP[root] || root;
}

// Matches: root ([A-G] + optional #/b), suffix (m, 7, sus4, maj7, etc), optional /bassnote(+m)
const CHORD_RE = /^(\(?)([A-G])(#|b)?((?:maj|min|sus2|sus4|sus|dim|aug|add\d|m7sus|m7|m|7sus|7|9|11|13)*)(\/([A-G])(#|b)?(m)?)?(\)?)$/;

const LABEL_RE = /^(CHORUS|BRIDGE|VERSE\s*\d*|VERES\s*\d*|TAG|ENDING|CODA|INTRO|CHORDS)[:.]?\s*\(?(men|women|all)?\)?[:.]?$/i;

function isChordLine(text){
  const toks = text.trim().split(/\s+/).filter(Boolean);
  if(!toks.length) return false;
  return toks.every(t => CHORD_RE.test(t));
}

function transposeToken(token, semitones){
  if(semitones === 0) return token;
  const m = token.match(CHORD_RE);
  if(!m) return token;
  const [, openParen, rootLetter, rootAcc, suffix, , bassLetter, bassAcc, bassMinor, closeParen] = m;
  const shiftNote = (letter, acc) => {
    const norm = normalizeRoot(letter + (acc||''));
    const idx = SHARP_SCALE.indexOf(norm);
    if(idx === -1) return letter + (acc||'');
    const newIdx = ((idx + semitones) % 12 + 12) % 12;
    return SHARP_SCALE[newIdx];
  };
  let out = openParen + shiftNote(rootLetter, rootAcc) + suffix;
  if(bassLetter){
    out += '/' + shiftNote(bassLetter, bassAcc) + (bassMinor || '');
  }
  out += closeParen;
  return out;
}

function transposeChordLine(line, semitones){
  if(semitones === 0) return line;
  return line.split(/(\s+)/).map(part => /\s/.test(part) ? part : transposeToken(part, semitones)).join('');
}

function transposeKeyLabel(key, semitones){
  if(!key || key === '?' || semitones === 0) return key;
  const minor = key.endsWith('m') && key !== 'm';
  const root = minor ? key.slice(0, -1) : key;
  const norm = normalizeRoot(root);
  const idx = SHARP_SCALE.indexOf(norm);
  if(idx === -1) return key;
  const newIdx = ((idx + semitones) % 12 + 12) % 12;
  return SHARP_SCALE[newIdx] + (minor ? 'm' : '');
}

/* Parse a pasted "chord line above lyric line" block into a lines[] array,
   matching the same structure used by songs_data.js */
function parseSongBody(rawText){
  const rawLines = rawText.replace(/\r\n/g, '\n').split('\n');
  const lines = [];
  for(const raw of rawLines){
    const t = raw.trim();
    if(t === ''){
      if(lines.length && lines[lines.length - 1].type !== 'blank') lines.push({type:'blank'});
      continue;
    }
    if(LABEL_RE.test(t.replace(/:$/,''))){
      lines.push({type:'label', text: t});
    } else if(isChordLine(t)){
      lines.push({type:'chord', text: t});
    } else {
      lines.push({type:'lyric', text: t});
    }
  }
  while(lines.length && lines[0].type === 'blank') lines.shift();
  while(lines.length && lines[lines.length - 1].type === 'blank') lines.pop();
  return lines;
}

/* Detect key from a lines[] array: first chord line's first token */
function detectKeyFromLines(lines){
  for(const l of lines){
    if(l.type === 'chord'){
      const firstTok = l.text.trim().split(/\s+/)[0];
      const m = firstTok.match(/^\(?([A-G])(#|b)?(m(?!aj))?/);
      if(m){
        const root = m[1] + (m[2] || '');
        const minor = !!m[3];
        return normalizeRoot(root) + (minor ? 'm' : '');
      }
    }
  }
  return null;
}

/* Render a lines[] array back into the same "chord line above lyric line" text
   format used in the editor textarea, for round-tripping when editing a song. */
function linesToBodyText(lines){
  return lines.map(l => l.type === 'blank' ? '' : l.text).join('\n');
}
