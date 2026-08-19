import { supabase } from "./supabase.js";
import { initResearchWorkspace } from "./research.js";

document.addEventListener("DOMContentLoaded", async () => {
    initRouter();
    await initNicheSelector();
    initMobileMenu();
    initQuickAdd();
    window.addEventListener("nicheChanged", () => {
        if (window.location.hash.replace("#", "") === "dashboard" || !window.location.hash) {
            initDashboardWorkspace();
        }
        if (window.location.hash.replace("#", "") === "research") {
            window.initResearchWorkspace?.();
        }
    });
});

async function initNicheSelector() {
    const button = document.getElementById("nicheButton");
    const menu = document.getElementById("nicheMenu");
    if (!button || !menu) return;

    await loadNiches();

    button.addEventListener("click", event => {
        event.stopPropagation();
        menu.classList.toggle("hidden");
    });

    menu.addEventListener("click", event => {
        const option = event.target.closest(".niche-option");
        if (!option) return;
        selectNiche(option.dataset.niche);
        menu.classList.add("hidden");
    });

    document.addEventListener("click", () => menu.classList.add("hidden"));
}

async function loadNiches() {
    try {
        const { data, error } = await supabase
            .from("niches")
            .select("id,niche_code,name,description,status,sort_order")
            .eq("status", "active")
            .order("sort_order", { ascending: true });

        if (error) throw error;

        renderNicheMenu([
            { id: null, niche_code: "ALL", name: "All Niches", description: "Master database" },
            ...(data || [])
        ]);
        selectNiche(getCurrentNiche());
    } catch (error) {
        console.error("Failed to load niches:", error);
    }
}

function renderNicheMenu(niches) {
    const menu = document.getElementById("nicheMenu");
    if (!menu) return;

    menu.innerHTML = '<div class="niche-menu-header"><strong>Select Niche</strong></div>';

    niches.forEach(niche => {
        const option = document.createElement("button");
        option.className = "niche-option";
        option.dataset.niche = niche.niche_code;
        option.dataset.nicheId = niche.id || "";

        let dotClass = "master";
        if (niche.niche_code === "FAS") dotClass = "fashion";
        else if (niche.niche_code === "GRM") dotClass = "grooming";
        else if (niche.niche_code === "DIG") dotClass = "digital";

        option.innerHTML = `<span class="niche-dot ${dotClass}"></span><div><strong>${niche.name}</strong><small>${niche.niche_code === "ALL" ? "Master database" : niche.niche_code}</small></div>`;
        menu.appendChild(option);
    });
}

function selectNiche(nicheCode) {
    const option = document.querySelector(`.niche-option[data-niche="${nicheCode}"]`);
    if (!option) return;

    const previousNiche = typeof getCurrentNiche === "function" ? getCurrentNiche() : "ALL";
    const nicheId = option.dataset.nicheId || null;
    const changed = previousNiche !== nicheCode;

    setCurrentNiche(nicheCode, nicheId);

    const name = document.getElementById("currentNicheName");
    const code = document.getElementById("currentNicheCode");
    if (name) name.textContent = option.querySelector("strong").textContent;
    if (code) code.textContent = option.querySelector("small").textContent;

    document.querySelectorAll(".niche-option").forEach(item => {
        item.classList.toggle("active", item.dataset.niche === nicheCode);
    });

    const dot = document.getElementById("currentNicheDot");
    if (dot) {
        dot.classList.remove("master", "fashion", "grooming", "digital");
        dot.classList.add(
            nicheCode === "FAS" ? "fashion" :
            nicheCode === "GRM" ? "grooming" :
            nicheCode === "DIG" ? "digital" : "master"
        );
    }

    if (changed) {
        window.dispatchEvent(new CustomEvent("nicheChanged", { detail: { nicheCode, nicheId } }));
    }
}

async function initDashboardWorkspace() {
    const loading = document.getElementById("dashboardLoading");
    const content = document.getElementById("dashboardContent");
    const errorBox = document.getElementById("dashboardError");
    if (!loading || !content) return;

    loading.classList.remove("hidden");
    content.classList.add("hidden");
    if (errorBox) errorBox.classList.add("hidden");

    try {
        const { nicheId } = getCurrentNicheContext();
        const scope = query => nicheId ? query.eq("niche_id", nicheId) : query;

        const [nichesResult, creatorsResult, sourcesResult, readyResult, pillarsResult, recentResult] = await Promise.all([
            nicheId
                ? Promise.resolve({ count: 1, error: null })
                : supabase.from("niches").select("id", { count: "exact", head: true }).eq("status", "active"),
            scope(supabase.from("creators").select("id", { count: "exact", head: true })),
            scope(supabase.from("sources").select("id", { count: "exact", head: true })),
            scope(supabase.from("content_items").select("id", { count: "exact", head: true }).eq("stage", "ready")),
            scope(supabase.from("pillar_performance").select("pillar_id,pillar_name,niche_id,video_count,total_views,total_followers").order("total_views", { ascending: false }).limit(5)),
            scope(supabase.from("content_items").select("id,title,stage,created_at,niche_id,pillars(name),niches(name)").order("created_at", { ascending: false }).limit(5))
        ]);

        const firstError = [nichesResult, creatorsResult, sourcesResult, readyResult, pillarsResult, recentResult].find(result => result?.error)?.error;
        if (firstError) throw firstError;

        renderDashboardStats({ niches: nichesResult.count || 0, creators: creatorsResult.count || 0, sources: sourcesResult.count || 0, ready: readyResult.count || 0, scoped: Boolean(nicheId) });
        const nicheMap = await loadNicheNames();
        renderDashboardPillars(pillarsResult.data || [], nicheMap);
        renderRecentContent(recentResult.data || [], nicheMap);

        loading.classList.add("hidden");
        content.classList.remove("hidden");
    } catch (error) {
        console.error("Failed to load dashboard:", error);
        loading.classList.add("hidden");
        if (errorBox) {
            errorBox.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠</div><strong>Dashboard could not load</strong><p>${escapeHtml(error.message || "Unknown Supabase error")}</p><small>Check your Supabase connection and table/view permissions.</small></div>`;
            errorBox.classList.remove("hidden");
        }
    }
}

window.initDashboardWorkspace = initDashboardWorkspace;
window.initResearchWorkspace = initResearchWorkspace;

async function loadNicheNames() {
    const { data, error } = await supabase.from("niches").select("id,name,niche_code");
    if (error) throw error;
    return new Map((data || []).map(niche => [niche.id, niche]));
}

function renderDashboardStats({ niches, creators, sources, ready, scoped }) {
    setText("dashboardNiches", formatNumber(niches));
    setText("dashboardCreators", formatNumber(creators));
    setText("dashboardSources", formatNumber(sources));
    setText("dashboardReady", formatNumber(ready));
    setText("dashboardNichesMeta", scoped ? "Current niche" : "Active workspaces");
}

function renderDashboardPillars(rows, nicheMap) {
    const body = document.getElementById("dashboardPillarsBody");
    if (!body) return;
    if (!rows.length) {
        body.innerHTML = '<tr><td colspan="5"><div class="empty-state compact"><strong>No published performance yet</strong><p>Publish some videos to see pillar performance here.</p></div></td></tr>';
        return;
    }
    body.innerHTML = rows.map(row => {
        const niche = nicheMap.get(row.niche_id);
        return `<tr><td>${escapeHtml(row.pillar_name || "—")}</td><td>${escapeHtml(niche?.name || "—")}</td><td>${formatNumber(row.video_count)}</td><td>${formatNumber(row.total_views)}</td><td>${formatNumber(row.total_followers)}</td></tr>`;
    }).join("");
}

function renderRecentContent(rows, nicheMap) {
    const body = document.getElementById("dashboardRecentBody");
    if (!body) return;
    if (!rows.length) {
        body.innerHTML = '<tr><td colspan="4"><div class="empty-state compact"><strong>No content yet</strong><p>Create your first content item from the Content module.</p></div></td></tr>';
        return;
    }
    body.innerHTML = rows.map(row => {
        const niche = nicheMap.get(row.niche_id);
        const pillarName = row.pillars?.name || "—";
        return `<tr><td>${escapeHtml(row.title || "Untitled content")}</td><td>${escapeHtml(niche?.name || "—")}</td><td>${escapeHtml(pillarName)}</td><td><span class="badge">${escapeHtml(formatStage(row.stage))}</span></td></tr>`;
    }).join("");
}

function formatStage(stage) { return !stage ? "Unknown" : stage.replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase()); }
function formatNumber(value) { return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0)); }
function setText(id, value) { const element = document.getElementById(id); if (element) element.textContent = value; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#039;", "\"":"&quot;" }[char])); }
function getCurrentNicheContext() { const nicheCode = typeof getCurrentNiche === "function" ? getCurrentNiche() : "ALL"; const option = document.querySelector(`.niche-option[data-niche="${nicheCode}"]`); return { nicheCode, nicheId: option?.dataset.nicheId || null }; }

function initQuickAdd() {
    const button = document.getElementById("quickAddButton");
    const menu = document.getElementById("quickAddMenu");
    if (!button || !menu) return;
    button.addEventListener("click", event => { event.stopPropagation(); menu.classList.toggle("hidden"); });
    menu.addEventListener("click", event => {
        const item = event.target.closest("button[data-add-type]");
        if (!item) return;
        menu.classList.add("hidden");
        if (item.dataset.addType === "source") { window.location.hash = "#research"; setTimeout(() => document.getElementById("sourceUrlInput")?.focus(), 250); }
    });
    document.addEventListener("click", () => menu.classList.add("hidden"));
}

function initMobileMenu() {
    const button = document.getElementById("mobileMenuButton");
    const sidebar = document.getElementById("sidebar");
    if (!button || !sidebar) return;
    button.addEventListener("click", () => sidebar.classList.toggle("open"));
}
