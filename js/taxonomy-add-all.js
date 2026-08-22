import { supabase } from "./supabase.js";

const COLUMNS=["record_type","niche_code","niche_name","niche_description","pillar_code","pillar_name","pillar_description","topic_code","topic_name","topic_description","keyword_code","keyword","keyword_category","vietnamese_meaning","keyword_platform","tag_name","tag_description","status"];
const TYPES=["niche","pillar","topic","keyword","tag"];
let initialized=false;

export function initTaxonomyAddAll(){
  if(initialized)return; initialized=true;
  document.addEventListener("click",e=>{if(e.target.closest("#taxonomyAddAllButton"))open();});
}
function open(){
  document.getElementById("taxonomyAddAllModal")?.remove();
  const modal=document.createElement("div"); modal.id="taxonomyAddAllModal"; modal.className="library-edit-overlay";
  modal.innerHTML=`<div class="library-edit-modal taxonomy-add-all-modal"><div class="modal-header"><div><h3>Add All Taxonomy</h3><p>Add Niche, Pillar, Topic, Keyword and Tag records in one CSV import.</p></div><button class="modal-close" data-close>×</button></div><div class="taxonomy-unified-actions"><button type="button" class="button secondary" data-template>Download CSV template</button><label class="button secondary">Choose CSV<input type="file" accept=".csv,text/csv" data-file hidden></label><span class="taxonomy-unified-file" data-file-name>No file selected</span><span class="taxonomy-unified-count" data-row-count></span></div><div class="add-form-message hidden" data-message></div><div class="modal-actions"><button type="button" class="button secondary" data-close>Cancel</button><button type="button" class="button primary" data-import disabled>Import All</button></div></div>`;
  document.body.appendChild(modal);
  modal.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>modal.remove());
  modal.querySelector("[data-template]").onclick=downloadTemplate;
  modal.querySelector("[data-file]").onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const rows=parseCsv(await file.text());const invalid=rows.filter(r=>!TYPES.includes(norm(r.record_type)));if(invalid.length)throw new Error(`Invalid record_type. Allowed: ${TYPES.join(", ")}.`);modal._rows=rows;modal.querySelector("[data-file-name]").textContent=file.name;modal.querySelector("[data-row-count]").textContent=`${rows.length} rows ready`;modal.querySelector("[data-import]").disabled=!rows.length;showMessage(modal,`${rows.length} row(s) ready to import.`,false)}catch(err){modal._rows=[];modal.querySelector("[data-import]").disabled=true;showMessage(modal,err.message||"Could not read CSV.",true)}};
  modal.querySelector("[data-import]").onclick=()=>importAll(modal);
}
async function importAll(modal){const rows=modal._rows||[],button=modal.querySelector("[data-import]");if(!rows.length)return;button.disabled=true;try{const s=await importUnified(rows);showMessage(modal,`Imported ${s.total} records: ${s.niches} niches, ${s.pillars} pillars, ${s.topics} topics, ${s.keywords} keywords, ${s.tags} tags.`,false);document.dispatchEvent(new CustomEvent("content-os:data-changed",{detail:{type:"taxonomy"}}));setTimeout(()=>modal.remove(),900)}catch(e){showMessage(modal,e.message||"Import failed.",true);button.disabled=false}}
async function importUnified(rows){
  const clean=rows.filter(r=>TYPES.includes(norm(r.record_type))).map(normalize);
  const {data:niches,error:ne}=await supabase.from("niches").select("id,niche_code");if(ne)throw ne;
  const nicheMap=new Map((niches||[]).map(r=>[norm(r.niche_code),r.id]));
  const newNiches=clean.filter(r=>r.record_type==="niche").map(r=>({name:r.niche_name||r.niche_code,niche_code:r.niche_code||null,description:r.niche_description||null,status:r.status||"active"}));
  if(newNiches.length){const {data,error}=await supabase.from("niches").insert(newNiches).select("id,niche_code");if(error)throw new Error(`Niches: ${error.message}`);(data||[]).forEach(r=>nicheMap.set(norm(r.niche_code),r.id))}
  const {data:pillars,error:pe}=await supabase.from("pillars").select("id,pillar_code");if(pe)throw pe;const pillarMap=new Map((pillars||[]).map(r=>[norm(r.pillar_code),r.id]));
  const newPillars=clean.filter(r=>r.record_type==="pillar").map(r=>({name:r.pillar_name||r.pillar_code,pillar_code:r.pillar_code||null,niche_id:nicheMap.get(norm(r.niche_code))||null,description:r.pillar_description||null,status:r.status||"active"}));
  if(newPillars.length){const {data,error}=await supabase.from("pillars").insert(newPillars).select("id,pillar_code");if(error)throw new Error(`Pillars: ${error.message}`);(data||[]).forEach(r=>pillarMap.set(norm(r.pillar_code),r.id))}
  const {data:topics,error:te}=await supabase.from("topics").select("id,topic_code");if(te)throw te;const topicMap=new Map((topics||[]).map(r=>[norm(r.topic_code),r.id]));
  const newTopics=clean.filter(r=>r.record_type==="topic").map(r=>({name:r.topic_name||r.topic_code,topic_code:r.topic_code||null,niche_id:nicheMap.get(norm(r.niche_code))||null,pillar_id:pillarMap.get(norm(r.pillar_code))||null,description:r.topic_description||null,status:r.status||"active"}));
  if(newTopics.length){const {data,error}=await supabase.from("topics").insert(newTopics).select("id,topic_code");if(error)throw new Error(`Topics: ${error.message}`);(data||[]).forEach(r=>topicMap.set(norm(r.topic_code),r.id))}
  const keywordRows=clean.filter(r=>r.record_type==="keyword"&&r.keyword).map(r=>({keyword:r.keyword,keyword_code:r.keyword_code||null,niche_id:nicheMap.get(norm(r.niche_code))||null,pillar_id:pillarMap.get(norm(r.pillar_code))||null,topic_id:topicMap.get(norm(r.topic_code))||null,category:r.keyword_category||null,vietnamese_meaning:r.vietnamese_meaning||null,platform:r.keyword_platform||null,status:r.status||"active"}));
  if(keywordRows.length){const {error}=await supabase.from("keywords").insert(keywordRows);if(error)throw new Error(`Keywords: ${error.message}`)}
  const tagRows=clean.filter(r=>r.record_type==="tag"&&r.tag_name).map(r=>({name:r.tag_name,slug:slug(r.tag_name),niche_id:nicheMap.get(norm(r.niche_code))||null,pillar_id:pillarMap.get(norm(r.pillar_code))||null,topic_id:topicMap.get(norm(r.topic_code))||null,description:r.tag_description||null}));
  if(tagRows.length){const {error}=await supabase.from("tags").insert(tagRows);if(error)throw new Error(`Tags: ${error.message}`)}
  return {total:clean.length,niches:newNiches.length,pillars:newPillars.length,topics:newTopics.length,keywords:keywordRows.length,tags:tagRows.length};
}
function downloadTemplate(){const sample=[["niche","DIG","Digital Design","Design and creative tools","","","","","","","","","","","","","","active"],["pillar","DIG","","","PS","Photoshop","Photoshop workflow","","","","","","","","","","","active"],["topic","DIG","","","PS","","","MASK","Layer Masks","Masking techniques","","","","","","","","active"],["keyword","DIG","","","PS","","","MASK","","","KW001","layer mask","Tutorial","mat thuop lop","Douyin","","","active"],["tag","DIG","","","PS","","","MASK","","","","","","","","Tutorial","Beginner tutorial","active"]];const csv=[COLUMNS.join(","),...sample.map(r=>r.map(csvCell).join(","))].join("\n")+"\n";download(csv,"taxonomy-all-template.csv")}
function parseCsv(text){const lines=[];let row=[],cell="",quoted=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'){if(quoted&&n==='"'){cell+='"';i++}else quoted=!quoted}else if(c===","&&!quoted){row.push(cell);cell=""}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))lines.push(row);row=[];cell=""}else cell+=c}row.push(cell);if(row.some(v=>v.trim()))lines.push(row);const headers=(lines.shift()||[]).map(v=>v.trim());return lines.map(values=>Object.fromEntries(headers.map((h,i)=>[h,(values[i]||"").trim()])))}
function normalize(row){const out={};COLUMNS.forEach(k=>out[k]=row[k]||"");out.record_type=norm(out.record_type);return out}
function norm(v){return String(v||"").trim().toLowerCase()}function slug(v){return norm(v).replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}function csvCell(v){const s=String(v??"");return /[",\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}function download(text,name){const a=document.createElement("a");const url=URL.createObjectURL(new Blob(["\ufeff",text],{type:"text/csv;charset=utf-8"}));a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)}function showMessage(modal,text,error){const box=modal.querySelector("[data-message]");box.textContent=text;box.classList.toggle("error",!!error);box.classList.remove("hidden")}
