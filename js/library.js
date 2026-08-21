import { supabase } from "./supabase.js";

const PAGE_SIZE = 10;
const VIDEO_STATUSES = ["recorded","downloaded","editing","edited","ready","scheduled","published","skipped"];
const STATUS_LABELS = { recorded:"Recorded", downloaded:"Downloaded", editing:"Editing", edited:"Edited", ready:"Ready", scheduled:"Scheduled", published:"Published", skipped:"Skipped" };
const CONTENT_STATUSES = ["editing","edited","ready","scheduled","published"];

export async function initLibrary() {
  const root = document.getElementById("libraryWorkspace");
  const view = document.getElementById("libraryView");
  if (!root || !view) return;

  let activeView = "creators";
  let pages = { creators: 1, videos: 1, content: 1, products: 1 };
  let cache = { creators: null, videos: null, content: null, products: null };

  root.querySelectorAll("[data-library-view]").forEach(button => {
    button.addEventListener("click", () => switchView(button.dataset.libraryView));
  });
  document.addEventListener("content-os:library-view", event => {
    if (root.isConnected && ["creators", "videos", "content", "products"].includes(event.detail)) switchView(event.detail);
  });
  document.addEventListener("content-os:data-changed", event => {
    if (!root.isConnected) return;
    const type = event.detail?.type;
    if (type === "creator") cache.creators = null;
    if (type === "video" || type === "content") { cache.videos = null; cache.content = null; }
    if (type === "product") cache.products = null;
    render();
  });

  function switchView(viewName) {
    activeView = viewName;
    pages[viewName] = 1;
    root.querySelectorAll("[data-library-view]").forEach(button => button.classList.toggle("active", button.dataset.libraryView === viewName));
    render();
  }

  async function load(viewName) {
    if (cache[viewName]) return cache[viewName];

    let result;
    if (viewName === "creators") {
      // Keep this request flat. PostgREST relationship paths can fail when the
      // generated relationship name differs from the foreign-key relationship.
      result = await supabase.from("creators").select("id,creator_code,creator_name,handle,platform,niche_id,profile_url,download_path,creator_type,content_style,source_quality,priority,follower_count,notes,status,created_at").order("created_at", { ascending: false });
    } else if (viewName === "products") {
      result = await supabase.from("products").select("id,product_code,niche_id,category,product_name,brand,platform,product_url,price,affiliate_url,commission_rate,repeat_purchase,affiliate_potential,notes,status,created_at").order("created_at", { ascending: false });
    } else {
      result = await supabase.from("videos").select("id,video_id,platform,platform_url,title,caption,hook,status,published_at,views,likes,comments,shares,saves,followers_gained,created_at,creator_id,niche_id,pillar_id,topic_id").order("created_at", { ascending: false });
    }
    if (result.error) throw result.error;

    const rows = result.data || [];
    if (viewName === "creators") cache.creators = rows;
    else if (viewName === "products") cache.products = rows;
    else {
      cache.videos = rows;
      cache.content = rows.filter(row => CONTENT_STATUSES.includes(row.status));
    }

    // Load lookup tables separately; none of these requests uses nested REST paths.
    if (viewName === "creators" || viewName === "products") {
      const { data: niches, error } = await supabase.from("niches").select("id,name,niche_code");
      if (error) throw error;
      const map = new Map((niches || []).map(n => [n.id, n]));
      rows.forEach(row => { row.niche = map.get(row.niche_id) || null; });
    } else {
      const [creators, niches, pillars, topics] = await Promise.all([
        supabase.from("creators").select("id,creator_name,handle,creator_code"),
        supabase.from("niches").select("id,name,niche_code"),
        supabase.from("pillars").select("id,name,pillar_code"),
        supabase.from("topics").select("id,name,topic_code")
      ]);
      const error = [creators, niches, pillars, topics].find(x => x.error)?.error;
      if (error) throw error;
      const maps = {
        creator: new Map((creators.data || []).map(x => [x.id, x])),
        niche: new Map((niches.data || []).map(x => [x.id, x])),
        pillar: new Map((pillars.data || []).map(x => [x.id, x])),
        topic: new Map((topics.data || []).map(x => [x.id, x]))
      };
      rows.forEach(row => {
        row.creator = maps.creator.get(row.creator_id) || null;
        row.niche = maps.niche.get(row.niche_id) || null;
        row.pillar = maps.pillar.get(row.pillar_id) || null;
        row.topic = maps.topic.get(row.topic_id) || null;
      });
    }
    return cache[viewName];
  }

  function render() {
    view.innerHTML = `<div class="card"><div class="empty-state"><div class="empty-state-icon">◌</div><strong>Loading...</strong></div></div>`;
    load(activeView).then(renderView).catch(error => {
      console.error(`Could not load ${activeView}:`, error);
      view.innerHTML = `<div class="card"><div class="empty-state"><strong>Could not load ${esc(activeView)}</strong><p>${esc(error.message || "Supabase request failed.")}</p><small>Check the browser console for the exact Supabase request.</small></div></div>`;
    });
  }

  function renderView(rows) {
    const addType = activeView === "creators" ? "creator" : activeView === "videos" ? "video" : activeView === "products" ? "product" : null;
    const addLabel = activeView === "creators" ? "◎ Add Creator" : activeView === "videos" ? "▶ Add Video" : activeView === "products" ? "◇ Add Product" : null;
    const addButton = addType ? `<button type="button" class="capture-button library-add-button" data-library-add="${addType}">${addLabel}</button>` : "";
    const start = (pages[activeView] - 1) * PAGE_SIZE;
    const pageRows = rows.slice(start, start + PAGE_SIZE);
    const table = activeView === "creators" ? creatorTable(pageRows) : activeView === "videos" ? videoTable(pageRows) : activeView === "content" ? contentTable(pageRows) : productTable(pageRows);
    view.innerHTML = `<div class="card"><div class="library-toolbar"><input id="librarySearch" type="search" placeholder="Search ${activeView}..." aria-label="Search ${activeView}"><span class="library-count">${rows.length} records</span>${addButton}</div>${table}<div id="libraryPagination" class="library-pagination"></div></div>`;
    view.querySelector("#librarySearch")?.addEventListener("input", event => filterRows(rows, event.target.value));
    view.querySelector("[data-library-add]")?.addEventListener("click", event => document.dispatchEvent(new CustomEvent("content-os:open-add", { detail: event.currentTarget.dataset.libraryAdd })));
    bindRows();
    pagination(rows.length);
  }

  function filterRows(rows, term) {
    const q = term.trim().toLowerCase();
    const filtered = q ? rows.filter(row => JSON.stringify(row).toLowerCase().includes(q)) : rows;
    const start = (pages[activeView] - 1) * PAGE_SIZE;
    const pageRows = filtered.slice(start, start + PAGE_SIZE);
    const body = view.querySelector("tbody");
    if (body) body.innerHTML = activeView === "creators" ? creatorRows(pageRows) : activeView === "videos" ? videoRows(pageRows) : activeView === "content" ? contentRows(pageRows) : productRows(pageRows);
    bindRows();
    pagination(filtered.length);
  }

  function creatorTable(rows) { return table(["Creator","Handle","Platform","Niche","Download Path","Status","Actions"], creatorRows(rows)); }
  function creatorRows(rows) { return rows.map(x => `<tr><td><div class="source-title">${esc(x.creator_name || "—")}</div><div class="source-subtitle">${esc(x.creator_code || "")}</div></td><td>${esc(x.handle || "—")}</td><td>${esc(x.platform || "—")}</td><td>${esc(x.niche?.name || "—")}</td><td class="path-cell">${esc(x.download_path || "—")}</td><td>${creatorStatus(x)}</td><td>${actions(x.id,"creator")}</td></tr>`).join("") || empty(7,"No creators yet."); }
  function videoTable(rows) { return table(["Video","Creator","Niche","Pillar / Topic","Platform","Status","Actions"], videoRows(rows)); }
  function videoRows(rows) { return rows.map(x => `<tr><td><div class="source-title">${esc(x.title || x.video_id || "Untitled video")}</div><div class="source-subtitle">${esc(x.video_id || "")} ${x.platform_url ? `· <a href="${esc(x.platform_url)}" target="_blank" rel="noreferrer">Open</a>` : ""}</div></td><td>${esc(x.creator?.creator_name || x.creator?.handle || "—")}</td><td>${esc(x.niche?.name || "—")}</td><td>${esc(x.pillar?.name || "—")} / ${esc(x.topic?.name || "—")}</td><td>${esc(x.platform || "—")}</td><td>${videoStatus(x)}</td><td>${actions(x.id,"video")}</td></tr>`).join("") || empty(7,"No videos yet."); }
  function contentTable(rows) { return table(["Video","Creator","Status","Title","Hook","Caption","Tags","Actions"], contentRows(rows)); }
  function contentRows(rows) { return rows.map(x => `<tr><td><div class="source-title">${esc(x.video_id || x.title || "Untitled")}</div><div class="source-subtitle">${x.platform_url ? `<a href="${esc(x.platform_url)}" target="_blank" rel="noreferrer">Open video</a>` : ""}</div></td><td>${esc(x.creator?.creator_name || x.creator?.handle || "—")}</td><td>${videoStatus(x)}</td><td>${editableCell(x.id,"title",x.title)}</td><td>${editableCell(x.id,"hook",x.hook)}</td><td>${editableCell(x.id,"caption",x.caption)}</td><td>—</td><td>${actions(x.id,"video")}</td></tr>`).join("") || empty(8,"No content in the workflow yet."); }
  function productTable(rows) { return table(["Product","Brand / Category","Platform","Price","Affiliate","Niche","Status","Actions"], productRows(rows)); }
  function productRows(rows) { return rows.map(x => `<tr><td><div class="source-title">${esc(x.product_name || "—")}</div><div class="source-subtitle">${esc(x.product_code || "")}</div></td><td>${esc([x.brand,x.category].filter(Boolean).join(" · ") || "—")}</td><td>${esc(x.platform || "—")}</td><td>${x.price == null ? "—" : esc(x.price)}</td><td>${x.affiliate_url ? `<a href="${esc(x.affiliate_url)}" target="_blank" rel="noreferrer">Link</a>` : "—"}</td><td>${esc(x.niche?.name || "—")}</td><td>${productStatus(x)}</td><td>${actions(x.id,"product")}</td></tr>`).join("") || empty(8,"No products yet."); }
  function table(headers, rows) { return `<div class="table-wrapper"><table class="data-table library-table"><thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`; }
  function actions(id,type) { return `<div class="row-actions"><button type="button" class="icon-button delete-record" data-id="${esc(id)}" data-type="${type}" title="Delete">×</button></div>`; }
  function videoStatus(x) { return `<select class="inline-status" data-id="${esc(x.id)}" data-type="video">${VIDEO_STATUSES.map(s => `<option value="${s}" ${x.status === s ? "selected" : ""}>${STATUS_LABELS[s]}</option>`).join("")}</select>`; }
  function creatorStatus(x) { return `<select class="inline-status" data-id="${esc(x.id)}" data-type="creator"><option value="active" ${x.status === "active" ? "selected" : ""}>Active</option><option value="watching" ${x.status === "watching" ? "selected" : ""}>Watching</option><option value="inactive" ${x.status === "inactive" ? "selected" : ""}>Inactive</option></select>`; }
  function productStatus(x) { return `<select class="inline-status" data-id="${esc(x.id)}" data-type="product"><option value="active" ${x.status === "active" ? "selected" : ""}>Active</option><option value="testing" ${x.status === "testing" ? "selected" : ""}>Testing</option><option value="inactive" ${x.status === "inactive" ? "selected" : ""}>Inactive</option></select>`; }
  function editableCell(id,field,value) { return `<div class="inline-editable" data-inline-edit="true" data-id="${esc(id)}" data-field="${field}">${value ? esc(value) : '<span class="field-missing">Not added</span>'}</div>`; }

  function pagination(total) {
    const box = view.querySelector("#libraryPagination");
    if (!box) return;
    const n = Math.ceil(total / PAGE_SIZE);
    if (n <= 1) { box.innerHTML = ""; return; }
    const current = pages[activeView];
    box.innerHTML = `<button class="pagination-button" data-page="prev" ${current === 1 ? "disabled" : ""}>‹</button>${Array.from({length:n}, (_,i) => `<button class="pagination-button ${i+1 === current ? "active" : ""}" data-page="${i+1}">${i+1}</button>`).join("")}<button class="pagination-button" data-page="next" ${current === n ? "disabled" : ""}>›</button>`;
    box.querySelectorAll("[data-page]").forEach(button => button.onclick = () => {
      pages[activeView] = button.dataset.page === "prev" ? current - 1 : button.dataset.page === "next" ? current + 1 : Number(button.dataset.page);
      renderView(cache[activeView]);
    });
  }

  function bindRows() {
    view.querySelectorAll(".inline-status").forEach(select => select.onchange = async event => {
      const id = event.target.dataset.id;
      const type = event.target.dataset.type;
      const tableName = type === "creator" ? "creators" : type === "product" ? "products" : "videos";
      const { error } = await supabase.from(tableName).update({ status: event.target.value }).eq("id", id);
      if (error) alert(error.message); else { cache.creators = null; cache.products = null; cache.videos = null; cache.content = null; render(); }
    });
    view.querySelectorAll("[data-inline-edit]").forEach(el => el.ondblclick = async () => {
      const row = cache.content?.find(x => x.id === el.dataset.id);
      if (!row) return;
      const field = el.dataset.field;
      const input = document.createElement(field === "caption" ? "textarea" : "input");
      input.value = row[field] || "";
      el.innerHTML = "";
      el.appendChild(input);
      input.focus();
      input.addEventListener("blur", async () => {
        const { error } = await supabase.from("videos").update({ [field]: input.value.trim() || null }).eq("id", row.id);
        if (error) alert(error.message); else { cache.videos = null; cache.content = null; render(); }
      }, { once: true });
    });
  }

  render();
}

function esc(value) { return String(value ?? "").replace(/[&<>\'\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'\"':"&quot;"}[c])); }
function empty(span, message) { return `<tr><td colspan="${span}"><div class="empty-state">${message}</div></td></tr>`; }
