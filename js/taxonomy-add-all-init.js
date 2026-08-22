import { initTaxonomyAddAllV2 } from "./taxonomy-add-all-v2.js";

const start = () => initTaxonomyAddAllV2();
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
