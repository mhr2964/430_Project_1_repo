// Populates type/weakness dropdowns from the API on load, then fetches all pokemon.

const resultsEl = document.getElementById('results');
const filterTypeEl = document.getElementById('filter-type');
const filterWeaknessEl = document.getElementById('filter-weakness');
const filterLimitEl = document.getElementById('filter-limit');
const addMsgEl = document.getElementById('add-msg');
const updateMsgEl = document.getElementById('update-msg');

/** Renders an array of pokemon as cards in the results grid. */
const renderPokemon = (list) => {
  if (list.length === 0) {
    resultsEl.innerHTML = '<p style="color:#718096">No pokemon match the current filters.</p>';
    return;
  }
  resultsEl.innerHTML = list.map((p) => `
    <div class="card">
      <h3>#${p.num} ${p.name}</h3>
      <p><strong>Type:</strong> ${p.type.join(', ')}</p>
      <p><strong>Height:</strong> ${p.height} &nbsp;|&nbsp; <strong>Weight:</strong> ${p.weight}</p>
      <p><strong>Weaknesses:</strong> ${p.weaknesses.join(', ') || 'none'}</p>
      ${p.next_evolution && p.next_evolution.length > 0
    ? `<p><strong>Evolves to:</strong> ${p.next_evolution.map((e) => e.name).join(' → ')}</p>`
    : ''}
    </div>
  `).join('');
};

/** Fetches pokemon from the API with optional filter query params. */
const fetchPokemon = async (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  const url = `/api/pokemon${qs ? `?${qs}` : ''}`;

  const res = await fetch(url, { headers: { Accept: 'application/json' } });

  if (!res.ok) {
    const err = await res.json();
    resultsEl.innerHTML = `<p class="msg error">Error: ${err.error}</p>`;
    return;
  }

  const data = await res.json();
  renderPokemon(data.pokemon);
};

/** Populates a <select> element with options from an API array endpoint. */
const populateSelect = async (selectEl, apiPath, dataKey) => {
  const res = await fetch(apiPath, { headers: { Accept: 'application/json' } });
  if (!res.ok) return;
  const data = await res.json();
  data[dataKey].forEach((val) => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = val;
    selectEl.appendChild(opt);
  });
};

// --- Filter form ---
document.getElementById('filter-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const params = {};
  const type = filterTypeEl.value;
  const weakness = filterWeaknessEl.value;
  const limit = filterLimitEl.value.trim();
  if (type) params.type = type;
  if (weakness) params.weakness = weakness;
  if (limit) params.limit = limit;
  fetchPokemon(params);
});

document.getElementById('filter-clear').addEventListener('click', () => {
  filterTypeEl.value = '';
  filterWeaknessEl.value = '';
  filterLimitEl.value = '';
  fetchPokemon();
});

// --- Add pokemon form ---
document.getElementById('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('add-name').value.trim();
  const type = document.getElementById('add-type').value.split(',').map((s) => s.trim()).filter(Boolean);
  const height = document.getElementById('add-height').value.trim();
  const weight = document.getElementById('add-weight').value.trim();
  const weaknesses = document.getElementById('add-weaknesses').value.split(',').map((s) => s.trim()).filter(Boolean);

  const res = await fetch('/api/pokemon', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name, type, height, weight, weaknesses,
    }),
  });

  const data = await res.json();
  addMsgEl.className = 'msg';

  if (res.ok) {
    addMsgEl.textContent = `Added: #${data.num} ${data.name} (id ${data.id})`;
    addMsgEl.classList.add('success');
    document.getElementById('add-form').reset();
  } else {
    addMsgEl.textContent = `Error: ${data.error}`;
    addMsgEl.classList.add('error');
  }
});

// --- Update pokemon form ---
document.getElementById('update-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = parseInt(document.getElementById('update-id').value.trim(), 10);
  const body = { id };

  const name = document.getElementById('update-name').value.trim();
  const type = document.getElementById('update-type').value.trim();
  const height = document.getElementById('update-height').value.trim();
  const weight = document.getElementById('update-weight').value.trim();

  if (name) body.name = name;
  if (type) body.type = type.split(',').map((s) => s.trim()).filter(Boolean);
  if (height) body.height = height;
  if (weight) body.weight = weight;

  const res = await fetch('/api/pokemon/update', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  updateMsgEl.className = 'msg';

  if (res.status === 204) {
    updateMsgEl.textContent = 'Pokemon updated successfully.';
    updateMsgEl.classList.add('success');
    document.getElementById('update-form').reset();
  } else {
    const data = await res.json();
    updateMsgEl.textContent = `Error: ${data.error}`;
    updateMsgEl.classList.add('error');
  }
});

// --- Init: populate dropdowns then load all pokemon ---
Promise.all([
  populateSelect(filterTypeEl, '/api/types', 'types'),
  populateSelect(filterWeaknessEl, '/api/weaknesses', 'weaknesses'),
  fetchPokemon(),
]);
