import { supabase } from "./supabase.js";

document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("quickAddButton");
    const menu = document.getElementById("quickAddMenu");
    const modal = document.getElementById("addModal");
    if (!button || !menu || !modal) return;

    button.addEventListener("click", event => { event.stopPropagation(); menu.classList.toggle("hidden"); });
    menu.addEventListener("click", event => {
        const option = event.target.closest("[data-add-type]");
        if (!option) return;
        menu.classList.add("hidden");
        openModal(option.dataset.addType);
    });
    modal.addEventListener("click", event => { if (event.target === modal || event.target.closest("[data-close-add-modal]")) closeModal(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !modal.classList.contains("hidden")) closeModal(); });

    function openModal(type) {
        modal.innerHTML = type === "video" ? videoTemplate() : type === "creator" ? creatorTemplate() : productTemplate();
        modal.classList.remove("hidden");
        modal.setAttribute("aria-hidden", "false");
        bindModal(type);
    }
    function closeModal() { modal.classList.add("hidden"); modal.setAttribute("aria-hidden", "true"); modal.innerHTML = ""; }

    function bindModal(type) {
        const form = modal.querySelector("form");
        if (!form) return;
        if (type === "video") {
            const url = form.elements.url;
            const creatorCode = form.elements.creator_code;
            url.addEventListener("input", () => { form.elements.video_id.value = extractVideoId(url.value); });
            creatorCode.addEventListener("blur", () => resolveCreatorPath(form));
            creatorCode.addEventListener("input", () => { form.elements.download_path.value = ""; modal.querySelector("[data-creator-status]").textContent = ""; });
        }
        if (type === "creator" || type === "product") loadNiches(form);
        form.addEventListener("submit", async event => {
            event.preventDefault();
            const submit = form.querySelector("button[type=submit]");
            submit.disabled = true;
            try {
                if (type === "video") await saveVideo(form);
                else if (type === "creator") await saveCreator(form);
                else await saveProduct(form);
                showFormMessage(form, "Saved successfully.", false);
                setTimeout(closeModal, 650);
            } catch (error) {
                console.error("Add modal error:", error);
                showFormMessage(form, error.message || "Could not save record.", true);
            } finally { submit.disabled = false; }
        });
    }

    async function resolveCreatorPath(form) {
        const code = form.elements.creator_code.value.trim();
        const status = form.querySelector("[data-creator-status]");
        if (!code) return;
        status.textContent = "Looking up creator…";
        try {
            const { data, error } = await supabase.from("creators").select("*").limit(200);
            if (error) throw error;
            const creator = (data || []).find(row => creatorMatches(row, code));
            if (!creator) throw new Error(`Creator ID “${code}” was not found in the creator database.`);
            const path = getDownloadPath(creator);
            form.elements.download_path.value = path;
            status.textContent = path ? `✓ ${creator.name || "Creator"} found` : `✓ ${creator.name || "Creator"} found — no download path saved`;
        } catch (error) {
            form.elements.download_path.value = "";
            status.textContent = error.message || "Creator lookup failed.";
        }
    }

    async function saveVideo(form) {
        const payload = { video_id: form.elements.video_id.value.trim(), url: form.elements.url.value.trim(), creator_code: form.elements.creator_code.value.trim(), download_path: form.elements.download_path.value.trim() || null, status: form.elements.status.value };
        if (!payload.video_id || !payload.url || !payload.creator_code) throw new Error("URL, Creator ID and Video ID are required.");
        await insertWithSchemaFallback("videos", payload, [["video_id","url","creator_code","download_path","status"],["video_id","url","creator_id","download_path","status"]]);
    }
    async function saveCreator(form) {
        const payload = { creator_id: form.elements.creator_id.value.trim(), name: form.elements.name.value.trim(), platform: form.elements.platform.value.trim(), niche_id: form.elements.niche_id.value || null, sub_niche: form.elements.sub_niche.value.trim() || null, profile_link: form.elements.profile_link.value.trim() || null, total_videos: Number(form.elements.total_videos.value || 0), download_path: form.elements.download_path.value.trim() || null };
        if (!payload.creator_id || !payload.name || !payload.platform) throw new Error("Creator ID, Creator Name and Platform are required.");
        await insertWithSchemaFallback("creators", payload, [["creator_id","name","platform","niche_id","sub_niche","profile_link","total_videos","download_path"],["creator_code","name","platform","niche_id","sub_niche","profile_link","total_videos","download_path"]]);
    }
    async function saveProduct(form) {
        const payload = { name: form.elements.name.value.trim(), url: form.elements.url.value.trim() || null, platform: form.elements.platform.value.trim() || null, price: form.elements.price.value ? Number(form.elements.price.value) : null, status: form.elements.status.value, niche_id: form.elements.niche_id.value || null, notes: form.elements.notes.value.trim() || null };
        if (!payload.name) throw new Error("Product name is required.");
        await insertWithSchemaFallback("products", payload, [["name","url","platform","price","status","niche_id","notes"],["name","url","platform","status","niche_id"]]);
    }

    async function insertWithSchemaFallback(table, payload, keySets) {
        let lastError = null;
        for (const keys of keySets) {
            const candidate = {};
            keys.forEach(key => { if (Object.prototype.hasOwnProperty.call(payload, key)) candidate[key] = payload[key]; });
            const { error } = await supabase.from(table).insert(candidate);
            if (!error) return;
            lastError = error;
            if (!looksLikeSchemaError(error)) break;
        }
        throw lastError || new Error(`Could not save to ${table}.`);
    }

    async function loadNiches(form) {
        const select = form.elements.niche_id;
        if (!select) return;
        try {
            const { data, error } = await supabase.from("niches").select("id,name,niche_code").eq("status", "active").order("sort_order");
            if (error) throw error;
            (data || []).forEach(niche => select.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(niche.id)}">${escapeHtml(niche.name)} (${escapeHtml(niche.niche_code)})</option>`));
        } catch (error) { console.error("Could not load niches:", error); }
    }

    function creatorMatches(row, code) { const normalized = code.toLowerCase(); return [row.creator_id,row.creator_code,row.channel_id,row.channel_code,row.code].some(value => String(value ?? "").toLowerCase() === normalized); }
    function getDownloadPath(row) { return row.download_path || row.download_folder || row.download_dir || row.save_path || row.storage_path || ""; }
    function extractVideoId(url) {
        try {
            const parsed = new URL(url);
            const queryId = parsed.searchParams.get("vid") || parsed.searchParams.get("video_id") || parsed.searchParams.get("item_id");
            if (queryId) return queryId;
            const pathParts = parsed.pathname.split("/").filter(Boolean);
            const last = pathParts.at(-1) || "";
            return last.replace(/[^A-Za-z0-9_-]/g, "") || "";
        } catch { return ""; }
    }
    function looksLikeSchemaError(error) { const message = String(error?.message || "").toLowerCase(); return message.includes("column") || message.includes("schema cache") || message.includes("could not find the table"); }
    function showFormMessage(form, message, error) { const box = form.querySelector(".add-form-message"); if (!box) return; box.textContent = message; box.classList.toggle("error", error); box.classList.remove("hidden"); }
    function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#039;", '"':"&quot;" }[char])); }

    const field = (label, name, type = "text", attrs = "") => `<label class="add-field"><span>${label}</span><input name="${name}" type="${type}" ${attrs}></label>`;
    const select = (label, name, options, attrs = "") => `<label class="add-field"><span>${label}</span><select name="${name}" ${attrs}>${options.map(([value,text]) => `<option value="${value}">${text}</option>`).join("")}</select></label>`;
    const footer = () => `<div class="add-form-message hidden"></div><div class="add-modal-actions"><button type="button" class="table-action" data-close-add-modal>Cancel</button><button type="submit" class="capture-button">Save</button></div>`;
    const shell = (title, description, body) => `<div class="add-modal-backdrop"><div class="add-modal-card" role="dialog" aria-modal="true"><div class="add-modal-header"><div><h2>${title}</h2><p>${description}</p></div><button type="button" class="add-modal-close" data-close-add-modal>×</button></div><form class="add-modal-form">${body}${footer()}</form></div></div>`;
    function videoTemplate() { return shell("Add Video", "Add a source video and link it to an existing creator.", `<div class="add-form-grid">${field("URL","url","url","required placeholder=\"https://...\"")}${field("Creator ID","creator_code","text","required placeholder=\"Creator channel ID\"")}${field("Video ID","video_id","text","readonly placeholder=\"Auto extracted from URL\"")}${field("Download Path","download_path","text","readonly placeholder=\"Auto from creator database\"")}${select("Status","status",[["discovered","Discovered"],["downloaded","Downloaded"],["editing","Editing"],["ready","Ready"],["published","Published"]])}</div><div class="creator-lookup-status" data-creator-status></div>`); }
    function creatorTemplate() { return shell("Add Creator", "Create a creator record for your research and download workflow.", `<div class="add-form-grid">${field("Creator ID","creator_id","text","required placeholder=\"Channel ID / creator code\"")}${field("Creator Name","name","text","required placeholder=\"Creator name\"")}${field("Platform","platform","text","required placeholder=\"Douyin / XHS / TikTok\"")}${select("Niche","niche_id",[["","Select niche"]])}${field("Sub Niche","sub_niche","text","placeholder=\"Sub niche\"")}${field("Profile Link","profile_link","url","placeholder=\"https://...\"")}${field("Total Videos","total_videos","number","min=\"0\" value=\"0\"")}${field("Download Path","download_path","text","placeholder=\"Local download folder\"")}</div>`); }
    function productTemplate() { return shell("Add Product", "Save a product for your affiliate/product research database.", `<div class="add-form-grid">${field("Product Name","name","text","required placeholder=\"Product name\"")}${field("Product URL","url","url","placeholder=\"https://...\"")}${field("Platform","platform","text","placeholder=\"Shopee / TikTok Shop / ...\"")}${field("Price","price","number","min=\"0\" step=\"0.01\" placeholder=\"0\"")}${select("Status","status",[["researching","Researching"],["selected","Selected"],["archived","Archived"]])}${select("Niche","niche_id",[["","Select niche"]])}<label class="add-field add-field-full"><span>Notes</span><textarea name="notes" rows="3" placeholder="Optional notes"></textarea></label></div>`); }
});
