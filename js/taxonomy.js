import { supabase } from "./supabase.js";

const TYPES = [
    { key: "niches", label: "Niches", singular: "Niche", table: "niches" },
    { key: "pillars", label: "Pillars", singular: "Pillar", table: "pillars" },
    { key: "topics", label: "Topics", singular: "Topic", table: "topics" },
    { key: "tags", label: "Tags", singular: "Tag", table: "tags" }
];

let active = "niches";
let cache = [];

export async function initTaxonomy() {
    const root = document.getElementById("taxonomyWorkspace");
    if (!root || root.dataset.initialized === "true") return;
    root.dataset.initialized = "true";
    bindTabs(root);
    bindForm(root);
    bindSearch(root);
    bindActions(root);
    await load(root);
}

function config() { return TYPES.find(item => item.key === active) || TYPES[0]; }

function bindTabs(root) {
    root.querySelectorAll("[data-taxonomy-type]").forEach(button => button.addEventListener("click", async () => {
        active = button.dataset.taxonomyType;
        root.querySelectorAll("[data-taxonomy-type]").forEach(item => item.classList.toggle("active", item === button));
        resetForm(root);
        await load(root);
    }));
}

function bindForm(root) {
    root.querySelector("#taxonomyForm")?.addEventListener("submit", async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const values = Object.fromEntries(new FormData(form).entries());
        const button = form.querySelector("button[type=submit]");
        button.disabled = true;
        try {
            await save(root, values, form.dataset.editId || null);
            resetForm(root);
            await load(root);
            showMessage(root, `${config().singular} saved.`);
        } catch (error) { showMessage(root, error.message || "Could not save taxonomy item.", true); }
        finally { button.disabled = false; }
    });
}

function bindSearch(root) { root.querySelector("#taxonomySearch")?.addEventListener("input", event => render(root, event.target.value)); }

function bindActions(root) {
    root.addEventListener("click", async event => {
        const edit = event.target.closest("[data-tax-edit]");
        if (edit) { const row = cache.find(item => String(item.id) === String(edit.dataset.taxEdit)); if (row) fillForm(root, row); return; }
        const remove = event.target.closest("[data-tax-delete]");
        if (remove) {
            if (!confirm(`Delete this ${config().singular.toLowerCase()}?`)) return;
            const { error } = await supabase.from(config().table).delete().eq("id", remove.dataset.taxDelete);
            if (error) showMessage(root, error.message, true); else await load(root);
            return;
        }
        if (event.target.closest("#taxonomyCancel")) resetForm(root);
    });
}

async function load(root) {
    const cfg = config();
    root.querySelector("#taxonomyLoading")?.classList.remove("hidden");
    try {
        let query = supabase.from(cfg.table).select("*").limit(200);
        if (cfg.table === "niches") query = query.order("sort_order", { ascending: true });
        else query = query.order("created_at", { ascending: false });
        const { data, error } = await query;
        if (error) throw error;
        cache = data || [];
        root.querySelector("#taxonomyCount").textContent = String(cache.length);
        updateForm(root);
        render(root, root.querySelector("#taxonomySearch")?.value || "");
    } catch (error) {
        cache = [];
        root.querySelector("#taxonomyCount").textContent = "0";
        root.querySelector("#taxonomyTableBody").innerHTML = `<tr><td colspan="6"><div class="empty-state compact"><strong>Could not load ${cfg.label}</strong><p>${escapeHtml(error.message || "Supabase error")}</p>${cfg.table === "tags" ? "<small>Run the taxonomy SQL migration once to create the tags table.</small>" : ""}</div></td></tr>`;
    } finally { root.querySelector("#taxonomyLoading")?.classList.add("hidden"); }
}

async function save(root, values, id) {
    const cfg = config();
    const payload = { name: values.name?.trim() || "" };
    if (!payload.name) throw new Error(`${cfg.singular} name is required.`);
    if (cfg.table === "niches") {
        payload.niche_code = values.code?.trim() || null;
        payload.description = values.description?.trim() || null;
        payload.status = values.status || "active";
    } else {
        payload.description = values.description?.trim() || null;
        if (cfg.table === "pillars" || cfg.table === "topics") payload.niche_id = values.niche_id || getCurrentNicheId() || null;
        if (cfg.table === "topics") payload.pillar_id = values.pillar_id || null;
        if (cfg.table === "tags") payload.slug = slugify(payload.name);
    }
    if (id) {
        const { error } = await supabase.from(cfg.table).update(payload).eq("id", id);
        if (error) throw error;
    } else {
        const { error } = await supabase.from(cfg.table).insert(payload);
        if (error) throw error;
    }
}

function updateForm(root) {
    const cfg = config();
    root.querySelector("#taxonomyFormTitle").textContent = `Add ${cfg.singular}`;
    root.querySelector("#taxonomySubmit").textContent = `Add ${cfg.singular}`;
    root.querySelector("#taxonomyDescription").textContent = `Manage ${cfg.label.toLowerCase()} used across your content system.`;
    root.querySelector("#nicheCodeField")?.classList.toggle("hidden", cfg.table !== "niches");
    root.querySelector("#nicheParentField")?.classList.toggle("hidden", !["pillars", "topics"].includes(cfg.table));
    root.querySelector("#pillarParentField")?.classList.toggle("hidden", cfg.table !== "topics");
    loadParentOptions(root);
}

async function loadParentOptions(root) {
    if (!["pillars", "topics"].includes(config().table)) return;
    const nicheSelect = root.querySelector("#taxonomyNiche");
    const pillarSelect = root.querySelector("#taxonomyPillar");
    if (nicheSelect) {
        const { data } = await supabase.from("niches").select("id,name,niche_code").eq("status", "active").order("sort_order");
        nicheSelect.innerHTML = '<option value="">Select niche</option>' + (data || []).map(row => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.name)}</option>`).join("");
    }
    if (pillarSelect) {
        const { data } = await supabase.from("pillars").select("id,name").order("name");
        pillarSelect.innerHTML = '<option value="">Select pillar</option>' + (data || []).map(row => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.name)}</option>`).join("");
    }
}

function render(root, search = "") {
    const needle = search.trim().toLowerCase();
    const filtered = cache.filter(row => !needle || Object.values(row).some(value => String(value ?? "").toLowerCase().includes(needle)));
    const body = root.querySelector("#taxonomyTableBody");
    if (!filtered.length) { body.innerHTML = `<tr><td colspan="6"><div class="empty-state compact"><strong>No ${config().label.toLowerCase()} found</strong><p>${needle ? "Try another search." : "Add your first item above."}</p></div></td></tr>`; return; }
    body.innerHTML = filtered.map(row => `<tr><td><strong>${escapeHtml(row.name || row.title || "Untitled")}</strong></td><td>${escapeHtml(row.niche_code || row.slug || row.code || "—")}</td><td>${escapeHtml(row.description || "—")}</td><td><span class="badge">${escapeHtml(row.status || "active")}</span></td><td>${escapeHtml(formatDate(row.created_at))}</td><td class="row-actions"><button class="table-action" data-tax-edit="${escapeHtml(row.id)}">Edit</button><button class="table-action danger" data-tax-delete="${escapeHtml(row.id)}">Delete</button></td></tr>`).join("");
}

function fillForm(root, row) {
    const form = root.querySelector("#taxonomyForm");
    form.dataset.editId = row.id;
    form.querySelectorAll("[name]").forEach(field => { if (Object.prototype.hasOwnProperty.call(row, field.name)) field.value = row[field.name] ?? ""; });
    root.querySelector("#taxonomyFormTitle").textContent = `Edit ${config().singular}`;
    root.querySelector("#taxonomySubmit").textContent = `Save ${config().singular}`;
    root.querySelector("#taxonomyCancel").classList.remove("hidden");
    form.scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetForm(root) {
    const form = root.querySelector("#taxonomyForm");
    form?.reset(); if (form) delete form.dataset.editId;
    root.querySelector("#taxonomyCancel")?.classList.add("hidden");
    updateForm(root);
}

function getCurrentNicheId() {
    const code = typeof getCurrentNiche === "function" ? getCurrentNiche() : "ALL";
    return code === "ALL" ? null : document.querySelector(`.niche-option[data-niche="${CSS.escape(code)}"]`)?.dataset.nicheId || null;
}
function slugify(value) { return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function formatDate(value) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
function showMessage(root, message, error = false) { const box = root.querySelector("#taxonomyNotice"); box.textContent = message; box.classList.toggle("error", error); box.classList.remove("hidden"); setTimeout(() => box.classList.add("hidden"), 3500); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#039;", '"':"&quot;" }[char])); }
