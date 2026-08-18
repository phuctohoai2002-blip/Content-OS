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

    const button =
        document.getElementById("nicheButton");

    const menu =
        document.getElementById("nicheMenu");


    /*
        Load niches from Supabase
    */

    await loadNiches();


    /*
        Open / close menu
    */

    button.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            menu.classList.toggle("hidden");

        }
    );


    /*
        Event delegation
        for dynamically rendered options
    */

    menu.addEventListener(
        "click",
        event => {

            const option =
                event.target.closest(".niche-option");


            if (!option) {
                return;
            }


            const nicheCode =
                option.dataset.niche;


            selectNiche(nicheCode);


            menu.classList.add("hidden");

        }
    );


    /*
        Close menu when clicking outside
    */

    document.addEventListener(
        "click",
        () => {

            menu.classList.add("hidden");

        }
    );

}


/* =========================
   LOAD NICHES
========================= */

async function loadNiches() {

    try {

        const {
            data,
            error
        } = await supabase

            .from("niches")

            .select(`
                id,
                niche_code,
                name,
                description,
                status,
                sort_order
            `)

            .eq(
                "status",
                "active"
            )

            .order(
                "sort_order",
                {
                    ascending: true
                }
            );


        if (error) {

            console.error(
                "Failed to load niches:",
                error
            );

            return;

        }


        /*
            ALL is a frontend/system option.
            It does not exist in the niches table.
        */

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


        /*
            Restore current niche
        */

        selectNiche(
            getCurrentNiche()
        );

    }

    catch (error) {

        console.error(
            "Unexpected error loading niches:",
            error
        );

    }

}


/* =========================
   RENDER NICHE MENU
========================= */

function renderNicheMenu(niches) {

    const menu =
        document.getElementById("nicheMenu");


    menu.innerHTML = `
        <div class="niche-menu-header">
            <strong>Select Niche</strong>
        </div>
    `;


    niches.forEach(
        niche => {

            const option =
                document.createElement("button");


            option.className =
                "niche-option";


            /*
                IMPORTANT:
                UI/state uses niche_code,
                NOT UUID id.
            */

            option.dataset.niche =
                niche.niche_code;


            /*
                Determine visual dot
            */

            let dotClass =
                "master";


            if (
                niche.niche_code === "FAS"
            ) {

                dotClass =
                    "fashion";

            }

            else if (
                niche.niche_code === "GRM"
            ) {

                dotClass =
                    "grooming";

            }

            else if (
                niche.niche_code === "DIG"
            ) {

                dotClass =
                    "digital";

            }


            /*
                Description
            */

            const description =
                niche.niche_code === "ALL"
                    ? "Master database"
                    : niche.niche_code;


            option.innerHTML = `

                <span class="niche-dot ${dotClass}"></span>

                <div>

                    <strong>
                        ${niche.name}
                    </strong>

                    <small>
                        ${description}
                    </small>

                </div>

            `;


            menu.appendChild(
                option
            );

        }
    );

}


/* =========================
   SELECT NICHE
========================= */

function selectNiche(nicheCode) {

    /*
        Find option by niche_code
    */

    const option =
        document.querySelector(
            `.niche-option[data-niche="${nicheCode}"]`
        );


    if (!option) {

        console.warn(
            "Niche not found:",
            nicheCode
        );

        return;

    }


    const nicheName =
        option.querySelector(
            "strong"
        ).textContent;


    const nicheCodeLabel =
        option.querySelector(
            "small"
        ).textContent;


    /*
        Update global state

        Example:

        ALL
        FAS
        GRM
        DIG
    */

    setCurrentNiche(
        nicheCode
    );


    /*
        Update current niche name
    */

    document.getElementById(
        "currentNicheName"
    ).textContent =
        nicheName;


    /*
        Update current niche code
    */

    document.getElementById(
        "currentNicheCode"
    ).textContent =
        nicheCodeLabel;


    /*
        Update active menu option
    */

    document
        .querySelectorAll(".niche-option")
        .forEach(
            option => {

                option.classList.toggle(
                    "active",
                    option.dataset.niche === nicheCode
                );

            }
        );


    /*
        Update current niche dot
    */

    const currentDot =
        document.getElementById(
            "currentNicheDot"
        );


    currentDot.classList.remove(
        "master",
        "fashion",
        "grooming",
        "digital"
    );


    if (
        nicheCode === "FAS"
    ) {

        currentDot.classList.add(
            "fashion"
        );

    }

    else if (
        nicheCode === "GRM"
    ) {

        currentDot.classList.add(
            "grooming"
        );

    }

    else if (
        nicheCode === "DIG"
    ) {

        currentDot.classList.add(
            "digital"
        );

    }

    else {

        currentDot.classList.add(
            "master"
        );

    }


    /*
        Later:
        refresh current page
        with Supabase filter
    */

    if (
        typeof refreshCurrentPage === "function"
    ) {

        refreshCurrentPage();

    }

}


/* =========================
   MOBILE MENU
========================= */

function initMobileMenu() {

    const button =
        document.getElementById(
            "mobileMenuButton"
        );

    const sidebar =
        document.getElementById(
            "sidebar"
        );


    button.addEventListener(
        "click",
        () => {

            sidebar.classList.toggle(
                "open"
            );

        }
    );

}