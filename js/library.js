import { supabase } from "./supabase.js";

const PAGE_SIZE = 5;
const STATUS_LABELS = {
  recorded: "Recorded", downloaded: "Downloaded", editing: "Editing", edited: "Edited",
  ready: "Ready", scheduled: "Scheduled", published: "Published", skipped: "Skipped"
};
const VIDEO_STATUSES = Object.keys(STATUS_LABELS);
const CONTENT_STATUSES = ["editing", "edited", "ready", "scheduled", "published"];

export async function initLibrary() {
  const root = document.getElementById("libraryWorkspace");
  const view = document.getElementById("libraryView");
  if (!root || !view) return;

  let activeView = "creators";
  let pages = { creators: 1, videos: 1, content: 1 };
  let cache = { creators: null, videos: null, content: null, tags: null };
  let dirtyForm = false;

  root.querySelectorAll("[data-library-view]").forEach(button => button.addEventListener("click", () => {
    activeView = button.dataset.libraryView;
    root.querySelectorAll("[data-library-view]").forEach(b => b.classList.toggle("active", b === button));
    render();
  }));

  async function load(viewName) {
    if (cache[viewName]) return cache[viewName];
    if (viewName === "creators") {
      const { data, error } = await supabase.from("creators")
        .select("id,creator_code,creator_name,handle,platform,niche_id,profile_url,download_path,creator_type,content_style,source_quality,priority,follower_count,notes,status,created_at,niches(name,niche_code)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      cache.creators = data || [];
    } else {
      const { data, error } = await supabase.from("videos")
        .select("id,video_id,platform,platform_url,title,caption,hook,status,published_at,views,likes,comments,shares,saves,followers_gained,created_at,creator_id,niche_id,pillar_id,topic_id,creators(creator_name,handle,creator_code),niches(name,niche_code),pillars(name,pillar_code),topics(name,topic_code)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      cache.videos = data || [];
      cache.content = cache.videos.filter(v => CONTENT_STATUSES.includes(v.status));
    }
    return cache[viewName];
  }

  async function loadTags() {
    if (cache.tags) return cache.tags;
    const { data, error } = await supabase.from("tags")
      .select("id,name,pillar_id,topic_id")
      .order("name", { ascending: true });
    if (error) throw error;
    cache.tags = data || [];
    return cache.tags;
  }

  function render() {
    view.innerHTML = '<div class="card"><div class="empty-state"><div class="empty-state-icon">◌</div><strong>Loading library...</strong></div></div>';
    load(activeView).then(renderView).catch(error => {
      view.innerHTML = `<div class="card"><div class="empty-state"><div class="empty-state-icon">⚠</div><strong>Could not load ${escapeHtml(activeView)}</strong><p>${escapeHtml(error.message || "Supabase request failed.")}</p></div></div>`;
    });
  }

  function renderView(rows) {
    const toolbar = `<div class="library-toolbar"><input id="librarySearch" type="search" placeholder="Search ${activeView}..." aria-label="Search ${activeView}"><span class="library-count">${rows.length} records</span></div>`;
    const table = activeView === "creators" ? creatorTable(rows) : activeView === "videos" ? videoTable(rows) : contentTable(rows);
    view.innerHTML = `<div class="card">${toolbar}${table}</div>`;
    view.querySelector("#librarySearch")?.addEventListener("input", e => filterRows(rows, e.target.value));
    filterRows(rows, view.querySelector("#librarySearch")?.value || "");
  }

  function filterRows(rows, term) {
    const normalized = term.trim().toLowerCase();
    const filtered = !normalized ? rows : rows.filter(row => JSON.stringify(row).toLowerCase().includes(normalized));
    pages[activeView] = Math.min(pages[activeView], Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
    const start = (pages[activeView] - 1) * PAGE_SIZE;
    const pageRows = filtered.slice(start, start + PAGE_SIZE);
    const body = view.querySelector("tbody");
    if (body) body.innerHTML = activeView === "creators" ? creatorRows(pageRows) : activeView === "videos" ? videoRows(pageRows) : contentRows(pageRows);
    bindRowActions();
    renderPagination(filtered.length);
  }

  function creatorTable(rows) {
    return `<div class="table-wrapper"><table class="data-table library-table"><thead><tr><th>Creator</th><th>Handle</th><th>Platform</th><th>Niche</th><th>Download Path</th><th>Status</th><th>Actions</th></tr></thead><tbody>${creatorRows(rows.slice(0, PAGE_SIZE))}</tbody></table></div><div id="libraryPagination" class="library-pagination"></div>`;
  }
  function creatorRows(rows) {
    return rows.map(r => `<tr><td><div class="source-title">${escapeHtml(r.creator_name || "—")}</div><div class="source-subtitle">${escapeHtml(r.creator_code || "")}</div></td><td>${escapeHtml(r.handle || "—")}</td><td>${escapeHtml(r.platform || "—")}</td><td><span class="badge">${escapeHtml(r.niches?.name || "—")}</span></td><td class="path-cell" title="${escapeHtml(r.download_path || "")}">${escapeHtml(r.download_path || "—")}</td><td>${creatorStatusSelect(r)}</td><td>${actionButtons(r.id, "creator")}</td></tr>`).join("") || emptyRow(7, "No creators yet.");
  }

  function videoTable(rows) {
    return `<div class="table-wrapper"><table class="data-table library-table"><thead><tr><th>Video</th><th>Creator</th><th>Niche</th><th>Pillar / Topic</th><th>Platform</th><th>Status</th><th>Actions</th></tr></thead><tbody>${videoRows(rows.slice(0, PAGE_SIZE))}</tbody></table></div><div id="libraryPagination" class="library-pagination"></div>`;
  }
  function videoRows(rows) {
    return rows.map(r => `<tr><td><div class="source-title">${escapeHtml(r.title || r.video_id || "Untitled video")}</div><div class="source-subtitle">${escapeHtml(r.video_id || "")} ${r.platform_url ? `· <a href="${escapeHtml(r.platform_url)}" target="_blank" rel="noreferrer">Open</a>` : ""}</div></td><td><div class="source-title">${escapeHtml(r.creators?.creator_name || "—")}</div><div class="source-subtitle">${escapeHtml(r.creators?.handle || "")}</div></td><td>${escapeHtml(r.niches?.name || "—")}</td><td><div class="source-title">${escapeHtml(r.pillars?.name || "—")}</div><div class="source-subtitle">${escapeHtml(r.topics?.name || "")}</div></td><td>${escapeHtml(r.platform || "—")}</td><td>${statusSelect(r)}</td><td>${actionButtons(r.id, "video")}</td></tr>`).join("") || emptyRow(7, "No videos yet.");
  }

  function contentTable(rows) {
    return `<div class="table-wrapper"><table class="data-table library-table"><thead><tr><th>Video</th><th>Creator</th><th>Status</th><th>Title</th><th>Hook</th><th>Caption</th><th>Tags</th><th>Actions</th></tr></thead><tbody>${contentRows(rows.slice(0, PAGE_SIZE))}</tbody></table></div><div id="libraryPagination" class="library-pagination"></div>`;
  }
  function contentRows(rows) {
    return rows.map(r => `<tr><td><div class="source-title">${escapeHtml(r.video_id || r.title || "Untitled video")}</div><div class="source-subtitle">${r.platform_url ? `<a href="${escapeHtml(r.platform_url)}" target="_blank" rel="noreferrer">Open video</a>` : ""}</div></td><td>${escapeHtml(r.creators?.creator_name || r.creators?.handle || "—")}</td><td>${statusSelect(r)}</td><td>${fieldPreview(r.title)}</td><td>${fieldPreview(r.hook)}</td><td>${fieldPreview(r.caption)}</td><td><span class="tag-cell" data-video-tags="${escapeHtml(r.id)}">Loading…</span></td><td>${actionButtons(r.id, "video")}</td></tr>`).join("") || emptyRow(8, "No content in the editing workflow yet.");
  }

  function actionButtons(id, type) { return `<div class="row-actions"><button type="button" class="icon-button edit-record" data-id="${escapeHtml(id)}" data-type="${type}" title="Edit">✎</button><button type="button" class="icon-button delete-record" data-id="${escapeHtml(id)}" data-type="${type}" title="Delete">×</button></div>`; }
  function statusSelect(row) { return `<select class="inline-status" data-id="${escapeHtml(row.id)}" data-type="video" aria-label="Update video status">${VIDEO_STATUSES.map(s => `<option value="${s}" ${row.status === s ? "selected" : ""}>${STATUS_LABELS[s]}</option>`).join("")}</select>`; }
  function creatorStatusSelect(row) { return `<select class="inline-status" data-id="${escapeHtml(row.id)}" data-type="creator" aria-label="Update creator status"><option value="active" ${row.status === "active" ? "selected" : ""}>Active</option><option value="inactive" ${row.status === "inactive" ? "selected" : ""}>Inactive</option><option value="watching" ${row.status === "watching" ? "selected" : ""}>Watching</option></select>`; }
  function fieldPreview(value) { return value ? `<span class="content-preview">${escapeHtml(value)}</span>` : '<span class="field-missing">Not added</span>'; }
  function emptyRow(span, text) { return `<tr><td colspan="${span}"><div class="empty-state compact"><strong>${text}</strong></div></td></tr>`; }
  function renderPagination(total) {
    const box = view.querySelector("#libraryPagination"); if (!box) return;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (totalPages <= 1) { box.innerHTML = ""; return; }
    const current = pages[activeView];
    box.innerHTML = `<button class="pagination-button" data-page="prev" ${current === 1 ? "disabled" : ""}>‹</button>${Array.from({ length: totalPages }, (_, i) => `<button class="pagination-button ${i + 1 === current ? "active" : ""}" data-page="${i + 1}">${i + 1}</button>`).join("")}<button class="pagination-button" data-page="next" ${current === totalPages ? "disabled" : ""}>›</button>`;
    box.querySelectorAll("[data-page]").forEach(button => button.addEventListener("click", () => {
      const target = button.dataset.page;
      pages[activeView] = target === "prev" ? current - 1 : target === "next" ? current + 1 : Number(target);
      const search = view.querySelector("#librarySearch");
      filterRows(activeView === "creators" ? cache.creators : activeView === "videos" ? cache.videos : cache.content, search?.value || "");
    }));
  }

  function bindRowActions() {
    view.querySelectorAll(".inline-status").forEach(select => select.addEventListener("change", async e => {
      const id = e.target.dataset.id; const type = e.target.dataset.type; const status = e.target.value;
      e.target.disabled = true;
      try {
        const table = type === "creator" ? "creators" : "videos";
        const { error } = await supabase.from(table).update({ status }).eq("id", id);
        if (error) throw error;
        if (type === "video") { const row = cache.videos.find(v => v.id === id); if (row) row.status = status; cache.content = cache.videos.filter(v => CONTENT_STATUSES.includes(v.status)); }
        else { const row = cache.creators.find(v => v.id === id); if (row) row.status = status; }
        render();
      } catch (error) { alert(`Could not update status: ${error.message}`); e.target.disabled = false; }
    }));
    view.querySelectorAll(".edit-record").forEach(button => button.addEventListener("click", () => openEdit(button.dataset.type, button.dataset.id)));
    view.querySelectorAll(".delete-record").forEach(button => button.addEventListener("click", () => deleteRecord(button.dataset.type, button.dataset.id)));
    loadTagsForVisibleContent();
  }

  async function loadTagsForVisibleContent() {
    if (activeView !== "content") return;
    const cells = [...view.querySelectorAll("[data-video-tags]")];
    if (!cells.length) return;
    const ids = cells.map(c => c.dataset.videoTags);
    const { data, error } = await supabase.from("video_tags").select("video_id,tags(name)").in("video_id", ids);
    if (error) return;
    const grouped = {};
    (data || []).forEach(item => { (grouped[item.video_id] ||= []).push(item.tags?.name); });
    cells.forEach(cell => { const names = (grouped[cell.dataset.videoTags] || []).filter(Boolean); cell.textContent = names.length ? names.map(n => `#${n}`).join(" ") : "—"; });
  }

  async function openEdit(type, id) {
    const row = type === "creator" ? cache.creators.find(r => r.id === id) : cache.videos.find(r => r.id === id);
    if (!row) return;
    dirtyForm = false;
    const isCreator = type === "creator";
    const modal = document.createElement("div"); modal.className = "library-edit-overlay"; modal.id = "libraryEditModal";
    modal.innerHTML = isCreator ? creatorEditForm(row) : await videoEditForm(row);
    document.body.appendChild(modal);
    modal.querySelector("form")?.addEventListener("input", () => { dirtyForm = true; });
    modal.querySelector("[data-cancel-edit]")?.addEventListener("click", () => closeEdit(modal));
    modal.querySelector("form")?.addEventListener("submit", async e => { e.preventDefault(); await saveEdit(modal, type, id); });
    modal.querySelector("[data-close-edit]")?.addEventListener("click", () => closeEdit(modal));
    if (!isCreator) bindTagPicker(modal, row);
  }

  function creatorEditForm(r) {
    return `<div class="library-edit-modal"><div class="modal-header"><div><h3>Edit Creator</h3><p>Update creator information.</p></div><button type="button" class="modal-close" data-close-edit>×</button></div><form><div class="edit-grid"><label>Creator Name<input name="creator_name" value="${attr(r.creator_name)}" required></label><label>Handle / Username<input name="handle" value="${attr(r.handle)}"></label><label>Platform<input name="platform" value="${attr(r.platform)}" required></label><label>Profile URL<input name="profile_url" value="${attr(r.profile_url)}"></label><label>Creator Type<input name="creator_type" value="${attr(r.creator_type)}"></label><label>Download Path<input name="download_path" value="${attr(r.download_path)}"></label><label class="full-width">Content Style<textarea name="content_style">${escapeHtml(r.content_style || "")}</textarea></label><label class="full-width">Notes<textarea name="notes">${escapeHtml(r.notes || "")}</textarea></label></div><div class="modal-actions"><button type="button" class="button secondary" data-cancel-edit>Cancel</button><button type="submit" class="button primary">Save</button></div></form></div>`;
  }

  async function videoEditForm(r) {
    let pillars = [], topics = [];
    const [p, t] = await Promise.all([
      supabase.from("pillars").select("id,name,pillar_code").eq("niche_id", r.niche_id).order("sort_order"),
      supabase.from("topics").select("id,name,topic_code,pillar_id").eq("niche_id", r.niche_id).order("sort_order")
    ]);
    pillars = p.data || []; topics = t.data || [];
    return `<div class="library-edit-modal"><div class="modal-header"><div><h3>Edit Video</h3><p>Update content details without changing the video record.</p></div><button type="button" class="modal-close" data-close-edit>×</button></div><form><div class="edit-grid"><label>Video ID<input value="${attr(r.video_id)}" disabled></label><label>Video URL<input name="platform_url" value="${attr(r.platform_url)}"></label><label>Title<input name="title" value="${attr(r.title)}"></label><label>Hook<input name="hook" value="${attr(r.hook)}"></label><label>Pillar<select name="pillar_id" id="editPillar"><option value="">Select pillar</option>${pillars.map(p => `<option value="${p.id}" ${p.id === r.pillar_id ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}</select></label><label>Topic<select name="topic_id" id="editTopic"><option value="">Select topic</option>${topics.map(t => `<option value="${t.id}" data-pillar="${t.pillar_id}" ${t.id === r.topic_id ? "selected" : ""}>${escapeHtml(t.name)}</option>`).join("")}</select></label><label class="full-width">Caption<textarea name="caption">${escapeHtml(r.caption || "")}</textarea></label><div class="full-width"><div class="field-label">Tags / Hashtags</div><div class="tag-picker" id="editTagPicker"><div class="tag-chips" data-selected-tags></div><input data-tag-input placeholder="Search or create tag..."><div class="tag-suggestions" data-tag-suggestions></div></div></div></div><div class="modal-actions"><button type="button" class="button secondary" data-cancel-edit>Cancel</button><button type="submit" class="button primary">Save</button></div></form></div>`;
  }

  async function bindTagPicker(modal, row) {
    const picker = modal.querySelector("#editTagPicker"); if (!picker) return;
    const tags = await loadTags();
    const { data: linked } = await supabase.from("video_tags").select("tag_id,tags(id,name,pillar_id,topic_id)").eq("video_id", row.id);
    const selected = (linked || []).map(x => x.tags).filter(Boolean);
    const selectedIds = new Set(selected.map(t => t.id));
    const renderSelected = () => { picker.querySelector("[data-selected-tags]").innerHTML = selected.map(t => `<span class="tag-chip">#${escapeHtml(t.name)} <button type="button" data-remove-tag="${t.id}">×</button></span>`).join(""); picker.querySelectorAll("[data-remove-tag]").forEach(b => b.addEventListener("click", () => { const i = selected.findIndex(t => t.id === b.dataset.removeTag); if (i >= 0) { selectedIds.delete(selected[i].id); selected.splice(i, 1); renderSelected(); dirtyForm = true; } })); };
    const suggestions = picker.querySelector("[data-tag-suggestions]");
    const input = picker.querySelector("[data-tag-input]");
    const refresh = () => {
      const q = input.value.trim().toLowerCase();
      const matching = tags.filter(t => !selectedIds.has(t.id) && (!q || t.name.toLowerCase().includes(q)) && (!row.pillar_id || !t.pillar_id || t.pillar_id === row.pillar_id) && (!row.topic_id || !t.topic_id || t.topic_id === row.topic_id)).slice(0, 8);
      suggestions.innerHTML = matching.map(t => `<button type="button" data-tag-id="${t.id}">#${escapeHtml(t.name)}</button>`).join("") + (q && !tags.some(t => t.name.toLowerCase() === q) ? `<button type="button" data-create-tag="${escapeHtml(input.value.trim())}">＋ Create #${escapeHtml(input.value.trim())}</button>` : "");
      suggestions.querySelectorAll("[data-tag-id]").forEach(b => b.addEventListener("click", () => { const t = tags.find(x => x.id === b.dataset.tagId); if (t) { selected.push(t); selectedIds.add(t.id); renderSelected(); input.value = ""; refresh(); dirtyForm = true; } }));
      suggestions.querySelector("[data-create-tag]")?.addEventListener("click", async () => {
        const name = input.value.trim().replace(/^#/, ""); if (!name) return;
        const { data, error } = await supabase.from("tags").insert({ name, pillar_id: row.pillar_id || null, topic_id: row.topic_id || null }).select("id,name,pillar_id,topic_id").single();
        if (error) { alert(`Could not create tag: ${error.message}`); return; }
        tags.push(data); selected.push(data); selectedIds.add(data.id); renderSelected(); input.value = ""; refresh(); dirtyForm = true;
      });
    };
    renderSelected(); input.addEventListener("input", refresh); refresh();
  }

  async function saveEdit(modal, type, id) {
    const form = modal.querySelector("form"); const fd = new FormData(form);
    const table = type === "creator" ? "creators" : "videos";
    const payload = {};
    for (const [key, value] of fd.entries()) payload[key] = value === "" ? null : value;
    if (type === "video") { payload.pillar_id = payload.pillar_id || null; payload.topic_id = payload.topic_id || null; }
    const { error } = await supabase.from(table).update(payload).eq("id", id);
    if (error) { alert(`Could not save changes: ${error.message}`); return; }
    if (type === "video") {
      const row = cache.videos.find(v => v.id === id); if (row) Object.assign(row, payload);
      await saveVideoTags(modal, id);
      cache.content = cache.videos.filter(v => CONTENT_STATUSES.includes(v.status));
    } else { const row = cache.creators.find(v => v.id === id); if (row) Object.assign(row, payload); }
    dirtyForm = false; modal.remove(); render();
  }

  async function saveVideoTags(modal, videoId) {
    const selected = [...modal.querySelectorAll("[data-selected-tags] .tag-chip")].map(chip => chip.querySelector("button")?.dataset.removeTag).filter(Boolean);
    await supabase.from("video_tags").delete().eq("video_id", videoId);
    if (selected.length) await supabase.from("video_tags").insert(selected.map(tag_id => ({ video_id: videoId, tag_id })));
  }

  function closeEdit(modal) {
    if (!dirtyForm) { modal.remove(); return; }
    const discard = window.confirm("Bạn có muốn không lưu những gì đã chỉnh sửa không?");
    if (discard) { dirtyForm = false; modal.remove(); }
  }

  async function deleteRecord(type, id) {
    if (!window.confirm("Bạn có chắc muốn xóa record này không?")) return;
    const table = type === "creator" ? "creators" : "videos";
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) { alert(`Could not delete record: ${error.message}`); return; }
    cache[type === "creator" ? "creators" : "videos"] = null;
    cache.content = null;
    render();
  }

  function attr(value) { return escapeHtml(value ?? ""); }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#039;", '"':"&quot;" }[c])); }

  render();
}
