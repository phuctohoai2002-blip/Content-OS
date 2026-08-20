import { supabase } from "./supabase.js";

let activeType = "sources";
let rows = [];

export async function initResearchCrud() {
    const root = document.getElementById("researchWorkspace");
    if (!root || root.dataset.crudInitialized === "true") return;
    root.dataset.crudInitialized = "true";

    bindTabs(root);
    bindForm(root);
    bindSearch(root);
    bindTableActions(root);
    await loadRows(root);
}

function bindTabs(root) {
    root.querySelectorAll("[data-research-type]").forEach(button => {
        button.addEventListener("click", async () => {
            activeType = button.dataset.researchType;
            root.querySelectorAll("[data-research-type]").forEach(item => item.classList.toggle("active", item === button));
            updateFormMode(root);
            await loadRows(root);
        });
    });
}

function bindForm(root) {
    const form = root.querySelector("#researchForm");
    if (!form) return;
    form.addEventListener("submit", async event => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(form).entries());
        const id = form.dataset.editId;
        const button = root.querySelector("#researchSubmit");
        if (button) button.disabled = true;

        try {
            if (id) await updateRow(id, values);
            else await insertRow(values);
            resetForm(root);
            await loadRows(root);
            showNotice(root, id ? "Saved changes." : `Added ${activeType === "sources" ? "source" : "creator"}.`);
        } catch (error) {
            console.error("Research CRUD error:", error);
            showNotice(root, error.message || "Could not save record.", true);
        } finally {
            if (button) button.disabled = false;
        }
    });
}

function bindSearch(root) {
    root.querySelector("#researchSearch")?.addEventListener("input", event => renderRows(root, event.target.value));
}

function bindTableActions(root) {
    root.addEventListener("click", async event => {
        const edit = event.target.closest("[data-edit-id]");
        if (edit) {
            const row = rows.find(item => String(item.id) === String(edit.dataset.editId));
            if (row) fillForm(root, row);
            return;
        }

        const remove = event.target.closest("[data-delete-id]");
        if (remove) {
            if (!confirm(`Delete this ${activeType === "sources" ? "source" : "creator"}?`)) return;
            try {
                const { error } = await supabase.from(activeType).delete().eq("id", remove.dataset.deleteId);
                if (error) throw error;
                await loadRows(root);
            } catch (error) {
                showNotice(root, error.message || "Could not delete record.", true);
            }
            return;
        }

        if (event.target.closest("#researchCancelEdit")) resetForm(root);
    });
}

async function loadRows(root) {
    const loading = root.querySelector("#researchLoading");
    loading?.classList.remove("hidden");
    try {
        let query = supabase.from(activeType).select("*").order("created_at", { ascending: false }).limit(100);
        const nicheId = getCurrentNicheId();
        if (nicheId) query = query.eq("niche_id", nicheId);
        const { data, error } = await query;
        if (error) throw error;
        rows = data || [];
        const count = root.querySelector("#researchRecordCount");
        if (count) count.textContent = String(rows.length);
        renderRows(root, root.querySelector("#researchSearch")?.value || "");
    } catch (error) {
        rows = [];
        const body = root.querySelector("#researchTableBody");
        if (body) body.innerHTML = `<tr><td colspan="8"><div class="empty-state compact"><strong>Could not load ${activeType}</strong><p>${escapeHtml(error.message || "Supabase error")}</p></div></td></tr>`;
    } finally {
        loading?.classList.add("hidden");
    }
}

async function insertRow(values) {
    const nicheId = getCurrentNicheId();

    const base = activeType === "sources"
        ? { url: values.url?.trim() || "" }
        : { creator_name: values.creator_name?.trim() || "" };

    if (nicheId) base.niche_id = nicheId;

    const optional = activeType === "sources"
        ? {
            title: values.title?.trim() || null,
            platform: values.platform?.trim() || null,
            status: values.status || null,
            score: values.score ? Number(values.score) : null
        }
        : {
            handle: values.handle?.trim() || null,
            chinese_name: values.chinese_name?.trim() || null,
            profile_url: values.profile_url?.trim() || null,
            platform: values.platform?.trim() || null,
            creator_type: values.creator_type?.trim() || null,
            content_style: values.content_style?.trim() || null,
            download_path: values.download_path?.trim() || null,
            status: values.status || "active"
        };

    const fullPayload = { ...base, ...optional };
    const { error } = await supabase.from(activeType).insert(fullPayload);
    if (error) throw error;
}

async function updateRow(id, values) {
    const payload = {};

    const keys = activeType === "sources"
        ? ["url", "title", "platform", "status", "score"]
        : ["creator_name", "handle", "chinese_name", "profile_url", "platform", "creator_type", "content_style", "download_path", "status"];

    for (const key of keys) {
        if (values[key] !== undefined) {
            payload[key] = key === "score"
                ? (values[key] ? Number(values[key]) : null)
                : (values[key]?.trim?.() || null);
        }
    }

    if (!Object.keys(payload).length) throw new Error("No editable fields were found for this record.");

    const { error } = await supabase.from(activeType).update(payload).eq("id", id);
    if (error) throw error;
}

function renderRows(root, search = "") {
    const body = root.querySelector("#researchTableBody");
    if (!body) return;
    const needle = search.trim().toLowerCase();
    const filtered = rows.filter(row => !needle || Object.values(row).some(value => String(value ?? "").toLowerCase().includes(needle)));

    if (!filtered.length) {
        body.innerHTML = `<tr><td colspan="8"><div class="empty-state compact"><strong>No ${activeType} found</strong><p>${needle ? "Try another search." : "Your research database is empty."}</p></div></td></tr>`;
        return;
    }

    body.innerHTML = filtered.map(row => activeType === "sources" ? sourceRow(row) : creatorRow(row)).join("");
}

function sourceRow(row) {
    const title = row.title || row.name || "Untitled source";
    const url = row.url || row.source_url || row.link || "";
    return `<tr><td><div class="source-title">${escapeHtml(title)}</div>${url ? `<a class="source-subtitle" href="${safeUrl(url)}" target="_blank" rel="noopener">${escapeHtml(trimUrl(url))}</a>` : "<div class=\"source-subtitle\">No URL</div>"}</td><td>${escapeHtml(row.creator_name || "—")}</td><td><span class="badge">${escapeHtml(row.platform || "—")}</span></td><td><span class="badge">${escapeHtml(row.status || "—")}</span></td><td>${row.score ?? "—"}</td><td>${escapeHtml(formatDate(row.created_at))}</td><td class="row-actions"><button type="button" class="table-action" data-edit-id="${escapeHtml(row.id)}">Edit</button><button type="button" class="table-action danger" data-delete-id="${escapeHtml(row.id)}">Delete</button></td></tr>`;
}

function creatorRow(row) {
    return `<tr><td><div class="source-title">${escapeHtml(row.creator_name || "Unnamed creator")}</div><div class="source-subtitle">${escapeHtml(row.handle || row.chinese_name || "—")}</div></td><td><span class="badge">${escapeHtml(row.platform || "—")}</span></td><td><span class="badge">${escapeHtml(row.status || "active")}</span></td><td>${escapeHtml(formatDate(row.created_at))}</td><td colspan="3" class="row-actions"><button type="button" class="table-action" data-edit-id="${escapeHtml(row.id)}">Edit</button><button type="button" class="table-action danger" data-delete-id="${escapeHtml(row.id)}">Delete</button></td></tr>`;
}

function fillForm(root, row) {
    const form = root.querySelector("#researchForm");
    if (!form) return;
    form.dataset.editId = row.id;
    form.querySelectorAll("[name]").forEach(input => {
        if (Object.prototype.hasOwnProperty.call(row, input.name)) input.value = row[input.name] ?? "";
    });
    const button = root.querySelector("#researchSubmit");
    if (button) button.textContent = activeType === "sources" ? "Update Source" : "Update Creator";
    root.querySelector("#researchCancelEdit")?.classList.remove("hidden");
    form.scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetForm(root) {
    const form = root.querySelector("#researchForm");
    form?.reset();
    if (form) delete form.dataset.editId;
    const button = root.querySelector("#researchSubmit");
    if (button) button.textContent = activeType === "sources" ? "Add Source" : "Add Creator";
    root.querySelector("#researchCancelEdit")?.classList.add("hidden");
}

function updateFormMode(root) {
    const sources = activeType === "sources";
    root.querySelector("#researchTypeTitle")?.replaceChildren(document.createTextNode(sources ? "Sources" : "Creators"));
    const desc = root.querySelector("#researchTypeDescription");
    if (desc) desc.textContent = sources ? "Capture and manage the research sources feeding your content system." : "Build and maintain your creator bank for content research.";
    root.querySelector("#researchFormTitle")?.replaceChildren(document.createTextNode(sources ? "Add Source" : "Add Creator"));
    root.querySelector("#sourceFields")?.classList.toggle("hidden", !sources);
    root.querySelector("#creatorFields")?.classList.toggle("hidden", sources);
    const head = root.querySelector("#researchTableHead");
    if (head) head.innerHTML = sources ? "<tr><th>Source</th><th>Creator</th><th>Platform</th><th>Status</th><th>Score</th><th>Date Added</th><th>Actions</th></tr>" : "<tr><th>Creator</th><th>Platform</th><th>Status</th><th>Date Added</th><th colspan=\"3\">Actions</th></tr>";
    resetForm(root);
}

function getCurrentNicheId() {
    const code = typeof getCurrentNiche === "function" ? getCurrentNiche() : "ALL";
    if (code === "ALL") return null;
    return document.querySelector(`.niche-option[data-niche="${CSS.escape(code)}"]`)?.dataset.nicheId || null;
}

function showNotice(root, message, error = false) {
    const notice = root.querySelector("#researchNotice");
    if (!notice) return;
    notice.textContent = message;
    notice.classList.toggle("error", error);
    notice.classList.remove("hidden");
    setTimeout(() => notice.classList.add("hidden"), 3500);
}

function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function trimUrl(value) {
    try { return new URL(value).hostname.replace(/^www\./, ""); } catch { return value; }
}

function safeUrl(value) {
    try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? escapeHtml(url.href) : "#"; } catch { return "#"; }
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#039;", '"':"&quot;" }[char]));
}
