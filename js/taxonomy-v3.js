import { supabase } from "./supabase.js";
import { getCurrentNicheId } from "./state.js";
import { initTaxonomyAddAll } from "./taxonomy-add-all.js";

const TYPES=[
  {key:"niches",label:"Niches",singular:"Niche",table:"niches"},
  {key:"pillars",label:"Pillars",singular:"Pillar",table:"pillars"},
  {key:"topics",label:"Topics",singular:"Topic",table:"topics"},
  {key:"keywords",label:"Keywords",singular:"Keyword",table:"keywords"},
  {key:"tags",label:"Tags",singular:"Tag",table:"tags"}
];
let active="niches",cache=[],parents={niches:new Map(),pillars:new Map(),topics:new Map()};

export async function initTaxonomy(){
  const root=document.getElementById("taxonomyWorkspace");
  if(!root||root.dataset.initializedV3==="true")return;
  root.dataset.initializedV3="true";
  initTaxonomyAddAll();
  root.querySelectorAll("[data-taxonomy-type]").forEach(btn=>btn.onclick=async()=>{active=btn.dataset.taxonomyType;setActive(root);await load()});
  document.addEventListener("content-os:taxonomy-view",e=>{if(!root.isConnected||!TYPES.some(t=>t.key===e.detail))return;active=e.detail;setActive(root);load()});
  root.querySelector("#taxonomySearch")?.addEventListener("input",e=>render(e.target.value));
  root.querySelector("#taxonomyAddButton")?.addEventListener("click",()=>openModal());
  root.addEventListener("click",e=>{
    const edit=e.target.closest("[data-tax-edit]"); if(edit)return openModal(edit.dataset.taxEdit);
    const del=e.target.closest("[data-tax-delete]"); if(del)return deleteRecord(del.dataset.taxDelete);
    const bulk=e.target.closest("[data-tax-bulk-delete]"); if(bulk)return bulkDelete();
    const selectAll=e.target.closest("[data-tax-select-all]"); if(selectAll)toggleAll(selectAll.checked);
  });
  root.addEventListener("change",e=>{if(e.target.matches("[data-tax-select]"))updateBulkState()});
  root.addEventListener("dblclick",e=>{const cell=e.target.closest("[data-tax-inline]");if(cell)editInline(cell)});
  await load();
}
function cfg(){return TYPES.find(t=>t.key===active)||TYPES[0]}
function setActive(root){root.querySelectorAll("[data-taxonomy-type]").forEach(b=>b.classList.toggle("active",b.dataset.taxonomyType===active))}

async function load(){
  const c=cfg(),nicheId=getCurrentNicheId();
  try{
    await loadParentMaps();
    let q=supabase.from(c.table).select("*").limit(500);
    if(nicheId)q=q.eq("niche_id",nicheId);
    if(c.table==="niches"&&nicheId)q=supabase.from("niches").select("*").eq("id",nicheId).limit(1);
    q=c.table==="niches"?q.order("sort_order"):q.order("created_at",{ascending:false});
    const {data,error}=await q;if(error)throw error;
    cache=data||[];
    document.getElementById("taxonomyCount").textContent=`${cache.length} records`;
    document.getElementById("taxonomyAddButton").textContent=`＋ Add ${c.singular}`;
    document.getElementById("taxonomyTableHead").innerHTML=tableHead(c.table);
    render(document.getElementById("taxonomySearch")?.value||"");
  }catch(error){
    cache=[];document.getElementById("taxonomyCount").textContent="0 records";
    document.getElementById("taxonomyTableBody").innerHTML=`<tr><td colspan="8"><div class="empty-state compact"><strong>Could not load ${esc(c.label)}</strong><p>${esc(error.message||"Supabase request failed.")}</p></div></td></tr>`;
  }
}
async function loadParentMaps(){
  const [{data:niches,error:ne},{data:pillars,error:pe},{data:topics,error:te}]=await Promise.all([
    supabase.from("niches").select("id,name,niche_code"),
    supabase.from("pillars").select("id,name,pillar_code,niche_id"),
    supabase.from("topics").select("id,name,topic_code,pillar_id,niche_id")
  ]);
  if(ne||pe||te)throw(ne||pe||te);
  parents={niches:new Map((niches||[]).map(r=>[String(r.id),r])),pillars:new Map((pillars||[]).map(r=>[String(r.id),r])),topics:new Map((topics||[]).map(r=>[String(r.id),r]))};
}
function tableHead(type){
  const select="<th class=\"taxonomy-select-col\"><input type=\"checkbox\" data-tax-select-all aria-label=\"Select all\"></th>";
  if(type==="niches")return`${select}<th>Name</th><th>Code</th><th>Description</th><th>Status</th><th>Date Added</th><th>Actions</th>`;
  if(type==="pillars")return`${select}<th>Pillar</th><th>Code</th><th>Niche</th><th>Status</th><th>Date Added</th><th>Actions</th>`;
  if(type==="topics")return`${select}<th>Topic</th><th>Code</th><th>Niche</th><th>Pillar</th><th>Status</th><th>Date Added</th><th>Actions</th>`;
  if(type==="keywords")return`${select}<th>Keyword</th><th>Keyword Meaning</th><th>Keyword Category</th><th>Niche</th><th>Pillar</th><th>Topic</th><th>Platform / Status</th><th>Actions</th>`;
  return`${select}<th>Tag</th><th>Slug</th><th>Niche</th><th>Pillar</th><th>Topic</th><th>Date Added</th><th>Actions</th>`;
}
function render(search=""){
  const root=document.getElementById("taxonomyWorkspace"),q=search.trim().toLowerCase();
  const rows=cache.filter(r=>!q||JSON.stringify(r).toLowerCase().includes(q)||contextText(r).toLowerCase().includes(q));
  const toolbar=root.querySelector(".library-toolbar");
  let bulk=toolbar?.querySelector("[data-tax-bulk-delete]");
  if(!bulk&&toolbar){bulk=document.createElement("button");bulk.type="button";bulk.className="table-action danger";bulk.dataset.taxBulkDelete="true";bulk.textContent="Delete selected";bulk.disabled=true;toolbar.appendChild(bulk)}
  document.getElementById("taxonomyTableBody").innerHTML=rows.map(rowHtml).join("")||`<tr><td colspan="8"><div class="empty-state compact"><strong>No ${cfg().label.toLowerCase()} found</strong><p>${q?"Try another search.":`Add your first ${cfg().singular.toLowerCase()}.`}</p></div></td></tr>`;
  updateBulkState();
}
function parentName(type,id){const r=parents[type]?.get(String(id));if(!r)return"—";const code=r.niche_code||r.pillar_code||r.topic_code;return`${r.name||"—"}${code?` (${code})`:""}`}
function contextText(r){return[r.niche_id&&parentName("niches",r.niche_id),r.pillar_id&&parentName("pillars",r.pillar_id),r.topic_id&&parentName("topics",r.topic_id)].filter(Boolean).join(" / ")}
function actions(id){return`<td class="row-actions"><button type="button" class="table-action" data-tax-edit="${esc(id)}">Edit</button><button type="button" class="table-action danger" data-tax-delete="${esc(id)}">Delete</button></td>`}
function checkbox(id){return`<td class="taxonomy-select-col"><input type="checkbox" data-tax-select value="${esc(id)}" aria-label="Select row"></td>`}
function rowHtml(r){
  const c=cfg();
  if(c.table==="niches")return`<tr>${checkbox(r.id)}<td><div class="source-title" data-tax-inline data-id="${esc(r.id)}" data-field="name">${esc(r.name||"—")}</div></td><td>${esc(r.niche_code||"—")}</td><td><div data-tax-inline data-id="${esc(r.id)}" data-field="description">${esc(r.description||"—")}</div></td><td><span class="badge">${esc(r.status||"active")}</span></td><td>${date(r.created_at)}</td>${actions(r.id)}</tr>`;
  if(c.table==="pillars")return`<tr>${checkbox(r.id)}<td><div class="source-title" data-tax-inline data-id="${esc(r.id)}" data-field="name">${esc(r.name||"—")}</div></td><td>${esc(r.pillar_code||"—")}</td><td>${esc(parentName("niches",r.niche_id))}</td><td><span class="badge">${esc(r.status||"active")}</span></td><td>${date(r.created_at)}</td>${actions(r.id)}</tr>`;
  if(c.table==="topics")return`<tr>${checkbox(r.id)}<td><div class="source-title" data-tax-inline data-id="${esc(r.id)}" data-field="name">${esc(r.name||"—")}</div></td><td>${esc(r.topic_code||"—")}</td><td>${esc(parentName("niches",r.niche_id))}</td><td>${esc(parentName("pillars",r.pillar_id))}</td><td><span class="badge">${esc(r.status||"active")}</span></td><td>${date(r.created_at)}</td>${actions(r.id)}</tr>`;
  if(c.table==="keywords")return`<tr>${checkbox(r.id)}<td><div class="source-title" data-tax-inline data-id="${esc(r.id)}" data-field="keyword">${esc(r.keyword||"—")}</div></td><td>${esc(r.vietnamese_meaning||"—")}</td><td>${esc(r.category||"—")}</td><td>${esc(parentName("niches",r.niche_id))}</td><td>${esc(parentName("pillars",r.pillar_id))}</td><td>${esc(parentName("topics",r.topic_id))}</td><td>${esc(r.platform||"—")} / ${esc(r.status||"active")}</td>${actions(r.id)}</tr>`;
  return`<tr>${checkbox(r.id)}<td><div class="source-title" data-tax-inline data-id="${esc(r.id)}" data-field="name">${esc(r.name||"—")}</div></td><td>${esc(r.slug||"—")}</td><td>${esc(parentName("niches",r.niche_id))}</td><td>${esc(parentName("pillars",r.pillar_id))}</td><td>${esc(parentName("topics",r.topic_id))}</td><td>${date(r.created_at)}</td>${actions(r.id)}</tr>`;
}
function toggleAll(checked){document.querySelectorAll("#taxonomyTableBody [data-tax-select]").forEach(x=>x.checked=checked);updateBulkState()}
function updateBulkState(){const root=document.getElementById("taxonomyWorkspace");const boxes=[...root.querySelectorAll("#taxonomyTableBody [data-tax-select]")],selected=boxes.filter(x=>x.checked);const bulk=root.querySelector("[data-tax-bulk-delete]");if(bulk){bulk.disabled=!selected.length;bulk.textContent=selected.length?`Delete selected (${selected.length})`:"Delete selected"}const all=root.querySelector("[data-tax-select-all]");if(all){all.checked=boxes.length>0&&selected.length===boxes.length;all.indeterminate=selected.length>0&&selected.length<boxes.length}}
async function bulkDelete(){
  const ids=[...document.querySelectorAll("#taxonomyTableBody [data-tax-select]:checked")].map(x=>x.value);if(!ids.length)return;
  const c=cfg();
  if(!confirm(`Delete ${ids.length} selected ${c.singular.toLowerCase()}(s)? Related taxonomy records will also be removed where applicable.`))return;
  try{
    if(c.table==="niches"){
      const {data:pillars,error:pe}=await supabase.from("pillars").select("id").in("niche_id",ids);if(pe)throw pe;
      const pids=(pillars||[]).map(x=>x.id);const {data:topics,error:te}=pids.length?await supabase.from("topics").select("id").in("pillar_id",pids):{data:[],error:null};if(te)throw te;
      const tids=(topics||[]).map(x=>x.id);await deleteChildren({nicheIds:ids,pillarIds:pids,topicIds:tids});
      const {error}=await supabase.from("niches").delete().in("id",ids);if(error)throw error;
    }else if(c.table==="pillars"){
      const {data:topics,error:te}=await supabase.from("topics").select("id").in("pillar_id",ids);if(te)throw te;
      const tids=(topics||[]).map(x=>x.id);await deleteChildren({pillarIds:ids,topicIds:tids});
      const {error}=await supabase.from("pillars").delete().in("id",ids);if(error)throw error;
    }else if(c.table==="topics"){
      await deleteChildren({topicIds:ids});
      const {error}=await supabase.from("topics").delete().in("id",ids);if(error)throw error;
    }else{
      const {error}=await supabase.from(c.table).delete().in("id",ids);if(error)throw error;
    }
    await load();notice(`${ids.length} ${c.singular.toLowerCase()}(s) deleted.`);
  }catch(error){notice(error.message||"Could not delete selected records.",true)}
}
async function deleteChildren({nicheIds=[],pillarIds=[],topicIds=[]}){
  if(topicIds.length){let r=await supabase.from("tags").delete().in("topic_id",topicIds);if(r.error)throw r.error;r=await supabase.from("keywords").delete().in("topic_id",topicIds);if(r.error)throw r.error;r=await supabase.from("topics").delete().in("id",topicIds);if(r.error)throw r.error}
  if(pillarIds.length){let r=await supabase.from("tags").delete().in("pillar_id",pillarIds);if(r.error)throw r.error;r=await supabase.from("keywords").delete().in("pillar_id",pillarIds);if(r.error)throw r.error;r=await supabase.from("pillars").delete().in("id",pillarIds);if(r.error)throw r.error}
  if(nicheIds.length){let r=await supabase.from("tags").delete().in("niche_id",nicheIds);if(r.error)throw r.error;r=await supabase.from("keywords").delete().in("niche_id",nicheIds);if(r.error)throw r.error}
}

async function openModal(editId=null){
  const row=editId?cache.find(r=>String(r.id)===String(editId)):null,c=cfg(),modal=document.createElement("div");modal.className="library-edit-overlay";modal.innerHTML=modalHtml(c,row);document.body.appendChild(modal);await bindModal(modal,c,row)
}
function modalHtml(c,row){const v=row||{},label=c.table==="keywords"?"Keyword":c.singular,name=c.table==="keywords"?v.keyword||"":v.name||"",code=v.niche_code||v.pillar_code||v.topic_code||v.keyword_code||"",extra=c.table==="keywords"?field("Category","category",v.category||"")+field("Vietnamese Meaning","meaning",v.vietnamese_meaning||"")+field("Platform","platform",v.platform||""):field("Description","description",v.description||"");return`<div class="library-edit-modal"><div class="modal-header"><div><h3>${row?`Edit ${c.singular}`:`Add ${c.singular}`}</h3><p>${row?"Update this taxonomy record.":"Create a taxonomy record or bulk import many records."}</p></div><button type="button" class="modal-close" data-close>×</button></div><form><div class="edit-grid">${field(label,"name",name,true)}${field("Code","code",code,c.table!=="tags")}${parentFields(c)}${extra}</div><div class="modal-actions"><button type="button" class="button secondary" data-bulk>Bulk Add / Template</button><button type="button" class="button secondary" data-close>Cancel</button><button type="submit" class="button primary">${row?"Save":"Add"}</button></div></form></div>`}
function parentFields(c){let h="";if(["pillars","topics","keywords","tags"].includes(c.table))h+='<label>Niche<select name="niche_id"><option value="">Select niche</option></select></label>';if(["topics","keywords","tags"].includes(c.table))h+='<label>Pillar<select name="pillar_id"><option value="">Select pillar</option></select></label>';if(["keywords","tags"].includes(c.table))h+='<label>Topic<select name="topic_id"><option value="">Select topic</option></select></label>';return h}
function field(label,name,value,required=false){return`<label>${label}<input name="${name}" value="${esc(value)}" ${required?"required":""}></label>`}
async function bindModal(modal,c,row){modal.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>modal.remove());modal.querySelector("[data-bulk]").onclick=()=>{modal.remove();document.dispatchEvent(new CustomEvent("content-os:open-bulk",{detail:{type:c.key}}))};await loadParents(modal,row);modal.querySelector("form").onsubmit=async e=>{e.preventDefault();try{await saveForm(new FormData(e.currentTarget),c,row?.id);modal.remove();await load();notice(`${c.singular} saved.`)}catch(error){notice(error.message||"Could not save.",true)}}}
async function loadParents(modal,row){const niche=modal.querySelector('[name="niche_id"]'),pillar=modal.querySelector('[name="pillar_id"]'),topic=modal.querySelector('[name="topic_id"]');if(niche){const {data,error}=await supabase.from("niches").select("id,name,niche_code").eq("status","active").order("name");if(error)throw error;niche.innerHTML='<option value="">Select niche</option>'+(data||[]).map(x=>`<option value="${esc(x.id)}" ${String(x.id)===String(row?.niche_id)?"selected":""}>${esc(x.name)} (${esc(x.niche_code)})</option>`).join("")}if(pillar){const {data,error}=await supabase.from("pillars").select("id,name,pillar_code,niche_id").order("name");if(error)throw error;pillar.innerHTML='<option value="">Select pillar</option>'+(data||[]).map(x=>`<option value="${esc(x.id)}" ${String(x.id)===String(row?.pillar_id)?"selected":""}>${esc(x.name)} (${esc(x.pillar_code)})</option>`).join("")}if(topic){const {data,error}=await supabase.from("topics").select("id,name,topic_code,pillar_id").order("name");if(error)throw error;topic.innerHTML='<option value="">Select topic</option>'+(data||[]).map(x=>`<option value="${esc(x.id)}" ${String(x.id)===String(row?.topic_id)?"selected":""}>${esc(x.name)} (${esc(x.topic_code)})</option>`).join("")}}
async function saveForm(form,c,id){const v=Object.fromEntries(form.entries()),p={};if(c.table==="niches")Object.assign(p,{name:v.name.trim(),niche_code:v.code.trim()||null,description:v.description?.trim()||null,status:"active"});if(c.table==="pillars")Object.assign(p,{name:v.name.trim(),pillar_code:v.code.trim()||`PIL-${Date.now()}`,niche_id:v.niche_id||null,description:v.description?.trim()||null,status:"active"});if(c.table==="topics")Object.assign(p,{name:v.name.trim(),topic_code:v.code.trim()||`TOP-${Date.now()}`,niche_id:v.niche_id||null,pillar_id:v.pillar_id||null,description:v.description?.trim()||null,status:"active"});if(c.table==="keywords")Object.assign(p,{keyword:v.name.trim(),keyword_code:v.code.trim()||`KW-${Date.now()}`,niche_id:v.niche_id||null,pillar_id:v.pillar_id||null,topic_id:v.topic_id||null,category:v.category?.trim()||null,vietnamese_meaning:v.meaning?.trim()||null,platform:v.platform?.trim()||null,status:"active"});if(c.table==="tags")Object.assign(p,{name:v.name.trim(),slug:slugify(v.name),niche_id:v.niche_id||null,pillar_id:v.pillar_id||null,topic_id:v.topic_id||null,description:v.description?.trim()||null});if(!p.name&&!p.keyword)throw new Error(`${c.singular} name is required.`);if(c.table!=="niches"&&!p.niche_id)throw new Error("Niche is required.");const q=id?supabase.from(c.table).update(p).eq("id",id):supabase.from(c.table).insert(p),{error}=await q;if(error)throw error}
async function deleteRecord(id){const row=cache.find(r=>String(r.id)===String(id));if(!row)return;const label=row.keyword||row.name||row.niche_code||row.pillar_code||row.topic_code||"this record";if(!confirm(`Delete ${label}? This cannot be undone.`))return;try{await deleteChildrenForRecord(cfg().table,row);const {error}=await supabase.from(cfg().table).delete().eq("id",id);if(error)throw error;await load();notice(`${cfg().singular} deleted.`)}catch(error){notice(error.message||"Could not delete.",true)}}
async function deleteChildrenForRecord(table,row){if(table==="niches")await deleteChildren({nicheIds:[row.id]});if(table==="pillars"){const {data}=await supabase.from("topics").select("id").eq("pillar_id",row.id);await deleteChildren({pillarIds:[row.id],topicIds:(data||[]).map(x=>x.id)})}if(table==="topics")await deleteChildren({topicIds:[row.id]})}
async function editInline(cell){const c=cfg(),id=cell.dataset.id,fieldName=cell.dataset.field,row=cache.find(r=>String(r.id)===String(id));if(!row)return;const input=document.createElement(fieldName==="description"?"textarea":"input");input.value=row[fieldName]||"";cell.replaceChildren(input);input.focus();input.select?.();let done=false;const save=async()=>{if(done)return;done=true;const {error}=await supabase.from(c.table).update({[fieldName]:input.value.trim()||null}).eq("id",id);if(error){cell.textContent=row[fieldName]||"—";notice(error.message,true)}else await load()};input.addEventListener("blur",save);input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();input.blur()}if(e.key==="Escape"){done=true;cell.textContent=row[fieldName]||"—"}})}
function slugify(v){return String(v||"").trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
function date(v){if(!v)return"—";return new Date(v).toLocaleDateString()}
function esc(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"}[c]))}
function notice(text,error=false){const n=document.getElementById("taxonomyNotice");if(!n)return;n.textContent=text;n.classList.remove("hidden");n.classList.toggle("error",error);clearTimeout(notice._t);notice._t=setTimeout(()=>n.classList.add("hidden"),3500)}
