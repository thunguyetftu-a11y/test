const SHEET_ID = '1uS-22GKtiiWrawzIUwsqrW6wOODuYDWwo3bbD_TFK48';
const MAIN_GID = '0';
const SETTINGS_GID = '1384681035';
const AUTH_SESSION_KEY = 'aps-data-library-authenticated';
const CACHE_KEY = 'aps-data-library-cache-v2';
const state = { columns: [], rows: [], passcode: null, ready: false };
const $ = (id) => document.getElementById(id);
const loginScreen = $('login-screen'); const appScreen = $('app-screen'); const loginForm = $('login-form');
const loginMessage = $('login-message'); const passcodeInput = $('passcode'); const filtersContainer = $('filters-container');
const resultsHead = $('results-head'); const resultsBody = $('results-body'); const resultsStatus = $('results-status'); const resultTitle = $('result-title');
const csvBase = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=`;
const DATE_COLUMNS = new Set(['INV Date', 'T&C Date', 'Ex-factory', 'Expiry date']);
const HIDDEN_FILTERS = new Set(['total quantity', 'ex-factory', 'remark', 'model type 2']);
const DROPDOWN_COLUMNS = new Set(['model type']);
const NO_DROPDOWN_COLUMNS= new Set(['add','inv no.','t&c pic']);
function clean(value) { return String(value ?? '').replace(/\uFEFF/g, '').trim(); }
function normalize(value) { return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd'); }
async function fetchCsv(gid) { const response = await fetch(`${csvBase}${gid}&_=${Date.now()}`, { cache: 'no-store' }); if (!response.ok) throw new Error(`Google Sheet request failed: ${response.s[...]
function readPasscode(rows) { for (const row of rows) for (let i = 0; i < row.length - 1; i += 1) if (normalize(row[i]) === 'passcode' && clean(row[i + 1])) return clean(row[i + 1]); return null; [...]
function applyData(settingsText, mainText) {
  const settings = Papa.parse(settingsText, { skipEmptyLines: true }).data; const parsedMain = Papa.parse(mainText, { skipEmptyLines: true }).data;
  state.passcode = readPasscode(settings); if (!state.passcode) throw new Error('Passcode was not found in Settings.'); if (!parsedMain.length) throw new Error('Main sheet is empty.');
  state.columns = parsedMain[0].map(clean).filter(Boolean); state.rows = parsedMain.slice(1).map((row) => Object.fromEntries(state.columns.map((column, index) => [column, row[index] ?? '']))); sta[...]
}
function readCache() { try { const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null'); if (!cached?.settingsText || !cached?.mainText) return false; applyData(cached.settingsText, ca[...]
async function loadData({ preserveView = true } = {}) {
  const hadCachedData = state.ready || readCache(); if (!hadCachedData) resultsStatus.textContent = 'Loading data...';
  try { const [settingsText, mainText] = await Promise.all([fetchCsv(SETTINGS_GID), fetchCsv(MAIN_GID)]); applyData(settingsText, mainText); sessionStorage.setItem(CACHE_KEY, JSON.stringify({ sett[...]
    preserveView &&
    sessionStorage.getItem(
        AUTH_SESSION_KEY
    ) === 'state.passcode'
)
{
    showApp();
}}
  catch (error) { console.error(error); if (!hadCachedData) { resultTitle.textContent = 'Data unavailable'; resultsStatus.textContent = 'Unable to load data. Check Google Sheet sharing.'; loginMes[...]
}
function valuesFor(column) { return [...new Set(state.rows.map((row) => clean(row[column])).filter(Boolean))].sort((a, b) => a.localeCompare(b)); }
function isDateColumn(column) { return DATE_COLUMNS.has(column) || /date|time|created|updated/i.test(column); }
function isHiddenFilter(column) { return HIDDEN_FILTERS.has(normalize(column)); }
function isDropdownColumn(column) {

  const name =
    normalize(column);

  return (
    !NO_DROPDOWN_COLUMNS.has(name) &&
    (
      DROPDOWN_COLUMNS.has(name) ||
      !isDateColumn(column)
    )
  );
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
  filtersContainer.replaceChildren(); state.columns.forEach((column) => { if (isHiddenFilter(column)) return; const group = document.createElement('div'); group.className = 'filter-group'; const t[...]
    if (isDateColumn(column)) { const range = document.createElement('div'); range.className = 'date-range'; const from = document.createElement('input'); from.type = 'date'; from.dataset.dateStar[...]
    else {const search = document.createElement('input');
search.type = 'text';
search.placeholder = `Search ${column}`;
search.dataset.column = column;

const container = document.createElement('div');
container.className = 'search-dropdown-container';

container.appendChild(search);

if (isDropdownColumn(column)) {

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dropdown-arrow';
    button.innerHTML = '▼';

    const dropdown = makeOptions(column);

    button.addEventListener('click', () => {

        dropdown.classList.toggle('open');

    });

    search.addEventListener('input', () => {

        const keyword = normalize(search.value);

        dropdown.classList.add('open');

        dropdown
        .querySelectorAll('.option-item')
        .forEach(item => {

            const value = item.dataset.value;

            item.style.display =
                !keyword || value.includes(keyword)
                    ? ''
                    : 'none';

        });

    });

    container.appendChild(button);
    container.appendChild(dropdown);
}

inputs.appendChild(container);  inputs.appendChild(search); search.addEventListener('input', () => {
const dropdown =inputs.querySelector('.value-dropdown');
if (!dropdown) return;const keyword =normalize(search.value);
const items =dropdown.querySelectorAll('.option-item');
if (!keyword) {items.forEach(item => {item.style.display = '';});
dropdown.open = false;return;}dropdown.open = true;items.forEach(item => {

const value =item.dataset.value || '';item.style.display =value.includes(keyword)? ''
: 'none';});});}
    group.appendChild(inputs); filtersContainer.appendChild(group);
  });
}
function keywords(value) { const text=normalize(value); return text ? [text]:[]; }
function matchSearch(text,search){if (!text || !search) {return false;}
 text = normalize(text);search=normalize(search);//*long*thanh*
if(search.startsWith('*')&&search.endsWith('*')){const parts=search.slice(1,-1).split('*').map(item=>item.trim()).filter(Boolean);return parts.every(part=>text.includes(part));}//mac dinh tim dun[...]
const words=search.split(/\s+/).filter(Boolean); return words.every(word=>
text.includes(word));}
function toDate(value) { const text = clean(value); if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text; const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (match) return `${match[3]}-${ma[...]
function getCriteria() {
  return Object.fromEntries(state.columns.map((column) => { if (isHiddenFilter(column)) return [column, { text: [], selected: [], from: '', to: '' }]; const search = [...document.querySelectorAll[...]
}
function hasActiveCriteria(filters) { return Object.values(filters).some((filter) => filter.text.length || filter.selected.length || filter.from || filter.to); }
function matches(row, filters) { return state.columns.every((column) => { const filter = filters[column]; const value = normalize(row[column]); // ưu tiên checkbox
if (filter.selected.length) {if (!filter.selected.includes(value))return false;}
else {if (filter.text.length &&!filter.text.some(term =>matchSearch(value, term))
) {return false;}}if (filter.from || filter.to) {const date = toDate(row[column]);if (!date ||
(filter.from && date < filter.from) ||(filter.to && date > filter.to)) {return false;}}return true;});}
 
function validateExtendYear() { const column = state.columns.find((item) => normalize(item) === 'extend year'); if (!column) return true; const input = [...document.querySelectorAll('input[type="[...]
function renderResults(rows) {
  resultsHead.replaceChildren(); resultsBody.replaceChildren(); if (!rows.length) { resultTitle.textContent = 'No results'; resultsStatus.textContent = 'No matching records were found.'; resultsB[...]
  resultTitle.textContent = `${rows.length} result${rows.length === 1 ? '' : 's'}`; resultsStatus.textContent = 'Results updated.'; const header = document.createElement('tr'); state.columns.forE[...]
      const th = document.createElement('th');
      th.textContent = column;
      th.className = 'result-header-cell';
      th.style.cursor = 'pointer';
      th.title = 'Click to filter by this column';
      
      // Add click handler to make header editable for filtering
      th.addEventListener('click', () => {
          makeHeaderEditable(th, column);
      });
      
      header.appendChild(th);
  }); resultsHead.appendChild(header); const fragment = document.createDocumentFragment(); rows.forEach((row) => { const tr = document.createElement('tr'); state.columns.forEach((column) => { const td = document.createElement('td');
      const preview = document.createElement('div');preview.className = 'cell-preview';preview.textContent = row[column] ?? '';
      td.appendChild(preview);tr.appendChild(td);}); fragment.appendChild(tr); }); resultsBody.appendChild(fragment);

}

function makeHeaderEditable(headerCell, column) {
  // Prevent multiple edit instances
  if (headerCell.querySelector('input')) return;
  
  const originalText = headerCell.textContent;
  headerCell.textContent = '';
  
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'header-filter-input';
  input.placeholder = `Filter ${column}...`;
  input.value = '';
  
  const submitBtn = document.createElement('button');
  submitBtn.textContent = '✓';
  submitBtn.className = 'header-filter-submit';
  submitBtn.type = 'button';
  
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '✕';
  cancelBtn.className = 'header-filter-cancel';
  cancelBtn.type = 'button';
  
  const container = document.createElement('div');
  container.className = 'header-filter-container';
  container.appendChild(input);
  container.appendChild(submitBtn);
  container.appendChild(cancelBtn);
  
  headerCell.appendChild(container);
  input.focus();
  
  const applyFilter = () => {
    const filterValue = input.value.trim();
    if (filterValue) {
      // Find the corresponding filter input and set its value
      const filterInput = document.querySelector(`input[data-column="${column}"][type="text"]`);
      if (filterInput) {
        filterInput.value = filterValue;
        filterInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    resetHeader();
  };
  
  const resetHeader = () => {
    headerCell.textContent = originalText;
    headerCell.style.cursor = 'pointer';
    headerCell.title = 'Click to filter by this column';
  };
  
  submitBtn.addEventListener('click', applyFilter);
  cancelBtn.addEventListener('click', resetHeader);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') applyFilter();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') resetHeader();
  });
}

function search() { if (!state.ready) { resultsStatus.textContent = 'Data is still loading. Please try again in a moment.'; return; } if (!validateExtendYear()) return; const filters = getCriteri[...]
function reset() { filtersContainer.querySelectorAll('input').forEach((input) => { input.checked = false; input.value = ''; }); resultsHead.replaceChildren(); resultsBody.replaceChildren(); resul[...]
function showApp() { loginScreen.classList.remove('active'); appScreen.classList.add('active'); }
function showLogin() { appScreen.classList.remove('active'); loginScreen.classList.add('active'); passcodeInput.value = ''; passcodeInput.focus(); }
loginForm.addEventListener('submit', (event) => { event.preventDefault(); const entered = clean(passcodeInput.value); if (!state.passcode) { loginMessage.textContent = 'Passcode is unavailable. C[...]
$('search-btn')?.addEventListener('click', search); $('top-search-btn')?.addEventListener('click', search); $('reset-search-btn')?.addEventListener('click', reset);
$('refresh-btn')?.addEventListener('click', async () => { const button = $('refresh-btn'); button.disabled = true; button.textContent = 'Refreshing...'; await loadData({ preserveView: true }); bu[...]
$('logout-btn')?.addEventListener('click', () => { sessionStorage.removeItem(AUTH_SESSION_KEY); showLogin(); }); passcodeInput.addEventListener('input', (event) => { event.target.value = event.ta[...]
const usedCache = readCache(); loadData({ preserveView: true, background: usedCache });
const rect = container.getBoundingClientRect();

if (window.innerWidth - rect.right < 520) {
    dropdown
      .querySelector('.filter-dropdown')
      .classList.add('dropdown-right');
}
