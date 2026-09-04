const STORAGE_KEY="content-os-taxonomy-view-controls-v1";
const VIEW_FIELDS={niches:["Code","Status"],pillars:["Code","Niche","Status"],topics:["Code","Niche","Pillar","Status"],keywords:["Keyword Meaning","Keyword Category","Niche","Pillar","Topic","Platform / Status"],tags:["Slug","Niche","Pillar","Topic"]};
let observer,state=loadState();
function loadState(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||{}}catch{return{}}}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function viewKey(){return document.querySelector("#taxonomyWorkspace [data-taxonomy-type].active")?.dataset.taxonomyType||"niches"}
function vs(){const k=viewKey();if(!state[k])state[k]={filters:{},columns:{}};return state[k]}
function norm(v){return String(v??"").trim().toLowerCase()}
function esc(v){return String(v??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;","'":"&#039;"}[c]))}
function headers(root){return[...root.querySelectorAll("#taxonomyTableHead th")].map((th,index)=>({index,label:th.textContent.trim().replace(/\s+/g," ")}))}
function rows(root){return[...root.querySelectorAll("#taxonomyTableBody tr")].filter(r=>r.querySelector("[data-tax-select]"))}
function initRoot(root){
  if(!root||root.dataset.viewControlsInitialized==="true")return;
  root.dataset.viewControlsInitialized="true";
  const rootObserver=new MutationObserver(()=>sync(root,rootObserver));
  root._taxonomyViewControlsObserver=rootObserver;
  rootObserver.observe(root,{childList:true,subtree:true});
  sync(root,rootObserver);
  root.addEventListener("click",e=>{
    if(e.target.closest("[data-tax-filter-button]"))toggle(root,"filter");
    if(e.target.closest("[data-tax-columns-button]"))toggle(root,"columns");
    if(e.target.closest("[data-tax-clear-filters]")){vs().filters={};saveState();sync(root,rootObserver)}
  });
  root.addEventListener("change",e=>{
    if(e.target.matches("[data-tax-filter-field]")){
      const f=e.target.dataset.taxFilterField,v=e.target.value,s=vs().filters;
      if(v)s[f]=v;else delete s[f];
      saveState();sync(root,rootObserver)
    }
    if(e.target.matches("[data-tax-column-field]")){
      const f=e.target.dataset.taxColumnField;
      vs().columns[f]=e.target.checked;
      saveState();
      applyColumns(root)
    }
  });
}
function init(){
  document.querySelectorAll("#taxonomyWorkspace").forEach(initRoot);
  if(observer)return;
  observer=new MutationObserver(()=>document.querySelectorAll("#taxonomyWorkspace").forEach(initRoot));
  observer.observe(document.body,{childList:true,subtree:true});
}
function sync(root,rootObserver){
  if(!root.querySelector("table.library-table"))return;
  rootObserver?.disconnect();
  renderControls(root);
  apply(root);
  rootObserver?.observe(root,{childList:true,subtree:true});
}
function renderControls(root){const toolbar=root.querySelector(".library-toolbar");if(!toolbar)return;let box=toolbar.querySelector("[data-tax-view-controls]");if(!box){box=document.createElement("div");box.dataset.taxViewControls="true";box.className="taxonomy-view-controls";toolbar.appendChild(box)}const hs=headers(root),view=viewKey(),fields=VIEW_FIELDS[view]||[],fs=hs.filter(h=>fields.includes(h.label)),s=vs(),count=Object.keys(s.filters).length;box.innerHTML=`<div class="taxonomy-control-actions"><button type="button" class="table-action" data-tax-filter-button>☷ Filters${count?` <span class="taxonomy-control-count">${count}</span>`:""}</button><button type="button" class="table-action" data-tax-columns-button>▦ Columns</button></div><div class="taxonomy-control-panel hidden" data-tax-panel="filter"><div class="taxonomy-panel-header"><strong>Filter ${esc(view)}</strong><button type="button" class="taxonomy-panel-clear" data-tax-clear-filters>Clear all</button></div><div class="taxonomy-filter-grid">${fs.map(f=>filterHtml(root,f,s.filters[f.label]||"")).join("")}</div></div><div class="taxonomy-control-panel hidden" data-tax-panel="columns"><div class="taxonomy-panel-header"><strong>Visible columns</strong></div><div class="taxonomy-column-grid">${hs.filter(h=>h.label&&h.label!=="Actions").map(h=>`<label><input type="checkbox" data-tax-column-field="${esc(h.label)}" ${s.columns[h.label]!==false?"checked":""}> <span>${esc(h.label)}</span></label>`).join("")}</div></div>`}
function filterHtml(root,h,selected){const vals=new Set();rows(root).forEach(r=>{const v=r.cells[h.index]?.textContent.trim().replace(/\s+/g," ");if(v&&v!=="—")vals.add(v)});return`<label class="taxonomy-filter-field"><span>${esc(h.label)}</span><select data-tax-filter-field="${esc(h.label)}"><option value="">All</option>${[...vals].sort((a,b)=>a.localeCompare(b)).map(v=>`<option value="${esc(v)}" ${norm(v)===norm(selected)?"selected":""}>${esc(v)}</option>`).join("")}</select></label>`}
function toggle(root,type){const p=root.querySelector(`[data-tax-panel="${type}"]`);if(!p)return;const open=p.classList.contains("hidden");root.querySelectorAll("[data-tax-panel]").forEach(x=>x.classList.add("hidden"));if(open)p.classList.remove("hidden")}
function apply(root){const s=vs(),hs=headers(root);rows(root).forEach(r=>{r.style.display=Object.entries(s.filters).every(([label,value])=>{const h=hs.find(x=>x.label===label);return !h||norm(r.cells[h.index]?.textContent)===norm(value)})?"":"none"});applyColumns(root)}
function applyColumns(root){const c=vs().columns;headers(root).forEach(h=>{const show=c[h.label]!==false;root.querySelectorAll(`table.library-table tr > :nth-child(${h.index+1})`).forEach(x=>x.style.display=show?"":"none")})}
document.addEventListener("DOMContentLoaded",init);
if(document.readyState!=="loading")init();
