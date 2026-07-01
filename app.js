/* ===== App state ===== */
const state = {
  query: '',
  keyFilter: 'all',
  xmasOnly: false,
  langBias: 50, // 0 = Hindi/Other first, 100 = English first, 50 = alphabetical
  transpose: 0,
  currentSong: null,
};

/* ===== DOM refs ===== */
const listView = document.getElementById('listView');
const viewer = document.getElementById('viewer');
const songListEl = document.getElementById('songList');
const emptyState = document.getElementById('emptyState');
const searchBox = document.getElementById('searchBox');
const keyFilter = document.getElementById('keyFilter');
const xmasToggle = document.getElementById('xmasToggle');
const xmasToggleWrap = document.getElementById('xmasToggleWrap');
const langSlider = document.getElementById('langSlider');
const langReadout = document.getElementById('langReadout');
const songCount = document.getElementById('songCount');

function songKeys(song){
  return (song.keys && song.keys.length) ? song.keys : [song.key];
}

function refreshChrome(){
  songCount.textContent = `${SONGS_DATA.length} songs`;
  const keys = [...new Set(SONGS_DATA.flatMap(songKeys))].filter(k => k && k !== '?').sort();
  const prevVal = keyFilter.value || 'all';
  keyFilter.innerHTML = '<option value="all">All keys</option>' +
    keys.map(k => `<option value="${k}">Key: ${k}</option>`).join('');
  keyFilter.value = keys.includes(prevVal) ? prevVal : 'all';
}

/* ===== Filtering + sorting ===== */
function matchesQuery(song, q){
  if(!q) return true;
  q = q.toLowerCase();
  if(song.title.toLowerCase().includes(q)) return true;
  return song.lines.some(l => l.type === 'lyric' && l.text.toLowerCase().includes(q));
}

function getVisibleSongs(){
  let list = SONGS_DATA.filter(s => {
    if(state.xmasOnly && !(s.tags || []).includes('Christmas')) return false;
    if(state.keyFilter !== 'all' && !songKeys(s).includes(state.keyFilter)) return false;
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
  emptyState.style.display = list.length ? 'none' : 'block';
  const frag = document.createDocumentFragment();
  list.forEach(song => {
    const li = document.createElement('li');
    li.className = 'song-row';
    li.tabIndex = 0;
    const tagsHtml = (song.tags || []).map(t => `<span class="tag-badge">${escapeHtml(t)}</span>`).join('');
    const extraKeys = songKeys(song).length - 1;
    li.innerHTML = `
      <div>
        <div class="title">${escapeHtml(song.title)}${tagsHtml}</div>
        <div class="meta">${escapeHtml(song.language || 'English')}${song.capo ? ' · Capo ' + song.capo : ''}</div>
      </div>
      <span class="badge">${escapeHtml(song.key || '?')}${extraKeys > 0 ? ` <span class="badge-extra">+${extraKeys}</span>` : ''}</span>
    `;
    li.addEventListener('click', () => openSong(song));
    li.addEventListener('keypress', e => { if(e.key === 'Enter') openSong(song); });
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
xmasToggle.addEventListener('change', () => {
  state.xmasOnly = xmasToggle.checked;
  xmasToggleWrap.classList.toggle('active', state.xmasOnly);
  renderList();
});
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

renderList();

// Support a direct link to a specific song, e.g. index.html?open=Amazing%20Grace
(function openFromQuery(){
  const params = new URLSearchParams(window.location.search);
  const openTitle = params.get('open');
  if(openTitle){
    const song = SONGS_DATA.find(s => s.title === openTitle);
    if(song) openSong(song);
  }
})();
