import "./add-popup-bulk-link.js";

// Keep Video URL <-> Video ID in sync even though the Add Video form is rendered dynamically.
// Douyin URLs can be either /video/VIDEO_ID or a profile URL containing ?modal_id=VIDEO_ID.
document.addEventListener("input", event => {
  const field = event.target;
  if (!(field instanceof HTMLInputElement)) return;
  const form = field.closest("#addModal form");
  if (!form) return;

  const url = form.elements.url;
  const id = form.elements.video_id;
  if (!url || !id) return;

  if (field === url) {
    const value = url.value.trim();
    const match = value.match(/[?&]modal_id=(\d+)/i) || value.match(/\/video\/(\d+)/i);
    if (match?.[1]) {
      id.value = match[1];
      url.classList.remove("field-invalid");
      url.classList.add("field-valid");
      const status = form.querySelector("[data-url-status]");
      if (status) {
        status.textContent = `✓ Video ID: ${match[1]}`;
        status.className = "field-status success";
      }
    }
  }

  if (field === id) {
    const value = id.value.trim();
    if (/^\d+$/.test(value)) {
      url.value = `https://www.douyin.com/video/${value}`;
      url.classList.remove("field-invalid");
      url.classList.add("field-valid");
      const status = form.querySelector("[data-url-status]");
      if (status) {
        status.textContent = `✓ URL auto-filled from Video ID ${value}`;
        status.className = "field-status success";
      }
    }
  }
});
