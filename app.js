/* ===== App state ===== */
const state = {
  query: '',
  keyFilter: 'all',
  tagFilter: 'all',
  langBias: 50, // 0 = Hindi/Other first, 100 = English first, 50 = alphabetical
  transpose: 0,
  currentSong: null,
  viewMode: 'all', // 'all' | 'setlist'
};

/* ===== Setlist (personal, this device only — no GitHub involved) ===== */
const SETLIST_KEY = 'wsl_setlist_v1';

function loadSetlist(){
  try { return JSON.parse(localStorage.getItem(SETLIST_KEY) || '[]'); }
  catch(e){ return []; }
}
function saveSetlistTitles(arr){
  localStorage.setItem(SETLIST_KEY, JSON.stringify(arr));
}
function isInSetlist(title){
  return loadSetlist().includes(title);
}
function addToSetlist(title){
  const list = loadSetlist();
  if(!list.includes(title)){ list.push(title); saveSetlistTitles(list); }
}
function removeFromSetlist(title){
  saveSetlistTitles(loadSetlist().filter(t => t !== title));
}
function moveInSetlist(title, direction){
  const list = loadSetlist();
  const idx = list.indexOf(title);
  if(idx === -1) return;
  const newIdx = idx + direction;
  if(newIdx < 0 || newIdx >= list.length) return;
  [list[idx], list[newIdx]] = [list[newIdx], list[idx]];
  saveSetlistTitles(list);
}

/* ===== DOM refs ===== */
const listView = document.getElementById('listView');
const viewer = document.getElementById('viewer');
const songListEl = document.getElementById('songList');
const emptyState = document.getElementById('emptyState');
const searchBox = document.getElementById('searchBox');
const keyFilter = document.getElementById('keyFilter');
const tagFilter = document.getElementById('tagFilter');
const langSlider = document.getElementById('langSlider');
const langReadout = document.getElementById('langReadout');
const songCount = document.getElementById('songCount');
const viewAllBtn = document.getElementById('viewAllBtn');
const viewSetlistBtn = document.getElementById('viewSetlistBtn');
const setlistCountEl = document.getElementById('setlistCount');
const setlistToggleBtn = document.getElementById('setlistToggleBtn');
const setlistNav = document.getElementById('setlistNav');
const setlistPrevBtn = document.getElementById('setlistPrevBtn');
const setlistNextBtn = document.getElementById('setlistNextBtn');
const setlistPos = document.getElementById('setlistPos');

function songKeys(song){
  return (song.keys && song.keys.length) ? song.keys : [song.key];
}

function refreshChrome(){
  songCount.textContent = `${SONGS_DATA.length} songs`;
  setlistCountEl.textContent = `(${loadSetlist().length})`;
  const allKeys = SONGS_DATA.flatMap(songKeys).filter(k => k && k !== '?');
  const majorForms = [...new Set(allKeys.map(majorFormOf))].filter(Boolean).sort();
  const prevKeyVal = keyFilter.value || 'all';
  keyFilter.innerHTML = '<option value="all">All keys</option>' +
    majorForms.map(mk => `<option value="${mk}">${mk} / ${relativeKey(mk)}</option>`).join('');
  keyFilter.value = majorForms.includes(prevKeyVal) ? prevKeyVal : 'all';

  const allTags = [...new Set(SONGS_DATA.flatMap(s => s.tags || []))].filter(Boolean).sort();
  const prevTagVal = tagFilter.value || 'all';
  tagFilter.innerHTML = '<option value="all">All tags</option>' +
    allTags.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  tagFilter.value = allTags.includes(prevTagVal) ? prevTagVal : 'all';
}

/* ===== Filtering + sorting ===== */
function matchesQuery(song, q){
  if(!q) return true;
  q = q.toLowerCase();
  if(song.title.toLowerCase().includes(q)) return true;
  return song.lines.some(l => l.type === 'lyric' && l.text.toLowerCase().includes(q));
}

function getVisibleSongs(){
  if(state.viewMode === 'setlist'){
    const titles = loadSetlist();
    return titles
      .map(t => SONGS_DATA.find(s => s.title === t))
      .filter(Boolean)
      .filter(s => {
        if(state.tagFilter !== 'all' && !(s.tags || []).includes(state.tagFilter)) return false;
        if(state.keyFilter !== 'all' && !songKeys(s).some(k => keysAreRelative(k, state.keyFilter))) return false;
        if(!matchesQuery(s, state.query)) return false;
        return true;
      });
  }

  let list = SONGS_DATA.filter(s => {
    if(state.tagFilter !== 'all' && !(s.tags || []).includes(state.tagFilter)) return false;
    if(state.keyFilter !== 'all' && !songKeys(s).some(k => keysAreRelative(k, state.keyFilter))) return false;
    if(!matchesQuery(s, state.query)) return false;
    return true;
  });

  const bias = state.langBias;
  list.sort((a, b) => {
    if(bias !== 50){
      const aEng = a.language === 'English';
      const bEng = b.language === 'English';
      if(aEng !== bEng){
        const preferEnglish = bias > 50;
        if(preferEnglish) return aEng ? -1 : 1;
        return aEng ? 1 : -1;
      }
    }
    return a.title.localeCompare(b.title);
  });
  return list;
}

function renderList(){
  refreshChrome();
  const list = getVisibleSongs();
  songListEl.innerHTML = '';
  if(state.viewMode === 'setlist' && loadSetlist().length === 0){
    emptyState.textContent = 'Your setlist is empty — tap + on any song to add it here.';
    emptyState.style.display = 'block';
  } else {
    emptyState.textContent = 'No songs match your search.';
    emptyState.style.display = list.length ? 'none' : 'block';
  }
  const frag = document.createDocumentFragment();
  list.forEach((song, idx) => {
    const li = document.createElement('li');
    li.className = 'song-row';
    li.tabIndex = 0;
    const tagsHtml = (song.tags || []).map(t => `<span class="tag-badge">${escapeHtml(t)}</span>`).join('');
    const extraKeys = songKeys(song).length - 1;
    const infoHtml = `
      <div>
        <div class="title">${escapeHtml(song.title)}${tagsHtml}</div>
        <div class="meta">${escapeHtml(song.language || 'English')}${song.capo ? ' · Capo ' + song.capo : ''}</div>
      </div>
      <span class="badge">${escapeHtml(song.key || '?')}${extraKeys > 0 ? ` <span class="badge-extra">+${extraKeys}</span>` : ''}</span>
    `;

    let controlsHtml;
    if(state.viewMode === 'setlist'){
      controlsHtml = `
        <div class="setlist-controls">
          <button class="row-icon-btn" data-action="up" ${idx === 0 ? 'disabled' : ''}>↑</button>
          <button class="row-icon-btn" data-action="down" ${idx === list.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="row-icon-btn remove" data-action="remove">×</button>
        </div>
      `;
    } else {
      const added = isInSetlist(song.title);
      controlsHtml = `<button class="row-add-btn${added ? ' added' : ''}" data-action="add">${added ? '✓' : '+'}</button>`;
    }

    li.innerHTML = infoHtml + controlsHtml;

    li.addEventListener('click', (e) => {
      if(e.target.closest('button')) return;
      openSong(song);
    });
    li.addEventListener('keypress', e => { if(e.key === 'Enter') openSong(song); });

    if(state.viewMode === 'setlist'){
      li.querySelector('[data-action="up"]').addEventListener('click', () => { moveInSetlist(song.title, -1); renderList(); });
      li.querySelector('[data-action="down"]').addEventListener('click', () => { moveInSetlist(song.title, 1); renderList(); });
      li.querySelector('[data-action="remove"]').addEventListener('click', () => { removeFromSetlist(song.title); renderList(); });
    } else {
      li.querySelector('[data-action="add"]').addEventListener('click', () => {
        if(isInSetlist(song.title)) removeFromSetlist(song.title); else addToSetlist(song.title);
        renderList();
      });
    }
    frag.appendChild(li);
  });
  songListEl.appendChild(frag);
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ===== Song viewer ===== */
function openSong(song){
  state.currentSong = song;
  state.transpose = 0;
  listView.style.display = 'none';
  viewer.style.display = 'block';
  window.scrollTo(0,0);
  renderSong();
}

function closeSong(){
  viewer.style.display = 'none';
  listView.style.display = 'block';
  state.currentSong = null;
  renderList(); // reflect any setlist changes made while viewing the song
}

function renderSong(){
  const song = state.currentSong;
  if(!song) return;
  document.getElementById('songTitle').textContent = song.title;
  const subParts = [];
  if(song.capo) subParts.push(`Capo ${song.capo} (as written)`);
  subParts.push(song.language || 'English');
  if((song.tags || []).length) subParts.push(song.tags.join(', '));
  document.getElementById('songSub').textContent = subParts.join(' · ');
  document.getElementById('keyReadout').textContent = transposeKeyLabel(song.key, state.transpose);

  const altKeysEl = document.getElementById('altKeys');
  const keys = songKeys(song);
  const currentKey = transposeKeyLabel(song.key, state.transpose);
  if(keys.length > 1){
    altKeysEl.style.display = 'flex';
    altKeysEl.innerHTML = keys.map(k =>
      `<button class="key-pill-btn${k === currentKey ? ' active' : ''}" data-key="${escapeHtml(k)}">${escapeHtml(k)}</button>`
    ).join('');
    altKeysEl.querySelectorAll('.key-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.transpose = transposeAmountToKey(song.key, btn.dataset.key);
        renderSong();
      });
    });
  } else {
    altKeysEl.style.display = 'none';
    altKeysEl.innerHTML = '';
  }

  const inSetlist = isInSetlist(song.title);
  setlistToggleBtn.textContent = inSetlist ? '✓ In Setlist' : '+ Setlist';
  setlistToggleBtn.classList.toggle('added', inSetlist);

  const setlistTitles = loadSetlist();
  const posInSetlist = setlistTitles.indexOf(song.title);
  if(posInSetlist !== -1){
    setlistNav.style.display = 'flex';
    setlistPos.textContent = `${posInSetlist + 1} of ${setlistTitles.length} in setlist`;
    setlistPrevBtn.disabled = posInSetlist === 0;
    setlistNextBtn.disabled = posInSetlist === setlistTitles.length - 1;
  } else {
    setlistNav.style.display = 'none';
  }

  const body = document.getElementById('songBody');
  body.innerHTML = '';
  const frag = document.createDocumentFragment();
  song.lines.forEach(line => {
    const div = document.createElement('div');
    if(line.type === 'chord'){
      div.className = 'chord-line';
      div.textContent = transposeChordLine(line.text, state.transpose);
    } else if(line.type === 'lyric'){
      div.className = 'lyric-line';
      div.textContent = line.text;
    } else if(line.type === 'label'){
      div.className = 'label-line';
      div.textContent = line.text.replace(/:$/, '');
    } else {
      div.className = 'blank-line';
    }
    frag.appendChild(div);
  });
  body.appendChild(frag);
}

/* ===== Event wiring ===== */
searchBox.addEventListener('input', () => { state.query = searchBox.value; renderList(); });
keyFilter.addEventListener('change', () => { state.keyFilter = keyFilter.value; renderList(); });
tagFilter.addEventListener('change', () => { state.tagFilter = tagFilter.value; renderList(); });
langSlider.addEventListener('input', () => {
  state.langBias = Number(langSlider.value);
  if(state.langBias === 50) langReadout.textContent = 'Mixed';
  else if(state.langBias > 50) langReadout.textContent = `EN first ${state.langBias}%`;
  else langReadout.textContent = `HI first ${100 - state.langBias}%`;
  renderList();
});

document.getElementById('backBtn').addEventListener('click', closeSong);
document.getElementById('transUp').addEventListener('click', () => { state.transpose++; renderSong(); });
document.getElementById('transDown').addEventListener('click', () => { state.transpose--; renderSong(); });
document.getElementById('transReset').addEventListener('click', () => { state.transpose = 0; renderSong(); });
document.getElementById('focusBtn').addEventListener('click', () => {
  document.body.classList.toggle('focus');
});

viewAllBtn.addEventListener('click', () => {
  state.viewMode = 'all';
  viewAllBtn.classList.add('active');
  viewSetlistBtn.classList.remove('active');
  renderList();
});
viewSetlistBtn.addEventListener('click', () => {
  state.viewMode = 'setlist';
  viewSetlistBtn.classList.add('active');
  viewAllBtn.classList.remove('active');
  renderList();
});

setlistToggleBtn.addEventListener('click', () => {
  const song = state.currentSong;
  if(!song) return;
  if(isInSetlist(song.title)) removeFromSetlist(song.title); else addToSetlist(song.title);
  renderSong();
});

setlistPrevBtn.addEventListener('click', () => {
  const titles = loadSetlist();
  const idx = titles.indexOf(state.currentSong.title);
  if(idx > 0){
    const prevSong = SONGS_DATA.find(s => s.title === titles[idx - 1]);
    if(prevSong) openSong(prevSong);
  }
});
setlistNextBtn.addEventListener('click', () => {
  const titles = loadSetlist();
  const idx = titles.indexOf(state.currentSong.title);
  if(idx !== -1 && idx < titles.length - 1){
    const nextSong = SONGS_DATA.find(s => s.title === titles[idx + 1]);
    if(nextSong) openSong(nextSong);
  }
});

renderList();

// Logo is optional — if no logo.png has been uploaded to the repo root
// yet, collapse the empty slot instead of showing a broken-image icon.
// Upload a logo.png at any time (via GitHub's "Add file" on the repo
// root) and it'll just start appearing, no code changes needed.
(function initLogo(){
  const img = document.getElementById('brandLogoImg');
  const mark = document.getElementById('brandMark');
  if(!img || !mark) return;
  img.addEventListener('error', () => mark.classList.add('no-logo'));
})();

// Support a direct link to a specific song, e.g. index.html?open=Amazing%20Grace
(function openFromQuery(){
  const params = new URLSearchParams(window.location.search);
  const openTitle = params.get('open');
  if(openTitle){
    const song = SONGS_DATA.find(s => s.title === openTitle);
    if(song) openSong(song);
  }
})();
