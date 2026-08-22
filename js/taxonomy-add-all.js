import { supabase } from "./supabase.js";

const TYPES = [
  { key: "niches", label: "Niches", columns: ["name", "niche_code", "description", "status"] },
  { key: "pillars", label: "Pillars", columns: ["name", "pillar_code", "niche_code", "description", "status"] },
  { key: "topics", label: "Topics", columns: ["name", "topic_code", "niche_code", "pillar_code", "description", "status"] },
  { key: "keywords", label: "Keywords", columns: ["keyword", "keyword_code", "niche_code", "pillar_code", "topic_code", "category", "vietnamese_meaning", "platform", "status"] },
  { key: "tags", label: "Tags", columns: ["name", "niche_code", "pillar_code", "topic_code", "description"] }
];

let initialized = false;

export function initTaxonomyAddAll() {
  if (initialized) return;
  initialized = true;
  document.addEventListener("click", event => {
    if (event.target.closest("#taxonomyAddAllButton")) open();
  });
}

function open() {
  document.getElementById("taxonomyAddAllModal")?.remove();
  const modal = document.createElement("div");
  modal.id = "taxonomyAddAllModal";
  modal.className = "library-edit-overlay";
  modal.innerHTML = `<div class="library-edit-modal taxonomy-add-all-modal">
    <div class="modal-header"><div><h3>Add All Taxonomy</h3><p>Prepare Niche, Pillar, Topic, Keyword and Tag CSV files, then import them together.</p></div><button class="modal-close" data-close>×</button></div>
    <div class="taxonomy-all-grid">${TYPES.map(type => `<div class="taxonomy-all-card" data-type="${type.key}"><div><strong>${type.label}</strong><small>${type.columns.join(" · ")}</small></div><div class="taxonomy-all-actions"><button type="button" class="button secondary" data-template="${type.key}">Download template</button><label class="button secondary">Choose CSV<input type="file" accept=".csv,text/csv" data-file="${type.key}" hidden></label></div><div class="taxonomy-all-file" data-file-name="${type.key}">No file selected</div><div class="taxonomy-all-count" data-count="${type.key}"></div></div>`).join("")}</div>
    <div class="add-form-message hidden" data-message></div>
    <div class="modal-actions"><button type="button" class="button secondary" data-close>Cancel</button><button type="button" class="button primary" data-import-all>Import All</button></div>
  </div>`;
  document.body.appendChild(modal);
  modal.querySelectorAll("[data-close]").forEach(button => button.onclick = () => modal.remove());
  modal.querySelectorAll("[data-template]").forEach(button => button.onclick = () => downloadTemplate(button.dataset.template));
  modal.querySelectorAll("[data-file]").forEach(input => input.onchange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const type = input.dataset.file;
    const card = modal.querySelector(`[data-type="${type}"]`);
    try {
      const rows = parseCsv(await file.text());
      card._rows = rows;
      card.querySelector(`[data-file-name="${type}"]`).textContent = file.name;
      card.querySelector(`[data-count="${type}"]`).textContent = `${rows.length} rows ready`;
    } catch (error) { showMessage(modal, error.message || "Could not read CSV.", true); }
  });
  modal.querySelector("[data-import-all]").onclick = () => importAll(modal);
}

async function importAll(modal) {
  const button = modal.querySelector("[data-import-all]");
  button.disabled = true;
  try {
    const summary = [];
    for (const type of TYPES) {
      const rows = modal.querySelector(`[data-type="${type.key}"]`)?._rows || [];
      if (!rows.length) continue;
      const count = await importType(type.key, rows);
      summary.push(`${count} ${type.label.toLowerCase()}`);
    }
    if (!summary.length) throw new Error("Choose at least one CSV file to import.");
    showMessage(modal, `Imported: ${summary.join(", ")}.`, false);
    document.dispatchEvent(new CustomEvent("content-os:data-changed", { detail: { type: "taxonomy" } }));
    setTimeout(() => { modal.remove(); window.location.hash = "#taxonomy"; }, 800);
  } catch (error) { showMessage(modal, error.message || "Import failed.", true); button.disabled = false; }
}

async function importType(type, rows) {
  const valid = rows.filter(row => (row.name || row.keyword || "").trim());
  if (!valid.length) return 0;
  const { data: niches } = await supabase.from("niches").select("id,niche_code");
  const { data: pillars } = await supabase.from("pillars").select("id,pillar_code");
  const { data: topics } = await supabase.from("topics").select("id,topic_code");
  const nicheMap = new Map((niches || []).map(row => [norm(row.niche_code), row.id]));
  const pillarMap = new Map((pillars || []).map(row => [norm(row.pillar_code), row.id]));
  const topicMap = new Map((topics || []).map(row => [norm(row.topic_code), row.id]));
  const payload = valid.map(row => {
    const p = { ...row };
    delete p.niche_code; delete p.pillar_code; delete p.topic_code;
    if (type === "niches") { p.name = p.name?.trim(); p.status = p.status || "active"; }
    if (type === "pillars") { p.niche_id = nicheMap.get(norm(row.niche_code)) || null; p.status = p.status || "active"; }
    if (type === "topics") { p.niche_id = nicheMap.get(norm(row.niche_code)) || null; p.pillar_id = pillarMap.get(norm(row.pillar_code)) || null; p.status = p.status || "active"; }
    if (type === "keywords") { p.niche_id = nicheMap.get(norm(row.niche_code)) || null; p.pillar_id = pillarMap.get(norm(row.pillar_code)) || null; p.topic_id = topicMap.get(norm(row.topic_code)) || null; p.status = p.status || "active"; }
    if (type === "tags") { p.niche_id = nicheMap.get(norm(row.niche_code)) || null; p.pillar_id = pillarMap.get(norm(row.pillar_code)) || null; p.topic_id = topicMap.get(norm(row.topic_code)) || null; p.slug = slug(row.name); }
    return p;
  });
  const { error } = await supabase.from(type).insert(payload);
  if (error) throw new Error(`${type}: ${error.message}`);
  return payload.length;
}

function downloadTemplate(type) {
  const cfg = TYPES.find(item => item.key === type);
  const csv = `${cfg.columns.join(",")}\n${cfg.columns.map(() => "").join(",")}\n`;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  link.download = `${type}-template.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
function parseCsv(text) {
  const lines = [], parsed = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (c === '"') { if (quoted && next === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) { if (c === "\r" && next === "\n") i++; row.push(cell); if (row.some(v => v.trim())) lines.push(row); row = []; cell = ""; }
    else cell += c;
  }
  row.push(cell); if (row.some(v => v.trim())) lines.push(row);
  const headers = (lines.shift() || []).map(v => v.trim());
  lines.forEach(values => parsed.push(Object.fromEntries(headers.map((header, i) => [header, (values[i] || "").trim()]))));
  return parsed;
}
function norm(value) { return String(value || "").trim().toLowerCase(); }
function slug(value) { return norm(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function showMessage(modal, text, error) { const box = modal.querySelector("[data-message]"); box.textContent = text; box.classList.toggle("error", Boolean(error)); box.classList.remove("hidden"); }
