// Populates type/weakness chip pickers from the API on load, then fetches all pokemon.

const resultsEl = document.getElementById('results');
const resultsScrollEl = document.querySelector('.results-scroll');
const paginationEl = document.getElementById('pagination');
const resultCountEl = document.getElementById('result-count');
const filterNameEl = document.getElementById('filter-name');
const filterLimitEl = document.getElementById('filter-limit');
const addMsgEl = document.getElementById('add-msg');
const updateMsgEl = document.getElementById('update-msg');
const updateFieldsEl = document.getElementById('update-fields');
const updateImgActionsEl = document.getElementById('update-img-actions');
const updateSubmitEl = document.getElementById('update-submit');

// Single delegated listener — handles all current and future card clicks without re-attaching per render
resultsEl.addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  const found = allResults.find((p) => p.id === parseInt(card.dataset.id, 10));
  if (found) openDetail(found);
});
resultsEl.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const card = e.target.closest('.card');
  if (!card) return;
  const found = allResults.find((p) => p.id === parseInt(card.dataset.id, 10));
  if (found) openDetail(found);
});

const PAGE_SIZE = 20;
let allResults = [];
let currentPage = 0;
let currentParams = {};
let pickerTarget = null;
let pickerCache = null;

/** Escapes HTML special characters to prevent XSS when interpolating into innerHTML. */
const esc = (str) => String(str)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** Splits a comma-separated string into a trimmed, non-empty array. */
const parseCSV = (str) => str.split(',').map((s) => s.trim()).filter(Boolean);

/** POSTs JSON to a URL with standard Accept/Content-Type headers. */
const postJSON = (url, body) => fetch(url, {
  method: 'POST',
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});


// Type color map keyed by the capitalized type name used in the dataset
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

/** URL for the official game-accurate type badge sprite. */
const typeIconUrl = (type) => `https://play.pokemonshowdown.com/sprites/types/${type}.png`;

/** Returns an HTML span for a type badge with its canonical color (used on cards). */
const typeTag = (t) => {
  const color = TYPE_COLORS[t] || { bg: '#718096', text: '#fff' };
  return `<span class="type-badge" style="background:${color.bg};color:${color.text}">${esc(t)}</span>`;
};

// ─── Type chip picker factory ──────────────────────────────────────────────────

/**
 * Creates a multi-select type chip picker bound to a container element.
 * Returns { load, getSelected, setSelected, clearSelected }.
 */
const createTypePicker = (containerId) => {
  const container = document.getElementById(containerId);
  const selected = new Set();

  /** Renders all chips from an API array endpoint. */
  const load = async (apiPath, dataKey) => {
    try {
      const res = await fetch(apiPath, { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const data = await res.json();

      data[dataKey].forEach((val) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'type-chip';
        btn.dataset.value = val;
        btn.title = val;

        const img = document.createElement('img');
        img.src = typeIconUrl(val);
        img.alt = val;
        img.className = 'type-icon-img';
        // Fallback to colored text badge if sprite fails to load
        img.onerror = () => {
          const color = TYPE_COLORS[val] || { bg: '#718096', text: '#fff' };
          btn.style.background = color.bg;
          btn.style.color = color.text;
          img.replaceWith(Object.assign(document.createElement('span'), { className: 'chip-name', textContent: val }));
        };
        btn.appendChild(img);

        btn.addEventListener('click', () => {
          if (selected.has(val)) {
            selected.delete(val);
            btn.classList.remove('selected');
          } else {
            selected.add(val);
            btn.classList.add('selected');
          }
        });

        container.appendChild(btn);
      });
    } catch {
      // Silently skip on network error
    }
  };

  const getSelected = () => [...selected];

  const setSelected = (values) => {
    selected.clear();
    container.querySelectorAll('.type-chip').forEach((btn) => {
      btn.classList.remove('selected');
      if (values.includes(btn.dataset.value)) {
        selected.add(btn.dataset.value);
        btn.classList.add('selected');
      }
    });
  };

  const clearSelected = () => {
    selected.clear();
    container.querySelectorAll('.type-chip.selected').forEach((btn) => btn.classList.remove('selected'));
  };

  return {
    load, getSelected, setSelected, clearSelected,
  };
};

// Instantiate all four pickers
const filterTypePicker = createTypePicker('type-picker');
const filterWeaknessPicker = createTypePicker('weakness-picker');
const addTypePicker = createTypePicker('add-type-picker');
const updateTypePicker = createTypePicker('update-type-picker');

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

['add', 'update'].forEach((prefix) => {
  document.getElementById(`${prefix}-img`).addEventListener('input', (e) => {
    updatePreview(prefix, e.target.value.trim());
  });
});

// ─── Pokemon detail modal ─────────────────────────────────────────────────────

const detailDialog = document.getElementById('pokemon-detail');
const detailContent = document.getElementById('detail-content');

/** Fetches a pokemon by num string and opens its detail modal. */
const fetchAndOpenDetail = async (num) => {
  try {
    const res = await fetch(`/api/pokemon/${num}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return;
    openDetail(await res.json());
  } catch { /* silently ignore network errors */ }
};

/**
 * Builds the full evolution chain for a pokemon by combining prev + current + next.
 * prev_evolution is ordered base-first; next_evolution is ordered next-first.
 */
const buildChain = (p) => [
  ...(p.prev_evolution || []),
  { num: p.num, name: p.name, current: true },
  ...(p.next_evolution || []),
];

/** Builds and opens the detail modal for a given pokemon object. */
const openDetail = (p) => {
  const chain = buildChain(p);
  const chainHtml = chain.length > 1
    ? `<div class="detail-section">
        <h4>Evolution Chain</h4>
        <div class="evo-chain">
          ${chain.map((e, i) => `
            ${i > 0 ? '<span class="evo-arrow">→</span>' : ''}
            ${e.current
              ? `<span class="evo-current">${esc(e.name)}</span>`
              : `<button type="button" class="evo-link" data-num="${esc(e.num)}">${esc(e.name)}</button>`
            }
          `).join('')}
        </div>
      </div>`
    : '';

  detailContent.innerHTML = `
    <div class="detail-hero">
      ${p.img ? `<img class="detail-img" src="${esc(p.img)}" alt="${esc(p.name)}" onerror="this.style.display='none'" />` : ''}
      <div class="detail-header">
        <p class="detail-num">#${esc(p.num)}</p>
        <h2 class="detail-name">${esc(p.name)}</h2>
        <div class="type-list">${p.type.map(typeTag).join('')}</div>
      </div>
    </div>
    <div class="detail-stats">
      <div class="stat-box"><span class="stat-label">Height</span><span class="stat-val">${esc(p.height)}</span></div>
      <div class="stat-box"><span class="stat-label">Weight</span><span class="stat-val">${esc(p.weight)}</span></div>
      <div class="stat-box"><span class="stat-label">ID</span><span class="stat-val">${p.id}</span></div>
    </div>
    ${p.weaknesses.length ? `<div class="detail-section"><h4>Weaknesses</h4><div class="type-list">${p.weaknesses.map(typeTag).join('')}</div></div>` : ''}
    ${chainHtml}
  `;

  detailContent.querySelectorAll('.evo-link').forEach((btn) => {
    btn.addEventListener('click', () => fetchAndOpenDetail(btn.dataset.num));
  });

  if (!detailDialog.open) detailDialog.showModal();
};

document.getElementById('detail-close').addEventListener('click', () => detailDialog.close());
detailDialog.addEventListener('click', (e) => { if (e.target === detailDialog) detailDialog.close(); });

// ─── Image picker modal ────────────────────────────────────────────────────────

const pickerDialog = document.getElementById('img-picker');
const pickerGrid = document.getElementById('picker-grid');
const pickerSearch = document.getElementById('picker-search');

const selectImage = (url) => {
  document.getElementById(`${pickerTarget}-img`).value = url;
  updatePreview(pickerTarget, url);
  pickerDialog.close();
};

/** Opens the image picker, using cached data after first load. */
const openPicker = async () => {
  pickerGrid.innerHTML = '<p class="picker-msg">Loading sprites…</p>';
  pickerSearch.value = '';
  pickerDialog.showModal();

  try {
    if (!pickerCache) {
      const res = await fetch('/api/pokemon', { headers: { Accept: 'application/json' } });
      const data = await res.json();
      pickerCache = data.pokemon.filter((p) => p.img);
    }

    pickerGrid.innerHTML = pickerCache.map((p) => `
      <button type="button" class="picker-item" data-url="${esc(p.img)}" title="${esc(p.name)}">
        <img src="${esc(p.img)}" alt="${esc(p.name)}" onerror="this.parentElement.style.display='none'" />
        <span>${esc(p.name)}</span>
      </button>
    `).join('');

    pickerGrid.querySelectorAll('.picker-item').forEach((btn) => {
      btn.addEventListener('click', () => selectImage(btn.dataset.url));
    });
  } catch {
    pickerGrid.innerHTML = '<p class="picker-msg picker-msg--error">Failed to load images.</p>';
  }
};

pickerSearch.addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  pickerGrid.querySelectorAll('.picker-item').forEach((btn) => {
    const name = btn.querySelector('span').textContent.toLowerCase();
    btn.style.display = name.includes(q) ? '' : 'none';
  });
});

document.getElementById('picker-close').addEventListener('click', () => pickerDialog.close());
pickerDialog.addEventListener('click', (e) => { if (e.target === pickerDialog) pickerDialog.close(); });

document.querySelectorAll('[data-picker-target]').forEach((btn) => {
  btn.addEventListener('click', () => {
    pickerTarget = btn.dataset.pickerTarget;
    openPicker();
  });
});

// ─── File upload → base64 ─────────────────────────────────────────────────────

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

document.querySelectorAll('[data-upload-target]').forEach((btn) => {
  const prefix = btn.dataset.uploadTarget;
  btn.addEventListener('click', () => document.getElementById(`${prefix}-img-file`).click());
});

document.getElementById('add-img-file').addEventListener('change', () => handleFileUpload('add'));
document.getElementById('update-img-file').addEventListener('change', () => handleFileUpload('update'));

// ─── Pokemon grid rendering ───────────────────────────────────────────────────

const renderCards = (list) => {
  if (list.length === 0) {
    resultsEl.innerHTML = '<p class="empty-msg">No pokemon match the current filters.</p>';
    return;
  }

  resultsEl.innerHTML = list.map((p) => `
    <div class="card" data-id="${p.id}" role="button" tabindex="0" title="Click for details">
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
  pickerCache = null;
  const totalPages = Math.ceil(allResults.length / PAGE_SIZE);
  if (savedPage > 0 && savedPage < totalPages) {
    currentPage = savedPage;
    renderPage();
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
  const limit = filterLimitEl.value.trim();
  const types = filterTypePicker.getSelected();
  const weaknesses = filterWeaknessPicker.getSelected();
  if (name) params.name = name;
  if (types.length > 0) params.type = types.join(',');
  if (weaknesses.length > 0) params.weakness = weaknesses.join(',');
  if (limit) params.limit = limit;
  fetchPokemon(params);
});

document.getElementById('filter-clear').addEventListener('click', () => {
  filterNameEl.value = '';
  filterLimitEl.value = '';
  filterTypePicker.clearSelected();
  filterWeaknessPicker.clearSelected();
  fetchPokemon();
});

// ─── Add pokemon form ─────────────────────────────────────────────────────────

document.getElementById('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('add-name').value.trim();
  const type = addTypePicker.getSelected();
  const height = document.getElementById('add-height').value.trim();
  const weight = document.getElementById('add-weight').value.trim();
  const weaknesses = parseCSV(document.getElementById('add-weaknesses').value);
  const img = document.getElementById('add-img').value.trim();

  addMsgEl.className = 'msg';

  if (type.length === 0) {
    addMsgEl.textContent = 'Select at least one type.';
    addMsgEl.classList.add('error');
    return;
  }

  try {
    const res = await postJSON('/api/pokemon', {
      name, type, height, weight, weaknesses, img,
    });
    const data = await res.json();

    if (res.ok) {
      addMsgEl.textContent = `Added: #${data.num} ${data.name} (id ${data.id})`;
      addMsgEl.classList.add('success');
      document.getElementById('add-form').reset();
      addTypePicker.clearSelected();
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
    document.getElementById('update-height').value = p.height;
    document.getElementById('update-weight').value = p.weight;
    document.getElementById('update-img').value = p.img || '';
    updateTypePicker.setSelected(p.type);
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
  const type = updateTypePicker.getSelected();
  const height = document.getElementById('update-height').value.trim();
  const weight = document.getElementById('update-weight').value.trim();
  const img = document.getElementById('update-img').value.trim();

  if (name) body.name = name;
  if (type.length > 0) body.type = type;
  if (height) body.height = height;
  if (weight) body.weight = weight;
  body.img = img;

  updateMsgEl.className = 'msg';

  try {
    const res = await postJSON('/api/pokemon/update', body);

    if (res.status === 204) {
      updateMsgEl.textContent = 'Pokemon updated successfully.';
      updateMsgEl.classList.add('success');
      updateFieldsEl.hidden = true;
      updateImgActionsEl.hidden = true;
      updateSubmitEl.hidden = true;
      updateTypePicker.clearSelected();
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
  filterTypePicker.load('/api/types', 'types'),
  filterWeaknessPicker.load('/api/weaknesses', 'weaknesses'),
  addTypePicker.load('/api/types', 'types'),
  updateTypePicker.load('/api/types', 'types'),
  fetchPokemon(),
]).catch(console.error);
