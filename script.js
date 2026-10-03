const SHEET_ID = '1uS-22GKtiiWrawzIUwsqrW6wOODuYDWwo3bbD_TFK48';
const MAIN_GID = '0';
const SETTINGS_GID = '1384681035';
const AUTH_SESSION_KEY = 'aps-data-library-authenticated';
const CACHE_KEY = 'aps-data-library-cache-v2';
const state = { columns: [], rows: [], passcode: null, ready: false };
const $ = (id) => document.getElementById(id);

const loginScreen = $('login-screen');
const appScreen = $('app-screen');
const loginForm = $('login-form');
const loginMessage = $('login-message');
const passcodeInput = $('passcode');
const filtersContainer = $('filters-container');
const resultsHead = $('results-head');
const resultsBody = $('results-body');
const resultsStatus = $('results-status');
const resultTitle = $('result-title');

const csvBase = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=`;
const DATE_COLUMNS = new Set(['INV Date', 'T&C Date', 'Ex-factory', 'Expiry date']);
const HIDDEN_FILTERS = new Set(['total quantity', 'ex-factory', 'remark', 'model type 2']);
const DROPDOWN_COLUMNS = new Set(['model type']);
const NO_DROPDOWN_COLUMNS = new Set(['add', 'inv no.', 't&c pic']);

function clean(value) {
  return String(value ?? '').replace(/\uFEFF/g, '').trim();
}

function normalize(value) {
  return clean(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

async function fetchCsv(gid) {
  const response = await fetch(`${csvBase}${gid}&_=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Google Sheet request failed: ${response.status}`);
  return response.text();
}

function readPasscode(rows) {
  for (const row of rows) {
    for (let i = 0; i < row.length - 1; i += 1) {
      if (normalize(row[i]) === 'passcode' && clean(row[i + 1])) {
        return clean(row[i + 1]);
      }
    }
  }
  return null;
}

function applyData(settingsText, mainText) {
  const settings = Papa.parse(settingsText, { skipEmptyLines: true }).data;
  const parsedMain = Papa.parse(mainText, { skipEmptyLines: true }).data;

  state.passcode = readPasscode(settings);
  if (!state.passcode) throw new Error('Passcode was not found in Settings.');
  if (!parsedMain.length) throw new Error('Main sheet is empty.');

  state.columns = parsedMain[0].map(clean).filter(Boolean);
  state.rows = parsedMain.slice(1).map((row) => Object.fromEntries(
    state.columns.map((column, index) => [column, row[index] ?? ''])
  ));

  state.ready = true;
  renderFilters();
}

function readCache() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
    if (!cached?.settingsText || !cached?.mainText) return false;
    applyData(cached.settingsText, cached.mainText);
    return true;
  } catch (error) {
    console.error('Failed to read cache', error);
    return false;
  }
}

async function loadData({ preserveView = true } = {}) {
  const hadCachedData = state.ready || readCache();
  if (!hadCachedData) {
    resultsStatus.textContent = 'Loading data...';
  }

  try {
    const [settingsText, mainText] = await Promise.all([
      fetchCsv(SETTINGS_GID),
      fetchCsv(MAIN_GID),
    ]);

    applyData(settingsText, mainText);
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ settingsText, mainText }));

    if (preserveView && sessionStorage.getItem(AUTH_SESSION_KEY) === 'state.passcode') {
      showApp();
    }

    const filters = getCriteria();
    const rows = state.rows.filter((row) => matches(row, filters));
    renderResults(rows);
  } catch (error) {
    console.error(error);
    if (!hadCachedData) {
      resultTitle.textContent = 'Data unavailable';
      resultsStatus.textContent = 'Unable to load data. Check Google Sheet sharing.';
      loginMessage.textContent = 'Unable to load data. Please check the Google Sheet sharing settings.';
    }
  }
}

function valuesFor(column) {
  return [...new Set(state.rows.map((row) => clean(row[column])).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function isDateColumn(column) {
  return DATE_COLUMNS.has(column) || /date|time|created|updated/i.test(column);
}

function isHiddenFilter(column) {
  return HIDDEN_FILTERS.has(normalize(column));
}

function isDropdownColumn(column) {
  const name = normalize(column);
  return !NO_DROPDOWN_COLUMNS.has(name) && (DROPDOWN_COLUMNS.has(name) || !isDateColumn(column));
}

function makeOptions(column) {
  const wrapper = document.createElement('div');
  wrapper.className = 'filter-search-dropdown';

  const dropdown = document.createElement('div');
  dropdown.className = 'filter-dropdown';

  valuesFor(column).forEach((value) => {
    const label = document.createElement('label');
    label.className = 'option-item';
    label.dataset.value = normalize(value);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.column = column;
    checkbox.value = value;

    const text = document.createElement('span');
    text.textContent = value;

    label.append(checkbox, text);
    dropdown.appendChild(label);
  });

  wrapper.appendChild(dropdown);
  return wrapper;
}

function renderFilters() {
  filtersContainer.replaceChildren();

  state.columns.forEach((column) => {
    if (isHiddenFilter(column)) return;

    const group = document.createElement('div');
    group.className = 'filter-group';
    group.dataset.filterColumn = column;

    const inputs = document.createElement('div');
    inputs.className = 'filter-inputs';

    if (isDateColumn(column)) {
      const range = document.createElement('div');
      range.className = 'date-range';

      const from = document.createElement('input');
      from.type = 'date';
      from.dataset.column = column;
      from.dataset.filterType = 'from';
      from.placeholder = 'From';

      const to = document.createElement('input');
      to.type = 'date';
      to.dataset.column = column;
      to.dataset.filterType = 'to';
      to.placeholder = 'To';

      from.addEventListener('input', search);
      to.addEventListener('input', search);

      range.append(from, to);
      inputs.appendChild(range);
    } else {
      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.placeholder = `Search ${column}`;
      searchInput.dataset.column = column;
      searchInput.addEventListener('input', search);

      const container = document.createElement('div');
      container.className = 'search-dropdown-container';
      container.appendChild(searchInput);

      if (isDropdownColumn(column)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dropdown-arrow';
        button.innerHTML = '▼';

        const dropdown = makeOptions(column);

        button.addEventListener('click', () => {
          dropdown.classList.toggle('open');
        });

        searchInput.addEventListener('input', () => {
          const keyword = normalize(searchInput.value);
          dropdown.classList.add('open');
          dropdown.querySelectorAll('.option-item').forEach((item) => {
            const value = item.dataset.value || '';
            item.style.display = !keyword || value.includes(keyword) ? '' : 'none';
          });
        });

        container.appendChild(button);
        container.appendChild(dropdown);
      }

      inputs.appendChild(container);
    }

    group.appendChild(inputs);
    filtersContainer.appendChild(group);
  });
}

function keywords(value) {
  const text = normalize(value);
  return text ? [text] : [];
}

function matchSearch(text, search) {
  if (!text || !search) return false;

  text = normalize(text);
  search = normalize(search);

  if (search.startsWith('*') && search.endsWith('*')) {
    const parts = search
      .slice(1, -1)
      .split('*')
      .map((item) => item.trim())
      .filter(Boolean);
    return parts.every((part) => text.includes(part));
  }

  const words = search.split(/\s+/).filter(Boolean);
  return words.every((word) => text.includes(word));
}

function toDate(value) {
  const text = clean(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }

  return '';
}

function getCriteria() {
  const filters = {};

  state.columns.forEach((column) => {
    if (isHiddenFilter(column)) {
      filters[column] = { text: [], selected: [], from: '', to: '' };
      return;
    }

    const textInputs = [...document.querySelectorAll(`input[data-column="${column}"][type="text"]`)].filter(
      (input) => !input.classList.contains('header-filter-input')
    );

    const selected = [...document.querySelectorAll(`input[data-column="${column}"][type="checkbox"]:checked`)]
      .map((input) => normalize(input.value));

    const textValues = textInputs
      .map((input) => clean(input.value))
      .filter(Boolean)
      .flatMap((value) => value.split(/\s+/).filter(Boolean));

    const fromInput = document.querySelector(`input[data-column="${column}"][data-filter-type="from"]`);
    const toInput = document.querySelector(`input[data-column="${column}"][data-filter-type="to"]`);

    filters[column] = {
      text: textValues,
      selected,
      from: fromInput ? fromInput.value : '',
      to: toInput ? toInput.value : '',
    };
  });

  return filters;
}

function hasActiveCriteria(filters) {
  return Object.values(filters).some((filter) => filter.text.length || filter.selected.length || filter.from || filter.to);
}

function matches(row, filters) {
  return state.columns.every((column) => {
    const filter = filters[column] || { text: [], selected: [], from: '', to: '' };
    const value = normalize(row[column]);

    if (filter.selected.length) {
      if (!filter.selected.includes(value)) return false;
    } else if (filter.text.length && !filter.text.some((term) => matchSearch(value, term))) {
      return false;
    }

    if (filter.from || filter.to) {
      const date = toDate(row[column]);
      if (!date || (filter.from && date < filter.from) || (filter.to && date > filter.to)) {
        return false;
      }
    }

    return true;
  });
}

function validateExtendYear() {
  const column = state.columns.find((item) => normalize(item) === 'extend year');
  if (!column) return true;

  const input = [...document.querySelectorAll('input[data-column="extend year"]')].find((el) => el.type === 'text');
  if (!input) return true;

  const value = clean(input.value);
  if (!value) return true;

  const year = Number(value);
  if (Number.isNaN(year) || year < 2020 || year > 2100) {
    resultsStatus.textContent = 'Extend year must be a valid year between 2020 and 2100.';
    return false;
  }

  return true;
}

function renderResults(rows) {
  resultsHead.replaceChildren();
  resultsBody.replaceChildren();

  if (!rows.length) {
    resultTitle.textContent = 'No results';
    resultsStatus.textContent = 'No matching records were found.';
    resultsHead.innerHTML = '';
    resultsBody.innerHTML = '';
    return;
  }

  resultTitle.textContent = `${rows.length} result${rows.length === 1 ? '' : 's'}`;
  resultsStatus.textContent = 'Results updated.';

  const header = document.createElement('tr');
  state.columns.forEach((column) => {
    const th = document.createElement('th');
    th.textContent = column;
    th.className = 'result-header-cell';
    th.style.cursor = 'pointer';
    th.title = 'Click to filter by this column';
    th.dataset.column = column;

    th.addEventListener('click', () => {
      makeHeaderEditable(th, column);
    });

    header.appendChild(th);
  });

  resultsHead.appendChild(header);

  const fragment = document.createDocumentFragment();
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    state.columns.forEach((column) => {
      const td = document.createElement('td');
      const preview = document.createElement('div');
      preview.className = 'cell-preview';
      preview.textContent = row[column] ?? '';
      td.appendChild(preview);
      tr.appendChild(td);
    });
    fragment.appendChild(tr);
  });

  resultsBody.appendChild(fragment);
}

function makeHeaderEditable(headerCell, column) {
  if (headerCell.querySelector('input')) return;

  const originalText = headerCell.textContent;
  headerCell.textContent = '';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'header-filter-input';
  input.placeholder = `Filter ${column}...`;
  input.value = '';
  input.autocomplete = 'off';

  const submitBtn = document.createElement('button');
  submitBtn.textContent = '✓';
  submitBtn.className = 'header-filter-submit';
  submitBtn.type = 'button';
  submitBtn.title = 'Apply filter';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '✕';
  cancelBtn.className = 'header-filter-cancel';
  cancelBtn.type = 'button';
  cancelBtn.title = 'Cancel';

  const container = document.createElement('div');
  container.className = 'header-filter-container';
  container.append(input, submitBtn, cancelBtn);

  headerCell.appendChild(container);
  input.focus();

  const resetHeader = () => {
    headerCell.textContent = originalText;
    headerCell.style.cursor = 'pointer';
    headerCell.title = 'Click to filter by this column';
  };

  const applyFilter = () => {
    const filterValue = input.value.trim();
    resetHeader();

    if (!filterValue) {
      const filterInput = [...document.querySelectorAll(`input[data-column="${column}"][type="text"]`)].find(
        (el) => !el.classList.contains('header-filter-input')
      );
      if (filterInput) {
        filterInput.value = '';
        filterInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      search();
      return;
    }

    const filterInput = [...document.querySelectorAll(`input[data-column="${column}"][type="text"]`)].find(
      (el) => !el.classList.contains('header-filter-input')
    );

    if (filterInput) {
      filterInput.value = filterValue;
      filterInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    search();
  };

  submitBtn.addEventListener('click', applyFilter);
  cancelBtn.addEventListener('click', resetHeader);
  input.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') applyFilter();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') resetHeader();
  });
}

function search() {
  if (!state.ready) {
    resultsStatus.textContent = 'Data is still loading. Please try again in a moment.';
    return;
  }

  if (!validateExtendYear()) return;

  const filters = getCriteria();
  const rows = state.rows.filter((row) => matches(row, filters));
  renderResults(rows);
}

function reset() {
  filtersContainer.querySelectorAll('input').forEach((input) => {
    input.checked = false;
    input.value = '';
  });

  resultsHead.replaceChildren();
  resultsBody.replaceChildren();
  resultTitle.textContent = 'No results';
  resultsStatus.textContent = 'Filters reset.';

  if (state.ready) {
    renderResults(state.rows);
  }
}

function showApp() {
  loginScreen.classList.remove('active');
  appScreen.classList.add('active');
}

function showLogin() {
  appScreen.classList.remove('active');
  loginScreen.classList.add('active');
  passcodeInput.value = '';
  passcodeInput.focus();
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const entered = clean(passcodeInput.value);

  if (!state.passcode) {
    loginMessage.textContent = 'Passcode is unavailable. Please refresh and try again.';
    return;
  }

  if (entered === state.passcode) {
    sessionStorage.setItem(AUTH_SESSION_KEY, 'state.passcode');
    showApp();
    loginMessage.textContent = '';
  } else {
    loginMessage.textContent = 'Incorrect passcode.';
  }
});

$('search-btn')?.addEventListener('click', search);
$('top-search-btn')?.addEventListener('click', search);
$('reset-search-btn')?.addEventListener('click', reset);

$('refresh-btn')?.addEventListener('click', async () => {
  const button = $('refresh-btn');
  if (button) {
    button.disabled = true;
    button.textContent = 'Refreshing...';
  }

  await loadData({ preserveView: true });

  if (button) {
    button.disabled = false;
    button.textContent = 'Refresh';
  }
});

$('logout-btn')?.addEventListener('click', () => {
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  showLogin();
});

passcodeInput.addEventListener('input', (event) => {
  event.target.value = event.target.value.replace(/\s+/g, '').slice(0, 20);
});

const usedCache = readCache();
loadData({ preserveView: true, background: usedCache });

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    const dropdowns = document.querySelectorAll('.filter-dropdown.open');
    dropdowns.forEach((dropdown) => {
      const container = dropdown.closest('.search-dropdown-container');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      dropdown.classList.toggle('dropdown-right', window.innerWidth - rect.right < 520);
    });
  });
}
