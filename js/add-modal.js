import { supabase } from "./supabase.js";

document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("quickAddButton"), menu = document.getElementById("quickAddMenu"), modal = document.getElementById("addModal");
    if (!button || !menu || !modal) return;
    button.addEventListener("click", event => { event.stopPropagation(); menu.classList.toggle("hidden"); });
    menu.addEventListener("click", event => { const option = event.target.closest("[data-add-type]"); if (!option) return; menu.classList.add("hidden"); openModal(option.dataset.addType); });
    modal.addEventListener("click", event => { if (event.target === modal || event.target.closest("[data-close-add-modal]")) closeModal(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !modal.classList.contains("hidden")) closeModal(); });

    const style = document.createElement("style");
    style.textContent = `.add-modal-header h2{font-size:20px}.add-modal-header p{font-size:11px}.add-field{font-size:10px}.add-field input,.add-field select,.add-field textarea{font-size:12px}.creator-lookup-status{font-size:10px}.taxonomy-picker-title{font-size:10px}.tag-option{font-size:10px}.add-form-message{font-size:11px}.add-modal-actions .table-action,.add-modal-actions .capture-button{font-size:11px}`;
    document.head.appendChild(style);

    function openModal(type) { modal.innerHTML = type === "video" ? videoTemplate() : type === "creator" ? creatorTemplate() : productTemplate(); modal.classList.remove("hidden"); modal.setAttribute("aria-hidden", "false"); bindModal(type); }
    function closeModal() { modal.classList.add("hidden"); modal.setAttribute("aria-hidden", "true"); modal.innerHTML = ""; }
    const statusBox = (form, name) => form.querySelector(`[data-status="${name}"]`);

    function bindModal(type) {
        const form = modal.querySelector("form"); if (!form) return;
        if (type === "video") bindVideoForm(form);
        if (type === "creator" || type === "product") loadNiches(form);
        form.addEventListener("submit", async event => {
            event.preventDefault(); const submit = form.querySelector("button[type=submit]"); submit.disabled = true;
            try { if (type === "video") await saveVideo(form); else if (type === "creator") await saveCreator(form); else await saveProduct(form); showFormMessage(form, "Saved successfully.", false); setTimeout(closeModal, 650); }
            catch (error) { console.error("Add modal error:", error); showFormMessage(form, error.message || "Could not save record.", true); }
            finally { submit.disabled = false; }
        });
    }

    function bindVideoForm(form) {
        const url = form.elements.url, creatorCode = form.elements.creator_code, videoId = form.elements.video_id, niche = form.elements.niche_id;
        url.addEventListener("input", async () => {
            const id = extractVideoId(url.value);
            videoId.value = id;
            if (id) await validateVideoId(form);
        });
        videoId.addEventListener("input", async () => {
            const id = videoId.value.trim();
            if (/^\d+$/.test(id)) url.value = `https://www.douyin.com/video/${id}`;
            await validateVideoId(form);
        });
        creatorCode.addEventListener("blur", () => resolveCreator(form));
        creatorCode.addEventListener("input", () => { form.elements.download_path.value = ""; statusBox(form, "creator").textContent = ""; });
        niche.addEventListener("change", async () => { await loadPillars(form, niche.value); form.elements.topic_id.innerHTML = '<option value="">Select topic</option>'; });
        form.elements.pillar_id.addEventListener("change", () => loadTopics(form));
        loadTags(form); loadPillars(form, "");
    }

    async function validateVideoId(form) {
        const id = form.elements.video_id.value.trim(), box = statusBox(form, "video");
        if (!id) { box.textContent = ""; return false; }
        box.textContent = "Checking video ID…"; box.classList.remove("error", "success");
        try {
            const { data, error } = await supabase.from("videos").select("id,video_id").eq("video_id", id).limit(1);
            if (error) { if (looksLikeSchemaError(error)) { box.textContent = ""; return false; } throw error; }
            const duplicate = Boolean(data?.length); box.textContent = duplicate ? `⚠ Video ID “${id}” already exists in your library.` : "✓ Video ID is available.";
            box.classList.toggle("error", duplicate); box.classList.toggle("success", !duplicate); form.elements.video_id.dataset.duplicate = duplicate ? "true" : "false"; return duplicate;
        } catch (error) { box.textContent = error.message || "Could not validate video ID."; box.classList.add("error"); return false; }
    }

    async function resolveCreator(form) {
        const code = form.elements.creator_code.value.trim(); if (!code) return;
        const status = statusBox(form, "creator"); status.textContent = "Looking up creator…";
        try {
            const { data, error } = await supabase.from("creators").select("*").limit(100); if (error) throw error;
            const creator = (data || []).find(row => creatorMatches(row, code)); if (!creator) throw new Error(`Creator ID “${code}” was not found in the creator database.`);
            const path = getDownloadPath(creator); form.elements.download_path.value = path || ""; status.textContent = path ? `✓ ${creator.creator_name || "Creator"} found` : `✓ ${creator.creator_name || "Creator"} found — no download path saved`;
            const nicheId = creator.niche_id || ""; form.elements.niche_id.value = nicheId; await loadPillars(form, nicheId); await loadTopics(form);
        } catch (error) { status.textContent = error.message || "Creator lookup failed."; form.elements.download_path.value = ""; status.classList.add("error"); }
    }

    async function loadPillars(form, nicheId = "") {
        const select = form.elements.pillar_id; select.innerHTML = '<option value="">Select pillar</option> <option value="__loading" disabled>Loading…</option>';
        let query = supabase.from("pillars").select("id,name,niche_id").order("name"); if (nicheId) query = query.eq("niche_id", nicheId);
        const { data, error } = await query; if (error) { select.innerHTML = '<option value="">Pillars unavailable</option>'; return; }
        select.innerHTML = '<option value="">Select pillar</option>';
        (data || []).forEach(row => select.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(row.id)}">${escapeHtml(row.name)}</option>`));
    }
    async function loadTopics(form) {
        const select = form.elements.topic_id; select.innerHTML = '<option value="">Select topic</option>'; const pillarId = form.elements.pillar_id.value; if (!pillarId) return;
        const { data, error } = await supabase.from("topics").select("id,name,pillar_id").eq("pillar_id", pillarId).order("name"); if (error) { select.innerHTML = '<option value="">Topics unavailable</option>'; return; }
        (data || []).forEach(row => select.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(row.id)}">${escapeHtml(row.name)}</option>`));
    }
    async function loadTags(form) {
        const box = form.querySelector("#videoTags"); if (!box) return;
        try { const { data, error } = await supabase.from("tags").select("id,name").order("name").limit(300); if (error) throw error; box.innerHTML = (data || []).map(tag => `<label class="tag-option"><input type="checkbox" name="tag_ids" value="${escapeHtml(tag.id)}"><span>${escapeHtml(tag.name)}</span></label>`).join("") || '<span class="taxonomy-muted">No tags yet. Add them in Taxonomy.</span>'; }
        catch { box.innerHTML = '<span class="taxonomy-muted">Tags are not configured yet. Add them in Taxonomy.</span>'; }
    }
    async function loadNiches(form) {
        try { const { data, error } = await supabase.from("niches").select("id,name,niche_code").eq("status", "active").order("sort_order"); if (error) throw error; const select = form.elements.niche_id; (data || []).forEach(niche => select.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(niche.id)}">${escapeHtml(niche.name)} (${escapeHtml(niche.niche_code)})</option>`)); }
        catch (error) { console.error("Could not load niches:", error); }
    }

    async function saveVideo(form) {
        if (await validateVideoId(form)) throw new Error(`Video ID “${form.elements.video_id.value.trim()}” already exists in the library.`);
        const tagIds = [...form.querySelectorAll('input[name="tag_ids"]:checked')].map(input => input.value);
        const payload = { video_id: form.elements.video_id.value.trim(), url: form.elements.url.value.trim(), creator_code: form.elements.creator_code.value.trim(), download_path: form.elements.download_path.value.trim() || null, status: form.elements.status.value, niche_id: form.elements.niche_id.value || null, pillar_id: form.elements.pillar_id.value || null, topic_id: form.elements.topic_id.value || null, tags: tagIds };
        if (!payload.video_id || !payload.url || !payload.creator_code) throw new Error("URL, Creator ID and Video ID are required.");
        await insertWithSchemaFallback("videos", payload, [["video_id","url","creator_code","download_path","status","niche_id","pillar_id","topic_id","tags"],["video_id","url","creator_code","download_path","status"],["video_id","url","creator_id","download_path","status"]]);
    }

    async function saveCreator(form) {
        const payload = {
            creator_code: form.elements.creator_code.value.trim(),
            creator_name: form.elements.creator_name.value.trim(),
            platform: form.elements.platform.value.trim(),
            niche_id: form.elements.niche_id.value || null,
            profile_url: form.elements.profile_url.value.trim() || null,
            creator_type: form.elements.creator_type.value.trim() || null,
            download_path: form.elements.download_path.value.trim() || null,
            status: form.elements.status.value
        };
        if (!payload.creator_code || !payload.creator_name || !payload.platform) throw new Error("Creator Code, Creator Name and Platform are required.");
        await insertWithSchemaFallback("creators", payload, [["creator_code","creator_name","platform","niche_id","profile_url","creator_type","download_path","status"],["creator_code","creator_name","platform","niche_id","profile_url","download_path","status"],["creator_code","creator_name","platform","niche_id","profile_url","status"]]);
    }

    async function saveProduct(form) { const payload = { name: form.elements.name.value.trim(), url: form.elements.url.value.trim() || null, platform: form.elements.platform.value.trim() || null, price: form.elements.price.value ? Number(form.elements.price.value) : null, status: form.elements.status.value, niche_id: form.elements.niche_id.value || null, notes: form.elements.notes.value.trim() || null }; if (!payload.name) throw new Error("Product name is required."); await insertWithSchemaFallback("products", payload, [["name","url","platform","price","status","niche_id","notes"],["name","url","platform","status","niche_id"]]); }
    async function insertWithSchemaFallback(table, payload, keySets) { let lastError = null; for (const keys of keySets) { const candidate = {}; keys.forEach(key => { if (Object.prototype.hasOwnProperty.call(payload,key)) candidate[key] = payload[key]; }); const { error } = await supabase.from(table).insert(candidate); if (!error) return; lastError = error; if (!looksLikeSchemaError(error)) break; } throw lastError || new Error(`Could not save to ${table}.`); }
    function creatorMatches(row, code) { const normalized = code.toLowerCase(); return [row.creator_code,row.creator_id,row.channel_id,row.channel_code,row.code].some(value => String(value ?? "").toLowerCase() === normalized); }
    function getDownloadPath(row) { return row.download_path || row.download_folder || row.download_dir || row.save_path || row.storage_path || ""; }
    function extractVideoId(url) {
        try {
            const parsed = new URL(url.trim());
            const modalId = parsed.searchParams.get("modal_id");
            if (modalId && /^\d+$/.test(modalId)) return modalId;
            const videoPath = parsed.pathname.match(/\/video\/(\d+)/);
            if (videoPath?.[1]) return videoPath[1];
            const queryId = parsed.searchParams.get("vid") || parsed.searchParams.get("video_id") || parsed.searchParams.get("item_id") || parsed.searchParams.get("aweme_id");
            if (queryId) return queryId;
            const parts = parsed.pathname.split("/").filter(Boolean);
            const last = parts.at(-1) || "";
            return /^\d+$/.test(last) ? last : "";
        } catch { return ""; }
    }
    function looksLikeSchemaError(error) { const message = String(error?.message || "").toLowerCase(); return message.includes("column") || message.includes("schema cache") || message.includes("could not find the table"); }
    function showFormMessage(form, message, error) { const box = form.querySelector(".add-form-message"); if (!box) return; box.textContent = message; box.classList.toggle("error", error); box.classList.remove("hidden"); }
    function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"}[char])); }
    const field = (label,name,type="text",attrs="") => `<label class="add-field"><span>${label}</span><input name="${name}" type="${type}" ${attrs}></label>`;
    const select = (label,name,options,attrs="") => `<label class="add-field"><span>${label}</span><select name="${name}" ${attrs}>${options.map(([value,text])=>`<option value="${value}">${text}</option>`).join("")}</select>`;
    const footer = () => `<div class="add-form-message hidden"></div><div class="add-modal-actions"><button type="button" class="table-action" data-close-add-modal>Cancel</button><button type="submit" class="capture-button">Save</button></div>`;
    const shell = (title,description,body) => `<div class="add-modal-backdrop"><div class="add-modal-card" role="dialog" aria-modal="true"><div class="add-modal-header"><div><h2>${title}</h2><p>${description}</p></div><button type="button" class="add-modal-close" data-close-add-modal>×</button></div><form class="add-modal-form">${body}${footer()}</form></div></div>`;
    function videoTemplate() { return shell("Add Video","Add a source video and classify it with your content taxonomy.",`<div class="add-form-grid">${field("URL","url","url",'required placeholder="https://..."')}${field("Creator ID","creator_code","text",'required placeholder="Creator channel ID"')}${field("Video ID","video_id","text",'required placeholder="Enter or auto-extract video ID"')}${field("Download Path","download_path","text",'readonly placeholder="Auto from creator database"')}${select("Niche","niche_id",[["","Select niche"]])}${select("Pillar","pillar_id",[["","Select pillar"]])}${select("Topic","topic_id",[["","Select topic"]])}${select("Status","status",[["downloaded","Downloaded"],["editing","Editing"],["ready","Ready"],["scheduled","Scheduled"],["published","Published"]])}</div><div class="taxonomy-picker"><div class="taxonomy-picker-title">Tags</div><div id="videoTags" class="tag-options"></div></div><div class="creator-lookup-status" data-status="creator"></div><div class="creator-lookup-status" data-status="video"></div>`); }
    function creatorTemplate() { return shell("Add Creator","Create a creator record for your research and download workflow.",`<div class="add-form-grid">${field("Creator Code","creator_code","text",'required placeholder="Channel ID / creator code"')}${field("Creator Name","creator_name","text",'required placeholder="Creator name"')}${field("Platform","platform","text",'required placeholder="Douyin / XHS / TikTok"')}${select("Niche","niche_id",[["","Select niche"]])}${field("Profile URL","profile_url","url",'placeholder="https://..."')}${field("Creator Type","creator_type","text",'placeholder="Photography / Fashion / ..."')}${field("Download Path","download_path","text",'placeholder="Local download folder"')}${select("Status","status",[["active","Active"],["watching","Watching"],["inactive","Inactive"]])}</div>`); }
    function productTemplate() { return shell("Add Product","Save a product for your affiliate/product research database.",`<div class="add-form-grid">${field("Product Name","name","text",'required placeholder="Product name"')}${field("Product URL","url","url",'placeholder="https://..."')}${field("Platform","platform","text",'placeholder="Shopee / TikTok Shop / ..."')}${field("Price","price","number",'min="0" step="0.01" placeholder="0"')}${select("Status","status",[["active","Active"],["inactive","Inactive"],["testing","Testing"]])}${select("Niche","niche_id",[["","Select niche"]])}<label class="add-field add-field-full"><span>Notes</span><textarea name="notes" rows="3" placeholder="Optional notes"></textarea></label></div>`); }
});
