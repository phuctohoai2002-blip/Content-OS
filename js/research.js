import { supabase } from "./supabase.js";

const RESEARCH_TYPES = ["sources", "creators"];
let researchType = "sources";
let researchRows = [];

export async function initResearchWorkspace() {
    const root = document.getElementById("researchWorkspace");
    if (!root) return;

    bindResearchEvents(root);
    await loadResearch();
}

function bindResearchEvents(root) {
    root.querySelectorAll("[data-research-type]").forEach(button => {
        button.addEventListener("click", async () => {
            researchType = button.dataset.researchType;
            root.querySelectorAll("[data-research-type]").forEach(item => item.classList.toggle("active", item === button));
            updateResearchCopy(root);
            await loadResearch();
        });
    });

    const form = root.querySelector("#researchForm");
    if (form) {
        form.addEventListener("submit", handleResearchSubmit);
    }

    const search = root.querySelector("#researchSearch");
    if (search) {
        search.addEventListener("input", () => renderResearchTable(root, search.value));
    }

    root.addEventListener("click", async event => {
        const edit = event.target.closest("[data-edit-id]");
        if (edit) return startEdit(edit.dataset.editId, root);

        const remove = event.target.closest("[data-delete-id]");
        if (remove) return deleteResearch(remove.dataset.deleteId, root);

        const cancel = event.target.closest("#researchCancelEdit");
        if (cancel) resetResearchForm(root);
    });
}

async function loadResearch() {
    const root = document.getElementById("researchWorkspace");
    if (!root) return;

    setResearchLoading(root, true);
    try {
        let query = supabase.from(researchType).select("*").order("created_at", { ascending: false }).limit(100);
        const { nicheId } = getResearchNicheContext();
        if (nicheId) query = query.eq("niche_id", nicheId);

        const { data, error } = await query;
        if (error) throw error;
        researchRows = data || [];
        renderResearchStats(root);
        renderResearchTable(root, root.querySelector("#researchSearch")?.value || "");
    } catch (error) {
        console.error("Failed to load research:", error);
        const body = root.querySelector("#researchTableBody");
        if (body) body.innerHTML = `<tr><td colspan="8"><div class="empty-state compact"><strong>Could not load ${researchType}</strong><p>${escapeHtml(error.message || "Supabase error")}</p></div></td></tr>`;
    } finally {
        setResearchLoading(root, false);
    }
}

function renderResearchStats(root) {
    const count = researchRows.length;
    const stat = root.querySelector("#researchRecordCount");
    if (stat) stat.textContent = new Intl.NumberFormat("en-US").format(count);
}

function renderResearchTable(root, searchTerm = "") {
    const body = root.querySelector("#researchTableBody");
    if (!body) return;

    const needle = searchTerm.trim().toLowerCase();
    const rows = researchRows.filter(row => !needle || Object.values(row).some(value => String(value ?? "").toLowerCase().includes(needle)));

    if (!rows.length) {
        body.innerHTML = `<tr><td colspan="8"><div class="empty-state compact"><strong>No ${researchType} found</strong><p>${needle ? "Try another search." : `Add your first ${researchType.slice(0, -1)} above.`}</p></div></td></tr>`;
        return;
    }

    body.innerHTML = rows.map(row => researchType === "sources" ? renderSourceRow(row) : renderCreatorRow(row)).join("");
}

function renderSourceRow(row) {
    const title = first(row, ["title", "name"]) || "Untitled source";
    const url = first(row, ["url", "source_url", "link"]);
    const platform = first(row, ["platform", "source_platform"]);
    const status = first(row, ["status", "stage"]) || "discovered";
    const score = first(row, ["score", "quality_score"]);
    const date = formatDate(first(row, ["created_at", "date_added"]));
    const creator = first(row, ["creator_name", "creator", "handle"]);
    return `<tr>
        <td><div class="source-title">${escapeHtml(title)}</div>${url ? `<a class="source-subtitle" href="${safeUrl(url)}" target="_blank" rel="noopener">${escapeHtml(trimUrl(url))}</a>` : "<div class="source-subtitle">No URL</div>"}</td>
        <td>${escapeHtml(creator || "—")}</td>
        <td><span class="badge">${escapeHtml(platform || "—")}</span></td>
        <td><span class="badge">${escapeHtml(status)}</span></td>
        <td><strong>${score ?? "—"}</strong></td>
        <td>${escapeHtml(date)}</td>
        <td class="row-actions"><button type="button" data-edit-id="${escapeHtml(row.id)}" class="table-action">Edit</button><button type="button" data-delete-id="${escapeHtml(row.id)}" class="table-action danger">Delete</button></td>
    </tr>`;
}

function renderCreatorRow(row) {
    const name = first(row, ["name", "display_name", "creator_name"]) || "Unnamed creator";
    const handle = first(row, ["handle", "username", "account"]) || "—";
    const platform = first(row, ["platform", "source_platform"]) || "—";
    const status = first(row, ["status"]) || "active";
    const date = formatDate(first(row, ["created_at"]));
    return `<tr>
        <td><div class="source-title">${escapeHtml(name)}</div><div class="source-subtitle">${escapeHtml(handle)}</div></td>
        <td><span class="badge">${escapeHtml(platform)}</span></td>
        <td><span class="badge">${escapeHtml(status)}</span></td>
        <td>${escapeHtml(date)}</td>
        <td colspan="3" class="row-actions"><button type="button" data-edit-id="${escapeHtml(row.id)}" class="table-action">Edit</button><button type="button" data-delete-id="${escapeHtml(row.id)}" class="table-action danger">Delete</button></td>
    </tr>`;
}

async function handleResearchSubmit(event) {
    event.preventDefault();
    const root = document.getElementById("researchWorkspace");
    if (!root) return;

    const form = event.currentTarget;
    const id = form.dataset.editId || null;
    const values = Object.fromEntries(new FormData(form).entries());
    const { nicheId } = getResearchNicheContext();

    try {
        const payload = buildPayload(values, nicheId, id ? researchRows.find(row => String(row.id) === String(id)) : null);
        let result;
        if (id) {
            result = await supabase.from(researchType).update(payload).eq("id", id);
        } else {
            result = await supabase.from(researchType).insert(payload);
        }
        if (result.error) throw result.error;
        resetResearchForm(root);
        await loadResearch();
    } catch (error) {
        showResearchNotice(root, error.message || "Could not save record.", true);
    }
}

function buildPayload(values, nicheId, existing) {
    if (researchType === "sources") {
        const payload = {};
        if (hasColumn(existing, "url") || !existing) payload.url = values.url.trim();
        if (hasColumn(existing, "title")) payload.title = values.title.trim();
        if (hasColumn(existing, "status")) payload.status = values.status;
        if (hasColumn(existing, "score")) payload.score = values.score ? Number(values.score) : null;
        if (hasColumn(existing, "platform")) payload.platform = values.platform.trim() || null;
        if (nicheId && hasColumn(existing, "niche_id")) payload.niche_id = nicheId;
        if (!Object.keys(payload).length) payload.url = values.url.trim();
        return payload;
    }

    const payload = {};
    if (hasColumn(existing, "name") || !existing) payload.name = values.name.trim();
    if (hasColumn(existing, "handle")) payload.handle = values.handle.trim() || null;
    if (hasColumn(existing, "platform")) payload.platform = values.platform.trim() || null;
    if (hasColumn(existing, "status")) payload.status = values.status || "active";
    if (nicheId && hasColumn(existing, "niche_id")) payload.niche_id = nicheId;
    if (!Object.keys(payload).length) payload.name = values.name.trim();
    return payload;
}

function startEdit(id, root) {
    const row = researchRows.find(item => String(item.id) === String(id));
    if (!row) return;
    const form = root.querySelector("#researchForm");
    if (!form) return;

    form.dataset.editId = id;
    form.querySelectorAll("[name]").forEach(input => {
        const value = first(row, [input.name]);
        if (value !== undefined && value !== null) input.value = value;
    });
    const submit = form.querySelector("button[type=submit]");
    if (submit) submit.textContent = researchType === "sources" ? "Update Source" : "Update Creator";
    root.querySelector("#researchCancelEdit")?.classList.remove("hidden");
    form.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function deleteResearch(id, root) {
    if (!window.confirm(`Delete this ${researchType === "sources" ? "source" : "creator"}? This cannot be undone.`)) return;
    try {
        const { error } = await supabase.from(researchType).delete().eq("id", id);
        if (error) throw error;
        await loadResearch();
    } catch (error) {
        showResearchNotice(root, error.message || "Could not delete record.", true);
    }
}

function resetResearchForm(root) {
    const form = root.querySelector("#researchForm");
    if (!form) return;
    form.reset();
    delete form.dataset.editId;
    const submit = form.querySelector("button[type=submit]");
    if (submit) submit.textContent = researchType === "sources" ? "Add Source" : "Add Creator";
    root.querySelector("#researchCancelEdit")?.classList.add("hidden");
}

function updateResearchCopy(root) {
    const source = researchType === "sources";
    root.querySelector("#researchTypeTitle").textContent = source ? "Sources" : "Creators";
    root.querySelector("#researchTypeDescription").textContent = source ? "Capture and manage the research sources feeding your content system." : "Build and maintain your creator bank for content research.";
    root.querySelector("#researchFormTitle").textContent = source ? "Add Source" : "Add Creator";
    root.querySelector("#researchSubmit").textContent = source ? "Add Source" : "Add Creator";
    root.querySelector("#sourceFields")?.classList.toggle("hidden", !source);
    root.querySelector("#creatorFields")?.classList.toggle("hidden", source);
    root.querySelector("#researchTableHead").innerHTML = source
        ? "<tr><th>Source</th><th>Creator</th><th>Platform</th><th>Status</th><th>Score</th><th>Date Added</th><th>Actions</th></tr>"
        : "<tr><th>Creator</th><th>Platform</th><th>Status</th><th>Date Added</th><th colspan=3>Actions</th></tr>";
    resetResearchForm(root);
    renderResearchTable(root, root.querySelector("#researchSearch")?.value || "");
}

function setResearchLoading(root, loading) {
    root.querySelector("#researchLoading")?.classList.toggle("hidden", !loading);
}

function showResearchNotice(root, message, isError = false) {
    const notice = root.querySelector("#researchNotice");
    if (!notice) return;
    notice.textContent = message;
    notice.classList.toggle("error", isError);
    notice.classList.remove("hidden");
    setTimeout(() => notice.classList.add("hidden"), 4000);
}

function getResearchNicheContext() {
    const code = typeof getCurrentNiche === "function" ? getCurrentNiche() : "ALL";
    const option = document.querySelector(`.niche-option[data-niche="${code}"]`);
    return { nicheId: option?.dataset.nicheId || null };
}

function hasColumn(row, key) {
    return Boolean(row && Object.prototype.hasOwnProperty.call(row, key));
}

function first(row, keys) {
    if (!row) return undefined;
    for (const key of keys) if (row[key] !== undefined && row[key] !== null) return row[key];
    return undefined;
}

function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function trimUrl(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function safeUrl(url) {
    try {
        const parsed = new URL(url);
        return ["http:", "https:"].includes(parsed.protocol) ? escapeHtml(parsed.href) : "#";
    } catch { return "#"; }
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#039;", "\"":"&quot;" }[char]));
}
