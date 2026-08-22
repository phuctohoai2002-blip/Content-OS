import { supabase } from "./supabase.js";

const METRICS = ["views", "likes", "comments", "shares", "saves", "followers_gained"];
const METRIC_LABELS = { views: "Views", likes: "Likes", comments: "Comments", shares: "Shares", saves: "Saves", followers_gained: "Followers Gained" };
const PAGE_SIZE = 10;

export async function initTrackingWorkspace() {
    const root = document.getElementById("trackingWorkspace");
    if (!root || root.dataset.initialized === "true") return;
    root.dataset.initialized = "true";
    let rows = [], filter = "all", search = "";

    document.addEventListener("content-os:data-changed", event => {
        if (!root.isConnected) return;
        if (["video", "tracking"].includes(event.detail?.type)) load().then(render).catch(renderError);
    });
    root.addEventListener("click", event => {
        const add = event.target.closest("[data-track-add]"); if (add) openMetricsModal();
        const bulk = event.target.closest("[data-track-bulk]"); if (bulk) document.dispatchEvent(new CustomEvent("content-os:open-bulk", { detail: { type: "tracking" } }));
        const edit = event.target.closest("[data-track-edit]"); if (edit) openMetricsModal(edit.dataset.trackEdit);
    });
    root.addEventListener("dblclick", event => { const cell = event.target.closest("[data-track-field]"); if (cell) inlineMetric(cell); });

    async function load() {
        const { data, error } = await supabase.from("videos").select("id,video_id,title,status,published_at,views,likes,comments,shares,saves,followers_gained,platform,creator_id,niche_id,pillar_id,topic_id").eq("status", "published").order("published_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
        if (error) throw error;
        rows = data || [];
        const [creators, niches, pillars, topics] = await Promise.all([
            supabase.from("creators").select("id,creator_name,handle,creator_code"),
            supabase.from("niches").select("id,name,niche_code"),
            supabase.from("pillars").select("id,name,pillar_code"),
            supabase.from("topics").select("id,name,topic_code")
        ]);
        const lookupError = [creators, niches, pillars, topics].find(result => result.error)?.error;
        if (lookupError) throw lookupError;
        const maps = {
            creator: new Map((creators.data || []).map(x => [x.id, x])),
            niche: new Map((niches.data || []).map(x => [x.id, x])),
            pillar: new Map((pillars.data || []).map(x => [x.id, x])),
            topic: new Map((topics.data || []).map(x => [x.id, x]))
        };
        rows.forEach(row => { row.creator = maps.creator.get(row.creator_id) || null; row.niche = maps.niche.get(row.niche_id) || null; row.pillar = maps.pillar.get(row.pillar_id) || null; row.topic = maps.topic.get(row.topic_id) || null; });
    }

    function render() {
        const needle = search.trim().toLowerCase();
        const filtered = rows.filter(row => {
            const matchesFilter = filter === "all" || (filter === "low" ? Number(row.views || 0) < 1000 : Number(row.views || 0) >= 1000);
            return matchesFilter && (!needle || JSON.stringify(row).toLowerCase().includes(needle));
        });
        const total = key => rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
        const avgViews = rows.length ? Math.round(total("views") / rows.length) : 0;
        const pageRows = filtered.slice(0, PAGE_SIZE);
        root.innerHTML = `<div class="stat-grid tracking-stats"><div class="stat-card"><div class="stat-label">PUBLISHED</div><div class="stat-value">${rows.length}</div><div class="stat-meta">Videos being tracked</div></div><div class="stat-card"><div class="stat-label">TOTAL VIEWS</div><div class="stat-value">${fmt(total("views"))}</div><div class="stat-meta">Across published videos</div></div><div class="stat-card"><div class="stat-label">LIKES</div><div class="stat-value">${fmt(total("likes"))}</div><div class="stat-meta">Total engagement</div></div><div class="stat-card"><div class="stat-label">SAVES</div><div class="stat-value">${fmt(total("saves"))}</div><div class="stat-meta">Content saves</div></div><div class="stat-card"><div class="stat-label">AVG VIEWS</div><div class="stat-value">${fmt(avgViews)}</div><div class="stat-meta">Per published video</div></div></div><div class="card"><div class="library-toolbar"><input id="trackingSearch" type="search" placeholder="Search published videos..." aria-label="Search published videos" value="${esc(search)}"><span class="library-count">${filtered.length} records</span><select class="workspace-select" id="trackingFilter"><option value="all" ${filter === "all" ? "selected" : ""}>All videos</option><option value="low" ${filter === "low" ? "selected" : ""}>Under 1K views</option><option value="high" ${filter === "high" ? "selected" : ""}>1K+ views</option></select><button type="button" class="table-action" data-track-bulk>＋ Bulk Add</button><button type="button" class="capture-button library-add-button" data-track-add>＋ Add Metrics</button></div><div class="table-wrapper"><table class="data-table tracking-table"><thead><tr><th>Video</th><th>Published</th><th>Views</th><th>Likes</th><th>Comments</th><th>Shares</th><th>Saves</th><th>Followers</th><th>Actions</th></tr></thead><tbody>${pageRows.map(trackingRow).join("") || `<tr><td colspan="9"><div class="empty-state compact"><strong>No published videos found</strong><p>Set a video status to Published from Library first.</p></div></td></tr>`}</tbody></table></div></div>`;
        root.querySelector("#trackingFilter").onchange = event => { filter = event.target.value; render(); };
        root.querySelector("#trackingSearch").oninput = event => { search = event.target.value; render(); };
    }
    function trackingRow(row) { return `<tr><td><div class="source-title">${esc(row.video_id || row.title || "Untitled")}</div><div class="source-subtitle">${esc(row.creator?.creator_name || row.creator?.handle || "—")} · ${esc(row.pillar?.name || "—")} / ${esc(row.topic?.name || "—")}</div></td><td>${date(row.published_at)}</td>${METRICS.map(metric => `<td>${editableMetric(row, metric)}</td>`).join("")}<td class="row-actions"><button type="button" class="table-action" data-track-edit="${esc(row.id)}">Edit</button></td></tr>`; }
    function editableMetric(row, field) { return `<span class="tracking-editable" data-track-field="${field}" data-track-id="${esc(row.id)}">${fmt(row[field])}</span>`; }
    async function inlineMetric(element) { const row = rows.find(item => item.id === element.dataset.trackId), field = element.dataset.trackField; if (!row || !METRICS.includes(field)) return; const input = document.createElement("input"); input.type = "number"; input.min = "0"; input.value = Number(row[field] || 0); input.className = "inline-edit-input"; element.replaceChildren(input); input.focus(); input.select(); let done = false; const save = async () => { if (done) return; done = true; const value = Number(input.value || 0), { error } = await supabase.from("videos").update({ [field]: value }).eq("id", row.id); if (error) { alert(error.message); render(); return; } row[field] = value; render(); }; input.onblur = save; input.onkeydown = event => { if (event.key === "Enter") save(); if (event.key === "Escape") { done = true; render(); } }; }
    async function openMetricsModal(editId = null) {
        const current = editId ? rows.find(row => row.id === editId) : null;
        const videoOptions = rows.map(row => `<option value="${esc(row.id)}" ${current?.id === row.id ? "selected" : ""}>${esc(row.video_id || row.title || "Untitled")}</option>`).join("");
        const modal = document.createElement("div"); modal.className = "library-edit-overlay";
        modal.innerHTML = `<div class="library-edit-modal"><div class="modal-header"><div><h3>${current ? "Edit Performance" : "Add Performance"}</h3><p>${current ? esc(current.video_id || current.title || "Video") : "Select a published video and enter its metrics."}</p></div><button class="modal-close" data-close>×</button></div><form><div class="edit-grid"><label>Published Video<select name="video_id" ${current ? "disabled" : ""}><option value="">Select video</option>${videoOptions}</select></label>${METRICS.map(metric => `<label>${METRIC_LABELS[metric]}<input name="${metric}" type="number" min="0" value="${Number(current?.[metric] || 0)}"></label>`).join("")}</div><div class="modal-actions"><button type="button" class="button secondary" data-close>Cancel</button><button type="submit" class="button primary">Save</button></div></form></div>`;
        document.body.appendChild(modal); modal.querySelectorAll("[data-close]").forEach(button => button.onclick = () => modal.remove());
        modal.querySelector("form").onsubmit = async event => { event.preventDefault(); const fd = new FormData(event.currentTarget), id = current?.id || fd.get("video_id"); if (!id) return; const payload = {}; METRICS.forEach(metric => payload[metric] = Math.max(0, Number(fd.get(metric) || 0))); const { error } = await supabase.from("videos").update(payload).eq("id", id); if (error) { alert(error.message); return; } modal.remove(); await load(); render(); document.dispatchEvent(new CustomEvent("content-os:data-changed", { detail: { type: "tracking" } })); };
    }
    function renderError(error) { root.innerHTML = `<div class="card"><div class="empty-state"><strong>Tracking could not load</strong><p>${esc(error?.message || "Supabase request failed.")}</p></div></div>`; }
    function fmt(value) { return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0)); }
    function date(value) { if (!value) return "—"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
    function esc(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#039;", '"':"&quot;" }[char])); }
    root.innerHTML = '<div class="card"><div class="empty-state"><strong>Loading tracking...</strong></div></div>';
    try { await load(); render(); } catch (error) { renderError(error); }
}
window.initTrackingWorkspace = initTrackingWorkspace;
