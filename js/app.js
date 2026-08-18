import { supabase } from "./supabase.js";


/* =========================
   APP INIT
========================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        initRouter();

        await initNicheSelector();

        initMobileMenu();

    }
);


/* =========================
   NICHE SELECTOR
========================= */

async function initNicheSelector() {

    const button = document.getElementById("nicheButton");
    const menu = document.getElementById("nicheMenu");

    if (!button || !menu) {
        console.warn("Niche selector elements not found.");
        return;
    }

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

    document.addEventListener("click", () => {
        menu.classList.add("hidden");
    });
}


/* =========================
   LOAD NICHES
========================= */

async function loadNiches() {

    try {

        const { data, error } = await supabase
            .from("niches")
            .select(`
                id,
                niche_code,
                name,
                description,
                status,
                sort_order
            `)
            .eq("status", "active")
            .order("sort_order", { ascending: true });

        if (error) throw error;

        const niches = [
            {
                id: null,
                niche_code: "ALL",
                name: "All Niches",
                description: "Master database"
            },
            ...(data || [])
        ];

        renderNicheMenu(niches);

        selectNiche(getCurrentNiche());

    } catch (error) {

        console.error("Failed to load niches:", error);

    }
}


/* =========================
   RENDER NICHE MENU
========================= */

function renderNicheMenu(niches) {

    const menu = document.getElementById("nicheMenu");

    menu.innerHTML = `
        <div class="niche-menu-header">
            <strong>Select Niche</strong>
        </div>
    `;

    niches.forEach(niche => {

        const option = document.createElement("button");

        option.className = "niche-option";
        option.dataset.niche = niche.niche_code;
        option.dataset.nicheId = niche.id || "";

        let dotClass = "master";

        if (niche.niche_code === "FAS") dotClass = "fashion";
        else if (niche.niche_code === "GRM") dotClass = "grooming";
        else if (niche.niche_code === "DIG") dotClass = "digital";

        const description =
            niche.niche_code === "ALL"
                ? "Master database"
                : niche.niche_code;

        option.innerHTML = `
            <span class="niche-dot ${dotClass}"></span>
            <div>
                <strong>${niche.name}</strong>
                <small>${description}</small>
            </div>
        `;

        menu.appendChild(option);
    });
}


/* =========================
   SELECT NICHE
========================= */

function selectNiche(nicheCode) {

    const option = document.querySelector(
        `.niche-option[data-niche="${nicheCode}"]`
    );

    if (!option) {
        console.warn("Niche not found:", nicheCode);
        return;
    }

    const nicheId = option.dataset.nicheId || null;
    const nicheName = option.querySelector("strong").textContent;
    const nicheCodeLabel = option.querySelector("small").textContent;

    /*
       UI state = niche_code
       Database filter = niche UUID
    */
    setCurrentNiche(nicheCode, nicheId);

    const nameElement = document.getElementById("currentNicheName");
    const codeElement = document.getElementById("currentNicheCode");

    if (nameElement) nameElement.textContent = nicheName;
    if (codeElement) codeElement.textContent = nicheCodeLabel;

    document.querySelectorAll(".niche-option").forEach(item => {
        item.classList.toggle(
            "active",
            item.dataset.niche === nicheCode
        );
    });

    const currentDot = document.getElementById("currentNicheDot");

    if (currentDot) {
        currentDot.classList.remove(
            "master",
            "fashion",
            "grooming",
            "digital"
        );

        if (nicheCode === "FAS") currentDot.classList.add("fashion");
        else if (nicheCode === "GRM") currentDot.classList.add("grooming");
        else if (nicheCode === "DIG") currentDot.classList.add("digital");
        else currentDot.classList.add("master");
    }

    /*
       Notify the active page that the global niche changed.
       Pages can listen for this event and reload their Supabase data.
    */
    window.dispatchEvent(
        new CustomEvent("nicheChanged", {
            detail: {
                nicheCode,
                nicheId
            }
        })
    );

}


/* =========================
   MOBILE MENU
========================= */

function initMobileMenu() {

    const button = document.getElementById("mobileMenuButton");
    const sidebar = document.getElementById("sidebar");

    if (!button || !sidebar) return;

    button.addEventListener("click", () => {
        sidebar.classList.toggle("open");
    });
}
