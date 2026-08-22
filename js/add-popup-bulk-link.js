let initialized = false;

function init() {
  if (initialized) return;
  initialized = true;
  const observer = new MutationObserver(() => inject());
  observer.observe(document.body, { childList: true, subtree: true });
  inject();
}

function inject() {
  const modal = document.getElementById("addModal");
  if (!modal || modal.classList.contains("hidden")) return;
  const form = modal.querySelector("form.add-modal-form");
  if (!form || form.querySelector("[data-popup-bulk]") || form.querySelector(".add-modal-bulk-link")) return;
  const title = modal.querySelector(".add-modal-header h2")?.textContent || "";
  const type = title.includes("Creator") ? "creator" : title.includes("Product") ? "product" : title.includes("Video") ? "video" : null;
  if (!type) return;
  const actions = form.querySelector(".add-modal-actions");
  if (!actions) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button secondary add-modal-bulk-link";
  button.dataset.popupBulk = type;
  button.textContent = `＋ Bulk Add ${type === "creator" ? "Creators" : type === "product" ? "Products" : "Videos"}`;
  button.onclick = () => document.dispatchEvent(new CustomEvent("content-os:open-bulk", { detail: { type } }));
  actions.insertBefore(button, actions.firstChild);
}

init();
