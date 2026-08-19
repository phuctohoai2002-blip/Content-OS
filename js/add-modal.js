import { supabase } from "./supabase.js";

document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("quickAddButton");
    const menu = document.getElementById("quickAddMenu");
    const modal = document.getElementById("addModal");
    if (!button || !menu || !modal) return;

    button.addEventListener("click", event => { event.stopPropagation(); menu.classList.toggle("hidden"); });
    menu.addEventListener("click", event => { const option = event.target.closest("[data-add-type]"); if (!option) return; menu.classList.add("hidden"); openModal(option.dataset.addType); });
    modal.addEventListener("click", event => { if (event.target === modal || event.target.closest("[data-close-add-modal]")) closeModal(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !modal.classList.contains("hidden")) closeModal(); });

    function openModal(type) {
        modal.innerHTML = type === "video" ? videoTemplate() : type === "creator" ? creatorTemplate() : productTemplate();
        modal.classList.remove("hidden"); modal.setAttribute("aria-hidden", "false"); bindModal(type);
    }
    function closeModal() { modal.classList.add("hidden"); modal.setAttribute("aria-hidden", "true"); modal.innerHTML = ""; }

    function bindModal(type) {
        const form = modal.querySelector("form"); if (!form) return;
        if (type === "video") bindVideoForm(form);
        if (type === "creator") loadNiches(form);
        if (type === "product") loadNiches(form);
        form.addEventListener("submit", async event => {
            event.preventDefault();
            const submit = form.querySelector("button[type=submit]"); submit.disabled = true;
            try {
                if (type === "video") await saveVideo(form);
                else if (type === "creator") await saveCreator(form);
                else await saveProduct(form);
                showFormMessage(form, "Saved successfully.", false); setTimeout(closeModal, 650);
            } catch (error) { console.error("Add modal error:", error); showFormMessage(form, error.message || "Could not save record.", true); }
            finally { submit.disabled = false; }
        });
    }

    function bindVideoForm(form) {
        const url = form.elements.url;
        const creatorCode = form.elements.creator_code;
        const videoId = form.elements.video_id;
        const duplicateStatus = form.elements.video_duplicate_status;
        url.addEventListener("input", async () => {
            videoId.value = extractVideoId(url.value);
            await validateVideoId(form);
        });
        videoId.addEventListener("input", () => validateVideoId(form));
        creatorCode.addEventListener("blur", () => resolveCreator(form));
        creatorCode.addEventListener("input", () => { form.elements.download_path.value = ""; form.elements.creator_status.textContent = ""; });
        form.elements.pillar_id.addEventListener("change", () => loadTopics(form));
        duplicateStatus.textContent = "";
    }

    async function validateVideoId(form) {
        const id = form.elements.video_id.value.trim();
        const box = form.elements.video_duplicate_status;
        if (!id) { box.textContent = ""; return false; }
        box.textContent = "Checking video ID…";
        try {
            const { data, error } = await supabase.from("videos").select("id,video_id").eq("video_id", id).limit(1);
            if (error) {
                if (looksLikeUnknownColumn(error)) { box.textContent = ""; return false; }
                throw error;
            }
            const duplicate = Boolean(data?.length);
            box.textContent = duplicate ? `⚠ Video ID “${id}” already exists in your library.` : "✓ Video ID is available.";
            box.classList.toggle("error", duplicate); box.classList.toggle("success", !duplicate);
            form.elements.video_id.dataset.duplicate = duplicate ? "true" : "false";
            return duplicate;
        } catch (error) { box.textContent = error.message || "Could not validate video ID."; box.classList.add("error"); return false; }
    }

    async function resolveCreator(form) {
        const code = form.elements.creator_code.value.trim(); if (!code) return;
        const status = form.elements.creator_status; status.textContent = "Looking up creator…";
        try {
            const { data, error } = await supabase.from("creators").select("*").limit(100);
            if (error) throw error;
            const creator = (data || []).find(row => creatorMatches(row, code));
            if (!creator) throw new Error(`Creator ID “${code}” was not found in the creator database.`);
            form.elements.download_path.value = getDownloadPath(creator) || "";
            status.textContent = getDownloadPath(creator) ? `✓ ${creator.name || "Creator"} found` : `✓ ${creator.name || "Creator"} found — no download path saved`;
            const nicheId = creator.niche_id || "";
            form.elements.niche_id.value = nicheId;
            await loadPillars(form, nicheId);
            await loadTopics(form);
        } catch (error) { status.textContent = error.message || "Creator lookup failed."; form.elements.download_path.value = ""; }
    }

    async function loadPillars(form, nicheId = "") {
        const select = form.elements.pillar_id;
        select.innerHTML = '<option value="">Select pillar</option>';
        let query = supabase.from("pillars").select("id,name,niche_id").order("name");
        if (nicheId) query = query.eq("niche_id", nicheId);
        const { data, error } = await query;
        if (error) { select.innerHTML = '<option value="">Pillars unavailable</option>'; return; }
        (data || []).forEach(row => select.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(row.id)}">${escapeHtml(row.name)}</option>`));
    }

    async function loadTopics(form) {
        const select = form.elements.topic_id;
        select.innerHTML = '<option value="">Select topic</option>';
        const pillarId = form.elements.pillar_id.value;
        if (!pillarId) return;
        const { data, error } = await supabase.from("topics").select("id,name,pillar_id").eq("pillar_id", pillarId).order("name");
        if (error) { select.innerHTML = '<option value="">Topics unavailable</option>'; return; }
        (data || []).forEach(row => select.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(row.id)}">${escapeHtml(row.name)}</option>`));
    }

    async function loadTags(form) {
        const box = form.querySelector("#videoTags");
        try {
            const { data, error } = await supabase.from("tags").select("id,name").order("name").limit(300);
            if (error) throw error;
            box.innerHTML = (data || []).map(tag => `<label class="tag-option"><input type="checkbox" name="tag_ids" value="${escapeHtml(tag.id)}"><span>${escapeHtml(tag.name)}</span></label>`).join("") || '<span class="taxonomy-muted">No tags yet. Add them in Taxonomy.</span>';
        } catch { box.innerHTML = '<span class="taxonomy-muted">Tags are not configured yet. Add the tags table migration, then reload.</span>'; }
    }

    async function loadNiches(form) {
        try {
            const { data, error } = await supabase.from("niches").select("id,name,niche_code").eq("status", "active").order("sort_order");
            if (error) throw error;
            const select = form.elements.niche_id;
            (data || []).forEach(niche => select.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(niche.id)}">${escapeHtml(niche.name)} (${escapeHtml(niche.niche_code)})</option>`));
            if (form.elements.pillar_id) { select.addEventListener("change", () => loadPillars(form, select.value)); await loadPillars(form, select.value); }
            if (form.elements.tag_ids) await loadTags(form);
        } catch (error) { console.error("Could not load niches:", error); }
    }

    async function saveVideo(form) {
        const duplicate = await validateVideoId(form);
        if (duplicate) throw new Error(`Video ID “${form.elements.video_id.value.trim()}” already exists in the library.`);
        const tagIds = [...form.querySelectorAll('input[name="tag_ids"]:checked')].map(input => input.value);
        const payload = {
            video_id: form.elements.video_id.value.trim(), url: form.elements.url.value.trim(), creator_code: form.elements.creator_code.value.trim(),
            download_path: form.elements.download_path.value.trim() || null, status: form.elements.status.value,
            niche_id: form.elements.niche_id.value || null, pillar_id: form.elements.pillar_id.value || null, topic_id: form.elements.topic_id.value || null, tags: tagIds
        };
        if (!payload.video_id || !payload.url || !payload.creator_code) throw new Error("URL, Creator ID and Video ID are required.");
        await insertWithSchemaFallback("videos", payload, [
            ["video_id", "url", "creator_code", "download_path", "status", "niche_id", "pillar_id", "topic_id", "tags"],
            ["video_id", "url", "creator_code", "download_path", "status"],
            ["video_id", "url", "creator_id", "download_path", "status"]
        ]);
    }

    async function saveCreator(form) {
        const payload = { creator_id: form.elements.creator_id.value.trim(), name: form.elements.name.value.trim(), platform: form.elements.platform.value.trim(), niche_id: form.elements.niche_id.value || null, sub_niche: form.elements.sub_niche.value.trim() || null, profile_link: form.elements.profile_link.value.trim() || null, total_videos: Number(form.elements.total_videos.value || 0), download_path: form.elements.download_path.value.trim() || null };
        if (!payload.creator_id || !payload.name || !payload.platform) throw new Error("Creator ID, Creator Name and Platform are required.");
        await insertWithSchemaFallback("creators", payload, [["creator_id", "name", "platform", "niche_id", "sub_niche", "profile_link", "total_videos", "download_path"],["creator_code", "name", "platform", "niche_id", "sub_niche", "profile_link", "total_videos", "download_path"]]);
    }

    async function saveProduct(form) {
        const payload = { name: form.elements.name.value.trim(), url: form.elements.url.value.trim() || null, platform: form.elements.platform.value.trim() || null, price: form.elements.price.value ? Number(form.elements.price.value) : null, status: form.elements.status.value, niche_id: form.elements.niche_id.value || null, notes: form.elements.notes.value.trim() || null };
        if (!payload.name) throw new Error("Product name is required.");
        await insertWithSchemaFallback("products", payload, [["name", "url", "platform", "price", "status", "niche_id", "notes"],["name", "url", "platform", "status", "niche_id"]]);
    }

    async function insertWithSchemaFallback(table, payload, keySets) {
        let lastError = null;
        for (const keys of keySets) {
            const candidate = {}; keys.forEach(key => { if (Object.prototype.hasOwnProperty.call(payload, key)) candidate[key] = payload[key]; });
            const { error } = await supabase.from(table).insert(candidate);
            if (!error) return;
            lastError = error; if (!looksLikeSchemaError(error)) break;
        }
        throw lastError || new Error(`Could not save to ${table}.`);
    }

    function creatorMatches(row, code) { const normalized = code.toLowerCase(); return [row.creator_id, row.creator_code, row.channel_id, row.channel_code, row.code].some(value => String(value ?? "").toLowerCase() === normalized); }
    function getDownloadPath(row) { return row.download_path || row.download_folder || row.download_dir || row.save_path || row.storage_path || ""; }
    function extractVideoId(url) {
        try { const parsed = new URL(url); const queryId = parsed.searchParams.get("vid") || parsed.searchParams.get("video_id") || parsed.searchParams.get("item_id") || parsed.searchParams.get("aweme_id"); if (queryId) return queryId; const parts = parsed.pathname.split("/").filter(Boolean); return parts.at(-1) || ""; } catch { return ""; }
    }
    function looksLikeSchemaError(error) { const message = String(error?.message || "").toLowerCase(); return message.includes("column") || message.includes("schema cache") || message.includes("could not find the table"); }
    function showFormMessage(form, message, error) { const box = form.querySelector(".add-form-message"); if (!box) return; box.textContent = message; box.classList.toggle("error", error); box.classList.remove("hidden"); }
    function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#039;", '"':"&quot;" }[char])); }

    const field = (label, name, type = "text", attrs = "") => `<label class="add-field"><span>${label}</span><input name="${name}" type="${type}" ${attrs}></label>`;
    const select = (label, name, options, attrs = "") => `<label class="add-field"><span>${label}</span><select name="${name}" ${attrs}>${options.map(([value,text]) => `<option value="${value}">${text}</option>`).join("")}</select></label>`;
    const footer = () => `<div class="add-form-message hidden"></div><div class="add-modal-actions"><button type="button" class="table-action" data-close-add-modal>Cancel</button><button type="submit" class="capture-button">Save</button></div>`;
    const shell = (title, description, body) => `<div class="add-modal-backdrop"><div class="add-modal-card" role="dialog" aria-modal="true"><div class="add-modal-header"><div><h2>${title}</h2><p>${description}</p></div><button type="button" class="add-modal-close" data-close-add-modal>×</button></div><form class="add-modal-form">${body}${footer()}</form></div></div>`;

    function videoTemplate() {
        return shell("Add Video", "Add a source video and classify it with your content taxonomy.", `<div class="add-form-grid">${field("URL", "url", "url", "required placeholder=\"https://...\"")}${field("Creator ID", "creator_code", "text", "required placeholder=\"Creator channel ID\"")}${field("Video ID", "video_id", "text", "required readonly placeholder=\"Auto extracted from URL\"")}${field("Download Path", "download_path", "text", "readonly placeholder=\"Auto from creator database\"")}${select("Niche", "niche_id", [["","Select niche"]])}${select("Pillar", "pillar_id", [["","Select pillar"]])}${select("Topic", "topic_id", [["","Select topic"]])}${select("Status", "status", [["discovered","Discovered"],["downloaded","Downloaded"],["editing","Editing"],["ready","Ready"],["published","Published"]])}</div><div class="taxonomy-picker"><div class="taxonomy-picker-title">Tags</div><div id="videoTags" class="tag-options"></div></div><div class="creator-lookup-status" name="creator_status"></div><div class="creator-lookup-status" name="video_duplicate_status"></div>`);
    }
    function creatorTemplate() { return shell("Add Creator", "Create a creator record for your research and download workflow.", `<div class="add-form-grid">${field("Creator ID", "creator_id", "text", "required placeholder=\"Channel ID / creator code\"")}${field("Creator Name", "name", "text", "required placeholder=\"Creator name\"")}${field("Platform", "platform", "text", "required placeholder=\"Douyin / XHS / TikTok\"")}${select("Niche", "niche_id", [["","Select niche"]])}${field("Sub Niche", "sub_niche", "text", "placeholder=\"Sub niche\"")}${field("Profile Link", "profile_link", "url", "placeholder=\"https://...\"")}${field("Total Videos", "total_videos", "number", "min=\"0\" value=\"0\"")}${field("Download Path", "download_path", "text", "placeholder=\"Local download folder\"")}</div>`); }
    function productTemplate() { return shell("Add Product", "Save a product for your affiliate/product research database.", `<div class="add-form-grid">${field("Product Name", "name", "text", "required placeholder=\"Product name\"")}${field("Product URL", "url", "url", "placeholder=\"https://...\"")}${field("Platform", "platform", "text", "placeholder=\"Shopee / TikTok Shop / ...\"")}${field("Price", "price", "number", "min=\"0\" step=\"0.01\" placeholder=\"0\"")}${select("Status", "status", [["researching","Researching"],["selected","Selected"],["archived","Archived"]])}${select("Niche", "niche_id", [["","Select niche"]])}<label class="add-field add-field-full"><span>Notes</span><textarea name="notes" rows="3" placeholder="Optional notes"></textarea></label></div>`); }
});