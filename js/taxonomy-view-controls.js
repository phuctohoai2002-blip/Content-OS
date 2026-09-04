const STORAGE_KEY = "content-os-taxonomy-view-controls-v1";
const VIEW_FIELDS = {
  niches: ["Code", "Status"],
  pillars: ["Code", "Niche", "Status"],
  topics: ["Code", "Niche", "Pillar", "Status"],
  keywords: ["Keyword Meaning", "Keyword Category", "Niche", "Pillar", "Topic", "Platform / Status"],
  tags: ["Slug", "Niche", "Pillar", "Topic"]
};

let observer;
let state = loadState();

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function viewKey() {
  return document.querySelector("#taxonomyWorkspace [data-taxonomy-type].active")?.dataset.taxonomyType || "niches";
}
function getViewState() {
  const key = viewKey();
  if (!state[key]) state[key] = { filters: {}, columns: null };
  return state[key];
}
function normalize(value) { return String(value ?? "").trim().toLowerCase(); }
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;","'":"&#039;"}[c]));
}

function init() {
  const root = document.getElementById("taxonomyWorkspace");
  if (!root) return;
  if (root.dataset.viewControlsInitialized === "true") return;
  root.dataset.viewControlsInitialized = "true";

  observer = new MutationObserver(() => sync(root));
  observer.observe(root, { childList: true, subtree: true });
  sync(root);

  root.addEventListener("click", event => {
    const filterButton = event.target.closest("[data-tax-filter-button]");
    if (filterButton) togglePanel(root, "filter");
    const columnsButton = event.target.closest("[data-tax-columns-button]");
    if (columnsButton) togglePanel(root, "columns");
    if (event.target.closest("[data-tax-clear-filters]")) {
      getViewState().filters = {};
      saveState();
      renderControls(root);
      apply(root);
    }
  });

  root.addEventListener("change", event => {
    if (event.target.matches("[data-tax-filter-field]")) {
      const field = event.target.dataset.taxFilterField;
      const value = event.target.value;
      const filters = getViewState().filters;
      if (value) filters[field] = value; else delete filters[field];
      saveState();
      apply(root);
      renderControls(root);
    }
    if (event.target.matches("[data-tax-column-field]")) {
      const field = event.target.dataset.taxColumnField;
      const columns = getViewState().columns || {};
      columns[field] = event.target.checked;
      getViewState().columns = columns;
      saveState();
      applyColumns(root);
    }
  });
}

function sync(root) {
  const table = root.querySelector("table.library-table");
  if (!table) return;
  renderControls(root);
  apply(root);
}

function getHeaders(root) {
  return [...root.querySelectorAll("#taxonomyTableHead th")].map((th, index) => ({
    index,
    label: th.textContent.trim().replace(/\s+/g, " ")
  })).filter(h => h.label && !/^(Actions|Date Added)$/i.test(h.label) && !/^(Name|Pillar|Topic|Keyword|Tag)$/i.test(h.label));
}

function getAllHeaders(root) {
  return [...root.querySelectorAll("#taxonomyTableHead th")].map((th, index) => ({
    index,
    label: th.textContent.trim().replace(/\s+/g, " ")
  }));
}

function getRows(root) {
  return [...root.querySelectorAll("#taxonomyTableBody tr")].filter(row => row.querySelector("[data-tax-select]"));
}

function renderControls(root) {
  const toolbar = root.querySelector(".library-toolbar");
  if (!toolbar) return;
  let controls = toolbar.querySelector("[data-tax-view-controls]");
  if (!controls) {
    controls = document.createElement("div");
    controls.dataset.taxViewControls = "true";
    controls.className = "taxonomy-view-controls";
    toolbar.appendChild(controls);
  }

  const headers = getHeaders(root);
  const allHeaders = getAllHeaders(root);
  const view = viewKey();
  const configFields = VIEW_FIELDS[view] || [];
  const filterFields = headers.filter(h => configFields.includes(h.label) || h.label === "Status" || h.label === "Platform / Status");
  const viewState = getViewState();
  const activeCount = Object.keys(viewState.filters).length;
  const columnState = viewState.columns || {};

  controls.innerHTML = `
    <div class="taxonomy-control-actions">
      <button type="button" class="table-action" data-tax-filter-button>☷ Filters${activeCount ? ` <span class="taxonomy-control-count">${activeCount}</span>` : ""}</button>
      <button type="button" class="table-action" data-tax-columns-button>▦ Columns</button>
    </div>
    <div class="taxonomy-control-panel hidden" data-tax-panel="filter">
      <div class="taxonomy-panel-header"><strong>Filter ${escapeHtml(view)}</strong><button type="button" class="taxonomy-panel-clear" data-tax-clear-filters>Clear all</button></div>
      <div class="taxonomy-filter-grid">
        ${filterFields.map(field => selectHtml(field, viewState.filters[field.label] || "")).join("") || '<span class="taxonomy-empty-control">No filterable fields for this view.</span>'}
      </div>
    </div>
    <div class="taxonomy-control-panel hidden" data-tax-panel="columns">
      <div class="taxonomy-panel-header"><strong>Visible columns</strong></div>
      <div class="taxonomy-column-grid">
        ${allHeaders.filter(h => h.label && h.label !== "Actions").map(field => {
          const checked = columnState[field.label] !== false;
          return `<label><input type="checkbox" data-tax-column-field="${escapeHtml(field.label)}" ${checked ? "checked" : ""}> <span>${escapeHtml(field.label)}</span></label>`;
        }).join("")}
      </div>
    </div>`;
}

function selectHtml(field, selected) {
  const values = new Set();
  getRows(document.getElementById("taxonomyWorkspace")).forEach(row => {
    const cell = row.cells[field.index];
    if (cell) {
      const value = cell.textContent.trim().replace(/\s+/g, " ");
      if (value && value !== "—") values.add(value);
    }
  });
  const options = [...values].sort((a,b) => a.localeCompare(b)).map(value => `<option value="${escapeHtml(value)}" ${normalize(value) === normalize(selected) ? "selected" : ""}>${escapeHtml(value)}</option>`).join("");
  return `<label class="taxonomy-filter-field"><span>${escapeHtml(field.label)}</span><select data-tax-filter-field="${escapeHtml(field.label)}"><option value="">All</option>${options}</select></label>`;
}

function togglePanel(root, type) {
  const target = root.querySelector(`[data-tax-panel="${type}"]`);
  if (!target) return;
  const wasHidden = target.classList.contains("hidden");
  root.querySelectorAll("[data-tax-panel]").forEach(panel => panel.classList.add("hidden"));
  if (wasHidden) target.classList.remove("hidden");
}

function apply(root) {
  const filters = getViewState().filters;
  const headers = getHeaders(root);
  const rows = getRows(root);
  rows.forEach(row => {
    const visible = Object.entries(filters).every(([label, value]) => {
      const header = headers.find(h => h.label === label);
      if (!header) return true;
      return normalize(row.cells[header.index]?.textContent) === normalize(value);
    });
    row.style.display = visible ? "" : "none";
  });
  applyColumns(root);
}

function applyColumns(root) {
  const columns = getViewState().columns || {};
  const headers = getAllHeaders(root);
  headers.forEach(header => {
    const visible = columns[header.label] !== false;
    const cells = root.querySelectorAll(`table.library-table tr > :nth-child(${header.index + 1})`);
    cells.forEach(cell => cell.style.display = visible ? "" : "none");
  });
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("hashchange", () => setTimeout(() => init(), 0));
