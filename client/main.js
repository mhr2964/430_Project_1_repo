// Populates type/weakness dropdowns from the API on load, then fetches all pokemon.

const resultsEl = document.getElementById('results');
const resultsScrollEl = document.querySelector('.results-scroll');
const paginationEl = document.getElementById('pagination');
const resultCountEl = document.getElementById('result-count');
const filterNameEl = document.getElementById('filter-name');
const filterTypeEl = document.getElementById('filter-type');
const filterWeaknessEl = document.getElementById('filter-weakness');
const filterLimitEl = document.getElementById('filter-limit');
const addMsgEl = document.getElementById('add-msg');
const updateMsgEl = document.getElementById('update-msg');
const updateFieldsEl = document.getElementById('update-fields');
const updateImgActionsEl = document.getElementById('update-img-actions');
const updateSubmitEl = document.getElementById('update-submit');

const PAGE_SIZE = 20;
let allResults = [];
let currentPage = 0;
let currentParams = {};  // last-used filter params — used to refresh after add/update
let pickerTarget = null; // 'add' or 'update' — which form opened the image picker
let pickerCache = null;  // cached sprite list; cleared after add so new pokemon appear

/** Escapes HTML special characters to prevent XSS when interpolating into innerHTML. */
const esc = (str) => String(str)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** Splits a comma-separated string into a trimmed, non-empty array. */
const parseCSV = (str) => str.split(',').map((s) => s.trim()).filter(Boolean);

// Classic pokemon type colors
const TYPE_COLORS = {
  Bug: { bg: '#A8B820', text: '#fff' },
  Dragon: { bg: '#7038F8', text: '#fff' },
  Electric: { bg: '#F8D030', text: '#333' },
  Fighting: { bg: '#C03028', text: '#fff' },
  Fire: { bg: '#F08030', text: '#fff' },
  Flying: { bg: '#A890F0', text: '#fff' },
  Ghost: { bg: '#705898', text: '#fff' },
  Grass: { bg: '#78C850', text: '#fff' },
  Ground: { bg: '#E0C068', text: '#333' },
  Ice: { bg: '#98D8D8', text: '#333' },
  Normal: { bg: '#A8A878', text: '#fff' },
  Poison: { bg: '#A040A0', text: '#fff' },
  Psychic: { bg: '#F85888', text: '#fff' },
  Rock: { bg: '#B8A038', text: '#fff' },
  Water: { bg: '#6890F0', text: '#fff' },
};

/** Returns an HTML span for a type badge with its canonical color. */
const typeTag = (t) => {
  const color = TYPE_COLORS[t] || { bg: '#718096', text: '#fff' };
  return `<span class="type-badge" style="background:${color.bg};color:${color.text}">${esc(t)}</span>`;
};

// ─── Image preview ────────────────────────────────────────────────────────────

/** Shows or hides the image preview for a form (add or update). */
const updatePreview = (prefix, url) => {
  const el = document.getElementById(`${prefix}-img-preview`);
  if (url) {
    el.src = url;
    el.hidden = false;
  } else {
    el.hidden = true;
    el.src = '';
  }
};

// Keep preview in sync when user types into the URL field
['add', 'update'].forEach((prefix) => {
  document.getElementById(`${prefix}-img`).addEventListener('input', (e) => {
    updatePreview(prefix, e.target.value.trim());
  });
});

// ─── Image picker modal ────────────────────────────────────────────────────────

const pickerDialog = document.getElementById('img-picker');
const pickerGrid = document.getElementById('picker-grid');
const pickerSearch = document.getElementById('picker-search');

/** Selects an image URL from the picker and sends it to the correct form. */
const selectImage = (url) => {
  document.getElementById(`${pickerTarget}-img`).value = url;
  updatePreview(pickerTarget, url);
  pickerDialog.close();
};

/** Opens the image picker, populating it from the dataset (cached after first load). */
const openPicker = async () => {
  pickerGrid.innerHTML = '<p style="padding:1rem;color:#718096">Loading sprites…</p>';
  pickerSearch.value = '';
  pickerDialog.showModal();

  try {
    if (!pickerCache) {
      const res = await fetch('/api/pokemon', { headers: { Accept: 'application/json' } });
      const data = await res.json();
      pickerCache = data.pokemon.filter((p) => p.img);
    }

    const withImages = pickerCache;

    pickerGrid.innerHTML = withImages.map((p) => `
      <button type="button" class="picker-item" data-url="${esc(p.img)}" title="${esc(p.name)}">
        <img src="${esc(p.img)}" alt="${esc(p.name)}" onerror="this.parentElement.style.display='none'" />
        <span>${esc(p.name)}</span>
      </button>
    `).join('');

    pickerGrid.querySelectorAll('.picker-item').forEach((btn) => {
      btn.addEventListener('click', () => selectImage(btn.dataset.url));
    });
  } catch {
    pickerGrid.innerHTML = '<p style="padding:1rem;color:#c53030">Failed to load images.</p>';
  }
};

// Filter picker items by name
pickerSearch.addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  pickerGrid.querySelectorAll('.picker-item').forEach((btn) => {
    const name = btn.querySelector('span').textContent.toLowerCase();
    btn.style.display = name.includes(q) ? '' : 'none';
  });
});

// Close on backdrop click or close button
document.getElementById('picker-close').addEventListener('click', () => pickerDialog.close());
pickerDialog.addEventListener('click', (e) => { if (e.target === pickerDialog) pickerDialog.close(); });

// Wire "Choose from Pokedex" buttons (both forms use data-picker-target attribute)
document.querySelectorAll('[data-picker-target]').forEach((btn) => {
  btn.addEventListener('click', () => {
    pickerTarget = btn.dataset.pickerTarget;
    openPicker();
  });
});

// ─── File upload → base64 ─────────────────────────────────────────────────────

/** Reads a file input and sets the img field + preview to the base64 data URL. */
const handleFileUpload = (prefix) => {
  const fileInput = document.getElementById(`${prefix}-img-file`);
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById(`${prefix}-img`).value = e.target.result;
    updatePreview(prefix, e.target.result);
  };
  reader.readAsDataURL(file);
};

// Wire "Upload File" buttons (both forms use data-upload-target attribute)
document.querySelectorAll('[data-upload-target]').forEach((btn) => {
  const prefix = btn.dataset.uploadTarget;
  btn.addEventListener('click', () => document.getElementById(`${prefix}-img-file`).click());
});

document.getElementById('add-img-file').addEventListener('change', () => handleFileUpload('add'));
document.getElementById('update-img-file').addEventListener('change', () => handleFileUpload('update'));

// ─── Pokemon grid rendering ───────────────────────────────────────────────────

/** Renders a slice of pokemon as cards. */
const renderCards = (list) => {
  if (list.length === 0) {
    resultsEl.innerHTML = '<p class="empty-msg">No pokemon match the current filters.</p>';
    return;
  }

  resultsEl.innerHTML = list.map((p) => `
    <div class="card">
      ${p.img ? `<img class="card-img" src="${esc(p.img)}" alt="${esc(p.name)}" onerror="this.style.display='none'" />` : ''}
      <h3>#${esc(p.num)} ${esc(p.name)}</h3>
      <p class="type-list">${p.type.map(typeTag).join('')}</p>
      <p><strong>Height:</strong> ${esc(p.height)} &nbsp;|&nbsp; <strong>Weight:</strong> ${esc(p.weight)}</p>
      <p><strong>Weaknesses:</strong> ${esc(p.weaknesses.join(', ') || 'none')}</p>
      ${p.next_evolution && p.next_evolution.length > 0
    ? `<p><strong>Evolves to:</strong> ${esc(p.next_evolution.map((e) => e.name).join(' → '))}</p>`
    : ''}
    </div>
  `).join('');
};

/** Renders prev/next pagination controls. Clears them when only one page. */
const renderPagination = () => {
  const totalPages = Math.ceil(allResults.length / PAGE_SIZE);

  if (totalPages <= 1) {
    paginationEl.innerHTML = '';
    return;
  }

  paginationEl.innerHTML = `
    <button type="button" id="prev-page" class="secondary" ${currentPage === 0 ? 'disabled' : ''}>&#8592; Prev</button>
    <span class="page-info">Page ${currentPage + 1} of ${totalPages}</span>
    <button type="button" id="next-page" class="secondary" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>Next &#8594;</button>
  `;

  document.getElementById('prev-page').addEventListener('click', () => {
    if (currentPage > 0) {
      currentPage -= 1;
      renderPage();
      resultsScrollEl.scrollTop = 0;
    }
  });

  document.getElementById('next-page').addEventListener('click', () => {
    if (currentPage < totalPages - 1) {
      currentPage += 1;
      renderPage();
      resultsScrollEl.scrollTop = 0;
    }
  });
};

/** Slices allResults to the current page and re-renders cards + pagination + count. */
const renderPage = () => {
  const totalPages = Math.ceil(allResults.length / PAGE_SIZE);
  const start = currentPage * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, allResults.length);

  if (allResults.length === 0) {
    resultCountEl.textContent = 'Showing 0 pokemon';
    renderCards([]);
    paginationEl.innerHTML = '';
    return;
  }

  resultCountEl.textContent = totalPages > 1
    ? `Showing ${start + 1}–${end} of ${allResults.length} pokemon`
    : `Showing ${allResults.length} pokemon`;

  renderCards(allResults.slice(start, end));
  renderPagination();
};

/** Fetches pokemon from the API with optional filter query params. */
const fetchPokemon = async (params = {}) => {
  currentParams = params;
  resultsEl.classList.add('loading');
  resultCountEl.textContent = '';
  paginationEl.innerHTML = '';

  const qs = new URLSearchParams(params).toString();
  const url = `/api/pokemon${qs ? `?${qs}` : ''}`;

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!res.ok) {
      const err = await res.json();
      resultsEl.innerHTML = `<p class="msg error">Error: ${esc(err.error)}</p>`;
      return;
    }

    const data = await res.json();
    allResults = data.pokemon;
    currentPage = 0;
    renderPage();
  } catch {
    resultsEl.innerHTML = '<p class="msg error">Network error — could not reach the server.</p>';
  } finally {
    resultsEl.classList.remove('loading');
  }
};

/** Refreshes the grid and returns to the same page if it still exists. */
const refreshGrid = async () => {
  const savedPage = currentPage;
  await fetchPokemon(currentParams);
  pickerCache = null; // invalidate so picker reflects any newly added pokemon
  const totalPages = Math.ceil(allResults.length / PAGE_SIZE);
  if (savedPage > 0 && savedPage < totalPages) {
    currentPage = savedPage;
    renderPage();
  }
};

/** Populates a <select> element with options from an API array endpoint. */
const populateSelect = async (selectEl, apiPath, dataKey) => {
  try {
    const res = await fetch(apiPath, { headers: { Accept: 'application/json' } });
    if (!res.ok) return;
    const data = await res.json();
    data[dataKey].forEach((val) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val;
      selectEl.appendChild(opt);
    });
  } catch {
    // Silently skip dropdown population on network error
  }
};

// ─── Nav ──────────────────────────────────────────────────────────────────────

document.querySelectorAll('header nav a').forEach((link) => {
  if (link.getAttribute('href') === window.location.pathname) {
    link.classList.add('active');
  }
});

// ─── Filter form ──────────────────────────────────────────────────────────────

document.getElementById('filter-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const params = {};
  const name = filterNameEl.value.trim();
  const type = filterTypeEl.value;
  const weakness = filterWeaknessEl.value;
  const limit = filterLimitEl.value.trim();
  if (name) params.name = name;
  if (type) params.type = type;
  if (weakness) params.weakness = weakness;
  if (limit) params.limit = limit;
  fetchPokemon(params);
});

document.getElementById('filter-clear').addEventListener('click', () => {
  filterNameEl.value = '';
  filterTypeEl.value = '';
  filterWeaknessEl.value = '';
  filterLimitEl.value = '';
  fetchPokemon();
});

// ─── Add pokemon form ─────────────────────────────────────────────────────────

document.getElementById('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('add-name').value.trim();
  const type = parseCSV(document.getElementById('add-type').value);
  const height = document.getElementById('add-height').value.trim();
  const weight = document.getElementById('add-weight').value.trim();
  const weaknesses = parseCSV(document.getElementById('add-weaknesses').value);
  const img = document.getElementById('add-img').value.trim();

  addMsgEl.className = 'msg';

  try {
    const res = await fetch('/api/pokemon', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name, type, height, weight, weaknesses, img,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      addMsgEl.textContent = `Added: #${data.num} ${data.name} (id ${data.id})`;
      addMsgEl.classList.add('success');
      document.getElementById('add-form').reset();
      updatePreview('add', '');
      refreshGrid();
    } else {
      addMsgEl.textContent = `Error: ${data.error}`;
      addMsgEl.classList.add('error');
    }
  } catch {
    addMsgEl.textContent = 'Network error — could not reach the server.';
    addMsgEl.classList.add('error');
  }
});

// ─── Update form ──────────────────────────────────────────────────────────────

document.getElementById('lookup-btn').addEventListener('click', async () => {
  const id = document.getElementById('update-id').value.trim();
  updateMsgEl.className = 'msg';

  if (!id) {
    updateMsgEl.textContent = 'Enter a Pokemon ID first.';
    updateMsgEl.classList.add('error');
    return;
  }

  try {
    const res = await fetch(`/api/pokemon/${id}`, { headers: { Accept: 'application/json' } });

    if (!res.ok) {
      updateMsgEl.textContent = `No pokemon found with id ${id}.`;
      updateMsgEl.classList.add('error');
      updateFieldsEl.hidden = true;
      updateImgActionsEl.hidden = true;
      updateSubmitEl.hidden = true;
      return;
    }

    const p = await res.json();
    document.getElementById('update-name').value = p.name;
    document.getElementById('update-type').value = p.type.join(', ');
    document.getElementById('update-height').value = p.height;
    document.getElementById('update-weight').value = p.weight;
    document.getElementById('update-img').value = p.img || '';
    updatePreview('update', p.img || '');

    updateFieldsEl.hidden = false;
    updateImgActionsEl.hidden = false;
    updateSubmitEl.hidden = false;
    updateMsgEl.textContent = `Loaded: #${p.num} ${p.name}`;
    updateMsgEl.classList.add('success');
  } catch {
    updateMsgEl.textContent = 'Network error — could not reach the server.';
    updateMsgEl.classList.add('error');
  }
});

document.getElementById('update-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = parseInt(document.getElementById('update-id').value.trim(), 10);
  const body = { id };

  const name = document.getElementById('update-name').value.trim();
  const type = document.getElementById('update-type').value.trim();
  const height = document.getElementById('update-height').value.trim();
  const weight = document.getElementById('update-weight').value.trim();
  const img = document.getElementById('update-img').value.trim();

  if (name) body.name = name;
  if (type) body.type = parseCSV(type);
  if (height) body.height = height;
  if (weight) body.weight = weight;
  body.img = img; // always send img (allows clearing it too)

  updateMsgEl.className = 'msg';

  try {
    const res = await fetch('/api/pokemon/update', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.status === 204) {
      updateMsgEl.textContent = 'Pokemon updated successfully.';
      updateMsgEl.classList.add('success');
      updateFieldsEl.hidden = true;
      updateImgActionsEl.hidden = true;
      updateSubmitEl.hidden = true;
      updatePreview('update', '');
      document.getElementById('update-form').reset();
      refreshGrid();
    } else {
      const data = await res.json();
      updateMsgEl.textContent = `Error: ${data.error}`;
      updateMsgEl.classList.add('error');
    }
  } catch {
    updateMsgEl.textContent = 'Network error — could not reach the server.';
    updateMsgEl.classList.add('error');
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────

Promise.all([
  populateSelect(filterTypeEl, '/api/types', 'types'),
  populateSelect(filterWeaknessEl, '/api/weaknesses', 'weaknesses'),
  fetchPokemon(),
]).catch(console.error);
