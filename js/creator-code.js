import { supabase } from "./supabase.js";

const STYLE_ID = "creatorCodeFormStyle";

function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
        #creatorFields [name="creator_code"],
        .add-modal-form label:has(input[name="creator_code"]) { display: none !important; }
        #creatorFields .creator-code-field,
        .add-modal-form .creator-code-field { display: none !important; }
    `;
    document.head.appendChild(style);
}

async function generateCode(form) {
    const niche = form.querySelector('[name="niche_id"]');
    const code = form.querySelector('[name="creator_code"]');
    if (!niche || !code || !niche.value) throw new Error("Please select a Niche first.");
    const { data, error } = await supabase.rpc("generate_creator_code", { p_niche_id: niche.value });
    if (error) throw error;
    if (!data) throw new Error("Could not generate Creator Code.");
    code.value = data;
}

function bindForm(form) {
    if (!form || form.dataset.creatorCodeBound === "true") return;
    if (!form.querySelector('[name="creator_name"]') || !form.querySelector('[name="niche_id"]')) return;
    form.dataset.creatorCodeBound = "true";

    const niche = form.querySelector('[name="niche_id"]');
    niche.addEventListener("change", () => {
        const code = form.querySelector('[name="creator_code"]');
        if (code) code.value = "";
    });

    form.addEventListener("submit", async event => {
        if (form.dataset.creatorCodeReady === "true") {
            delete form.dataset.creatorCodeReady;
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        try {
            await generateCode(form);
            form.dataset.creatorCodeReady = "true";
            form.requestSubmit(event.submitter || form.querySelector('button[type="submit"]'));
        } catch (error) {
            const message = form.querySelector(".add-form-message") || document.querySelector("#researchNotice");
            if (message) {
                message.textContent = error.message || "Could not generate Creator Code.";
                message.classList.remove("hidden");
                message.classList.add("error");
            } else {
                alert(error.message || "Could not generate Creator Code.");
            }
        }
    }, true);
}

function scan() {
    installStyle();
    document.querySelectorAll("form").forEach(bindForm);
}

document.addEventListener("DOMContentLoaded", scan);
new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
