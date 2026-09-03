import { supabase } from "./supabase.js";

let initialized = false;

export function initAddModal() {
    const modal = document.getElementById("addModal");
    if (!modal || initialized) return;
    initialized = true;

    const openFromType = type => open(["video", "creator", "product", "content"].includes(type) ? type : "video");

    document.addEventListener("click", event => {
        const quick = event.target.closest?.("#quickAddButton");
        if (quick) {
            event.preventDefault();
            event.stopPropagation();
            document.getElementById("quickAddMenu")?.classList.toggle("hidden");
            return;
        }
        const addType = event.target.closest?.("[data-add-type]");
        if (addType) {
            event.preventDefault();
            event.stopPropagation();
            document.getElementById("quickAddMenu")?.classList.add("hidden");
            openFromType(addType.dataset.addType);
            return;
        }
        const libraryAdd = event.target.closest?.("[data-library-add]");
        if (libraryAdd) {
            event.preventDefault();
            event.stopPropagation();
            openFromType(libraryAdd.dataset.libraryAdd);
        }
    });

    document.addEventListener("content-os:open-add", event => {
        openFromType(typeof event.detail === "string" ? event.detail : event.detail?.type || "video");
    });

    modal.addEventListener("click", event => {
        if (event.target === modal || event.target.closest?.("[data-close-add-modal]")) close();
    });

    async function open(type) {
        try {
            modal.innerHTML = type === "video"
                ? videoTemplate()
                : type === "creator"
                    ? creatorTemplate()
                    : type === "product"
                        ? productTemplate()
                        : contentTemplate();
            modal.classList.remove("hidden");
            modal.setAttribute("aria-hidden", "false");
            await bind(type);
        } catch (error) {
            console.error("Failed to open add modal:", error);
            modal.innerHTML = `<div class="add-modal-backdrop"><div class="add-modal-card"><div class="add-modal-header"><div><h2>Could not open form</h2><p>${esc(error?.message || "Unknown error")}</p></div><button type="button" class="add-modal-close" data-close-add-modal>×</button></div></div></div>`;
            modal.classList.remove("hidden");
            modal.setAttribute("aria-hidden", "false");
        }
    }

    function close() {
        modal.classList.add("hidden");
        modal.setAttribute("aria-hidden", "true");
        modal.innerHTML = "";
    }

    async function bind(type) {
        const form = modal.querySelector("form");
        if (!form) return;
        if (type === "video") await bindVideo(form);
        if (type === "content") await bindContent(form);
        if (type === "creator" || type === "product") await loadNiches(form);

        form.addEventListener("submit", async event => {
            event.preventDefault();
            const button = form.querySelector('button[type="submit"]');
            if (button) button.disabled = true;
            try {
                if (type === "video") await saveVideo(form);
                else if (type === "creator") await saveCreator(form);
                else if (type === "product") await saveProduct(form);
                else await saveContent(form);
                msg(form, "Saved successfully.", false);
                document.dispatchEvent(new CustomEvent("content-os:data-changed", { detail: { type } }));
                setTimeout(close, 500);
            } catch (error) {
                msg(form, error.message || "Could not save record.", true);
            } finally {
                if (button) button.disabled = false;
            }
        });
    }

    async function bindVideo(form) {
        await Promise.all([loadCreators(form), loadNiches(form), loadTags(form)]);
        await loadPillars(form, "");

        const url = form.elements.url;
        const id = form.elements.video_id;
        const platform = form.elements.platform;
        const status = form.querySelector("[data-url-status]");

        const showUrlStatus = (text, kind = "") => {
            if (!status) return;
            status.textContent = text;
            status.className = `field-status ${kind}`.trim();
        };

        const syncUrlFromId = () => {
            const value = id.value.trim();
            if (!value) return;
            if (platform.value === "Douyin" && /^\d+$/.test(value)) {
                url.value = `https://www.douyin.com/video/${value}`;
                url.classList.add("field-valid");
                url.classList.remove("field-invalid");
                showUrlStatus(`✓ URL auto-filled from Video ID ${value}`, "success");
            }
        };

        const syncIdFromUrl = () => {
            const value = url.value.trim();
            if (!value) {
                showUrlStatus("");
                url.classList.remove("field-invalid", "field-valid");
                return;
            }
            if (platform.value !== "Douyin") {
                showUrlStatus("");
                url.classList.remove("field-invalid");
                return;
            }
            const parsed = parseDouyinVideoUrl(value);
            if (!parsed) {
                showUrlStatus("Please enter a valid Douyin video URL.", "error");
                url.classList.add("field-invalid");
                url.classList.remove("field-valid");
                return;
            }
            id.value = parsed;
            showUrlStatus(`✓ Video ID: ${parsed}`, "success");
            url.classList.remove("field-invalid");
            url.classList.add("field-valid");
        };

        url.addEventListener("input", syncIdFromUrl);
        id.addEventListener("input", syncUrlFromId);
        platform.addEventListener("change", () => {
            if (id.value.trim()) syncUrlFromId();
            if (url.value.trim()) syncIdFromUrl();
        });

        form.elements.creator_id?.addEventListener("change", async () => {
            const creatorId = form.elements.creator_id.value;
            if (!creatorId) return;
            const { data, error } = await supabase
                .from("creators")
                .select("niche_id,download_path")
                .eq("id", creatorId)
                .maybeSingle();
            if (error) return msg(form, error.message, true);
            if (!data) return;
            form.elements.niche_id.value = data.niche_id || "";
            await loadPillars(form, data.niche_id || "");
            if (form.elements.download_path) form.elements.download_path.value = data.download_path || "";
        });

        form.elements.niche_id?.addEventListener("change", () => loadPillars(form, form.elements.niche_id.value));
        form.elements.pillar_id?.addEventListener("change", () => loadTopics(form));
    }

    async function bindContent(form) {
        const videoSelect = form.elements.video_id;
        const { data, error } = await supabase
            .from("videos")
            .select("id,video_id,title,status,niche_id,pillar_id,topic_id")
            .in("status", ["editing", "edited", "ready", "scheduled", "published"])
            .order("created_at", { ascending: false });
        if (error) {
            videoSelect.innerHTML = '<option value="">Videos unavailable</option>';
            await loadTags(form);
            return;
        }
        videoSelect.innerHTML = '<option value="">Select video</option>';
        (data || []).forEach(video => videoSelect.insertAdjacentHTML("beforeend", `<option value="${esc(video.id)}">${esc(video.video_id || video.title || "Untitled")}</option>`));
        videoSelect.addEventListener("change", async () => {
            const video = (data || []).find(item => item.id === videoSelect.value);
            if (!video) return;
            await loadNiches(form, video.niche_id || "");
            await loadPillars(form, video.niche_id || "");
            form.elements.pillar_id.value = video.pillar_id || "";
            await loadTopics(form);
            form.elements.topic_id.value = video.topic_id || "";
        });
        await loadTags(form);
    }

    async function loadCreators(form) {
        const select = form.elements.creator_id;
        if (!select) return;
        const { data, error } = await supabase
            .from("creators")
            .select("id,creator_name,handle,creator_code")
            .eq("status", "active")
            .order("creator_name");
        if (error) {
            select.innerHTML = '<option value="">Creators unavailable</option>';
            return;
        }
        select.innerHTML = '<option value="">Select creator</option>';
        (data || []).forEach(row => select.insertAdjacentHTML("beforeend", `<option value="${esc(row.id)}">${esc(row.creator_name || row.handle || row.creator_code)}${row.handle ? ` · @${esc(row.handle.replace(/^@/, ""))}` : ""}</option>`));
    }

    async function loadNiches(form, selected = "") {
        const select = form.elements.niche_id;
        if (!select) return;
        const { data, error } = await supabase
            .from("niches")
            .select("id,name,niche_code")
            .eq("status", "active")
            .order("name");
        if (error) {
            console.error("Failed to load niches:", error);
            select.innerHTML = '<option value="">Niches unavailable</option>';
            return;
        }
        select.innerHTML = '<option value="">Select niche</option>';
        (data || []).forEach(row => select.insertAdjacentHTML("beforeend", `<option value="${esc(row.id)}">${esc(row.name)}${row.niche_code ? ` (${esc(row.niche_code)})` : ""}</option>`));
        if (selected) select.value = selected;
    }

    async function loadPillars(form, nicheId = "") {
        const select = form.elements.pillar_id;
        if (!select) return;
        let query = supabase.from("pillars").select("id,name,pillar_code,niche_id").order("name");
        if (nicheId) query = query.eq("niche_id", nicheId);
        const { data, error } = await query;
        if (error) {
            console.error("Failed to load pillars:", error);
            select.innerHTML = '<option value="">Pillars unavailable</option>';
            return;
        }
        select.innerHTML = '<option value="">Select pillar</option>';
        (data || []).forEach(row => select.insertAdjacentHTML("beforeend", `<option value="${esc(row.id)}">${esc(row.name)} (${esc(row.pillar_code)})</option>`));
        if (form.elements.topic_id) form.elements.topic_id.innerHTML = '<option value="">Select topic</option>';
    }

    async function loadTopics(form) {
        const select = form.elements.topic_id;
        const pillarId = form.elements.pillar_id?.value;
        if (!select) return;
        select.innerHTML = '<option value="">Select topic</option>';
        if (!pillarId) return;
        const { data, error } = await supabase
            .from("topics")
            .select("id,name,topic_code")
            .eq("pillar_id", pillarId)
            .order("name");
        if (error) {
            console.error("Failed to load topics:", error);
            select.innerHTML = '<option value="">Topics unavailable</option>';
            return;
        }
        (data || []).forEach(row => select.insertAdjacentHTML("beforeend", `<option value="${esc(row.id)}">${esc(row.name)} (${esc(row.topic_code)})</option>`));
    }

    async function loadTags(form) {
        const box = form.querySelector("#videoTags");
        if (!box) return;
        const { data, error } = await supabase.from("tags").select("id,name,slug").order("name").limit(300);
        if (error) {
            console.error("Failed to load tags:", error);
            box.innerHTML = `<span class="taxonomy-muted">Tags unavailable: ${esc(error.message || "Supabase request failed")}</span>`;
            return;
        }
        if (!data?.length) {
            box.innerHTML = '<span class="taxonomy-muted">No tags yet. Add them in Taxonomy.</span>';
            return;
        }
        box.innerHTML = data.map(tag => `<label class="tag-option"><input type="checkbox" name="tag_ids" value="${esc(tag.id)}"><span>#${esc(tag.name)}</span></label>`).join("");
    }

    async function saveVideo(form) {
        const videoId = form.elements.video_id.value.trim();
        const url = form.elements.url.value.trim();
        if (!videoId) throw new Error("Video ID is required.");
        if (form.elements.platform.value === "Douyin" && !parseDouyinVideoUrl(url)) throw new Error("Please enter a valid Douyin video URL.");
        const { data: duplicates, error: duplicateError } = await supabase.from("videos").select("id").eq("video_id", videoId).limit(1);
        if (duplicateError) throw duplicateError;
        if (duplicates?.length) throw new Error(`Video ID “${videoId}” already exists.`);
        const payload = {
            video_code: `VID-${Date.now()}`,
            video_id: videoId,
            platform_url: url,
            platform: form.elements.platform.value,
            creator_id: form.elements.creator_id.value || null,
            niche_id: form.elements.niche_id.value || null,
            pillar_id: form.elements.pillar_id.value || null,
            topic_id: form.elements.topic_id.value || null,
            title: form.elements.title.value.trim() || null,
            hook: form.elements.hook.value.trim() || null,
            caption: form.elements.caption.value.trim() || null,
            status: form.elements.status.value
        };
        if (!payload.creator_id) throw new Error("Video Creator is required.");
        const { data, error } = await supabase.from("videos").insert(payload).select("id").single();
        if (error) throw error;
        const tagIds = [...form.querySelectorAll('input[name="tag_ids"]:checked')].map(input => input.value);
        if (tagIds.length) {
            const { error: tagError } = await supabase.from("video_tags").insert(tagIds.map(tag_id => ({ video_id: data.id, tag_id })));
            if (tagError) throw tagError;
        }
    }

    async function saveContent(form) {
        const id = form.elements.video_id.value;
        if (!id) throw new Error("Please select a video.");
        const payload = {
            title: form.elements.title.value.trim() || null,
            hook: form.elements.hook.value.trim() || null,
            caption: form.elements.caption.value.trim() || null,
            pillar_id: form.elements.pillar_id.value || null,
            topic_id: form.elements.topic_id.value || null
        };
        const { error } = await supabase.from("videos").update(payload).eq("id", id);
        if (error) throw error;
        await supabase.from("video_tags").delete().eq("video_id", id);
        const tagIds = [...form.querySelectorAll('input[name="tag_ids"]:checked')].map(input => input.value);
        if (tagIds.length) {
            const { error: tagError } = await supabase.from("video_tags").insert(tagIds.map(tag_id => ({ video_id: id, tag_id })));
            if (tagError) throw tagError;
        }
    }

    async function saveCreator(form) {
        const payload = {
            creator_code: form.elements.creator_code?.value || null,
            creator_name: form.elements.creator_name.value.trim(),
            handle: form.elements.handle.value.trim() || null,
            platform: form.elements.platform.value,
            niche_id: form.elements.niche_id.value,
            profile_url: form.elements.profile_url.value.trim() || null,
            creator_type: form.elements.creator_type.value.trim() || null,
            content_style: form.elements.content_style.value.trim() || null,
            download_path: form.elements.download_path.value.trim() || null,
            status: form.elements.status.value
        };
        if (!payload.creator_name || !payload.platform || !payload.niche_id) throw new Error("Creator Name, Platform and Niche are required.");
        const { error } = await supabase.from("creators").insert(payload);
        if (error) throw error;
    }

    async function saveProduct(form) {
        const payload = {
            product_code: `PROD-${Date.now()}`,
            niche_id: form.elements.niche_id.value || null,
            category: form.elements.category.value.trim() || null,
            product_name: form.elements.product_name.value.trim(),
            brand: form.elements.brand.value.trim() || null,
            platform: form.elements.platform.value.trim() || null,
            product_url: form.elements.product_url.value.trim() || null,
            price: form.elements.price.value ? Number(form.elements.price.value) : null,
            affiliate_url: form.elements.affiliate_url.value.trim() || null,
            commission_rate: form.elements.commission_rate.value ? Number(form.elements.commission_rate.value) : null,
            repeat_purchase: form.elements.repeat_purchase.value === "true",
            affiliate_potential: form.elements.affiliate_potential.value ? Number(form.elements.affiliate_potential.value) : null,
            notes: form.elements.notes.value.trim() || null,
            status: form.elements.status.value
        };
        if (!payload.product_name) throw new Error("Product name is required.");
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
    }

    function parseDouyinVideoUrl(value) {
        try {
            const url = new URL(value);
            if (!["www.douyin.com", "douyin.com", "m.douyin.com"].includes(url.hostname)) return "";
            const modalId = url.searchParams.get("modal_id");
            if (modalId && /^\d+$/.test(modalId)) return modalId;
            return url.pathname.match(/\/video\/(\d+)/)?.[1] || "";
        } catch {
            return "";
        }
    }

    function msg(form, text, error) {
        const box = form.querySelector(".add-form-message");
        if (!box) return;
        box.textContent = text;
        box.classList.toggle("error", !!error);
        box.classList.remove("hidden");
    }

    const field = (label, name, type = "text", attrs = "") => `<label class="add-field"><span>${label}</span><input name="${name}" type="${type}" ${attrs}></label>`;
    const select = (label, name, options, attrs = "") => `<label class="add-field"><span>${label}</span><select name="${name}" ${attrs}>${options.map(([value, text]) => `<option value="${esc(value)}">${text}</option>`).join("")}</select></label>`;
    const footer = () => `<div class="add-form-message hidden"></div><div class="add-modal-actions"><button type="button" class="table-action" data-close-add-modal>Cancel</button><button type="submit" class="capture-button">Save</button></div>`;
    const shell = (title, description, body) => `<div class="add-modal-backdrop"><div class="add-modal-card" role="dialog" aria-modal="true"><div class="add-modal-header"><div><h2>${title}</h2><p>${description}</p></div><button type="button" class="add-modal-close" data-close-add-modal>×</button></div><form class="add-modal-form">${body}${footer()}</form></div></div>`;
    const grid = body => `<div class="add-form-grid">${body}</div>`;

    function videoTemplate() {
        return shell("Add Video", "Record a video in Library. Status starts at Recorded.", `${grid(
            `${field("Video URL", "url", "url", 'required placeholder="https://www.douyin.com/..."')}<div class="add-field-wrap">${field("Video ID", "video_id", "text", 'required placeholder="Auto-filled from URL"')}<small data-url-status class="field-status"></small></div>` +
            `${select("Creator", "creator_id", [["", "Loading creators..."]], "required")}${select("Platform", "platform", [["Douyin", "Douyin"], ["Xiaohongshu", "Xiaohongshu"], ["YouTube", "YouTube"], ["Instagram", "Instagram"], ["TikTok", "TikTok"]], "required")}` +
            `${select("Niche", "niche_id", [["", "Select niche"]])}${select("Pillar", "pillar_id", [["", "Select pillar"]])}` +
            `${select("Topic", "topic_id", [["", "Select topic"]])}${select("Status", "status", VIDEO_STATUSES.map(value => [value, STATUS_LABELS[value]]))}` +
            `${field("Title", "title", "text", 'placeholder="Optional"')}${field("Hook", "hook", "text", 'placeholder="Optional"')}` +
            `${field("Caption", "caption", "text", 'placeholder="Optional"')}${field("Download Path", "download_path", "text", 'readonly placeholder="From creator"')}`
        )}<div class="taxonomy-picker"><div class="taxonomy-picker-title">Tags</div><div id="videoTags" class="tag-options"></div></div>`);
    }

    function creatorTemplate() {
        return shell("Add Creator", "Creator Code is generated automatically.", `<input type="hidden" name="creator_code">${grid(
            `${field("Creator Name", "creator_name", "text", 'required placeholder="Creator name"')}${select("Platform", "platform", [["Douyin", "Douyin"], ["Xiaohongshu", "Xiaohongshu"], ["YouTube", "YouTube"], ["Instagram", "Instagram"], ["TikTok", "TikTok"]], "required")}` +
            `${select("Niche", "niche_id", [["", "Select niche"]], "required")}${field("Handle", "handle", "text", 'placeholder="@username"')}` +
            `${field("Profile URL", "profile_url", "url", 'placeholder="Optional"')}${field("Creator Type", "creator_type", "text", 'placeholder="Optional"')}` +
            `${field("Content Style", "content_style", "text", 'placeholder="Optional"')}${field("Download Path", "download_path", "text", 'placeholder="Optional"')}` +
            `${select("Status", "status", [["active", "Active"], ["inactive", "Inactive"]])}`
        )}`);
    }

    function productTemplate() {
        return shell("Add Product", "Add a product or affiliate record to Library.", `${grid(
            `${field("Product Name", "product_name", "text", 'required placeholder="Product name"')}${select("Niche", "niche_id", [["", "Select niche"]])}` +
            `${field("Category", "category", "text", 'placeholder="Optional"')}${field("Brand", "brand", "text", 'placeholder="Optional"')}` +
            `${field("Platform", "platform", "text", 'placeholder="Optional"')}${field("Product URL", "product_url", "url", 'placeholder="Optional"')}` +
            `${field("Price", "price", "number", 'step="0.01" min="0" placeholder="Optional"')}${field("Affiliate URL", "affiliate_url", "url", 'placeholder="Optional"')}` +
            `${field("Commission Rate", "commission_rate", "number", 'step="0.01" min="0" placeholder="Optional"')}${select("Repeat Purchase", "repeat_purchase", [["false", "No"], ["true", "Yes"]])}` +
            `${field("Affiliate Potential", "affiliate_potential", "number", 'step="0.01" min="0" placeholder="Optional"')}${select("Status", "status", [["active", "Active"], ["inactive", "Inactive"]])}` +
            `${field("Notes", "notes", "text", 'placeholder="Optional"')}`
        )}`);
    }

    function contentTemplate() {
        return shell("Add Content", "Turn a library video into a content draft.", `${grid(
            `${select("Video", "video_id", [["", "Loading videos..."]], "required")}${select("Pillar", "pillar_id", [["", "Select pillar"]])}` +
            `${select("Topic", "topic_id", [["", "Select topic"]])}${field("Title", "title", "text", 'placeholder="Optional"')}` +
            `${field("Hook", "hook", "text", 'placeholder="Optional"')}${field("Caption", "caption", "text", 'placeholder="Optional"')}`
        )}<div class="taxonomy-picker"><div class="taxonomy-picker-title">Tags</div><div id="videoTags" class="tag-options"></div></div>`);
    }

    function esc(value) {
        return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[char]));
    }
}
