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
async function importAll(modal){const rows=modal._rows||[],button=modal.querySelector("[data-import]");if(!rows.length)return;button.disabled=true;try{const s=await importUnified(rows);showMessage(modal,`Synced ${s.total} records: ${s.niches} niches, ${s.pillars} pillars, ${s.topics} topics, ${s.keywords} keywords, ${s.tags} tags.`,false);document.dispatchEvent(new CustomEvent("content-os:data-changed",{detail:{type:"taxonomy"}}));setTimeout(()=>modal.remove(),900)}catch(e){showMessage(modal,e.message||"Import failed.",true);button.disabled=false}}

async function importUnified(rows){
  const clean=rows.filter(r=>TYPES.includes(norm(r.record_type))).map(normalize);
  if(!clean.length)throw new Error("No valid taxonomy rows found.");

  // The CSV is a unified taxonomy file. Existing records are UPDATED, not skipped.
  // Records that do not exist are INSERTED. Matching is done by the stable code.
  // Topic codes are intentionally global (for example GD_FUND, PH_FUND, DR_FUND).
  const stats={total:clean.length,niches:0,pillars:0,topics:0,keywords:0,tags:0};

  const nicheRows=uniqueByCode(clean.filter(r=>r.record_type==="niche"),"niche_code");
  const nicheMap=await syncNiches(nicheRows,stats);

  const pillarRows=uniqueByCode(clean.filter(r=>r.record_type==="pillar"),"pillar_code");
  const pillarMap=await syncPillars(pillarRows,nicheMap,stats);

  const topicRows=uniqueByCode(clean.filter(r=>r.record_type==="topic"),"topic_code");
  const topicMap=await syncTopics(topicRows,nicheMap,pillarMap,stats);

  const keywordRows=uniqueByCode(clean.filter(r=>r.record_type==="keyword"&&r.keyword_code),"keyword_code");
  await syncKeywords(keywordRows,nicheMap,pillarMap,topicMap,stats);

  const tagRows=uniqueTags(clean.filter(r=>r.record_type==="tag"&&r.tag_name));
  await syncTags(tagRows,nicheMap,pillarMap,topicMap,stats);

  return stats;
}

async function syncNiches(rows,stats){
  const {data:existing,error}=await supabase.from("niches").select("id,niche_code,name");
  if(error)throw error;
  const map=new Map();
  (existing||[]).forEach(r=>{if(r.niche_code)map.set(norm(r.niche_code),r);if(r.name)map.set(`name:${norm(r.name)}`,r)});

  for(const r of rows){
    const code=norm(r.niche_code);
    if(!code)throw new Error("Niche row is missing niche_code.");
    const old=map.get(code);
    const payload={name:r.niche_name||r.niche_code,niche_code:r.niche_code,description:r.niche_description||null,status:r.status||"active"};
    let result;
    if(old) result=await supabase.from("niches").update(payload).eq("id",old.id).select("id,niche_code,name").single();
    else result=await supabase.from("niches").insert(payload).select("id,niche_code,name").single();
    if(result.error)throw new Error(`Niches (${r.niche_code}): ${result.error.message}`);
    map.set(code,result.data);
    map.set(`name:${norm(result.data.name)}`,result.data);
    stats.niches++;
  }
  return map;
}

async function syncPillars(rows,nicheMap,stats){
  const {data:existing,error}=await supabase.from("pillars").select("id,pillar_code,niche_id,name");
  if(error)throw error;
  const map=new Map((existing||[]).filter(r=>r.pillar_code).map(r=>[norm(r.pillar_code),r]));

  for(const r of rows){
    const code=norm(r.pillar_code);
    if(!code)throw new Error("Pillar row is missing pillar_code.");
    const niche=findNiche(nicheMap,r);
    if(!niche)throw new Error(`Pillar ${r.pillar_code}: niche ${r.niche_code||r.niche_name||""} was not found.`);
    const payload={name:r.pillar_name||r.pillar_code,pillar_code:r.pillar_code,niche_id:niche.id,description:r.pillar_description||null,status:r.status||"active"};
    const old=map.get(code);
    let result;
    if(old) result=await supabase.from("pillars").update(payload).eq("id",old.id).select("id,pillar_code,niche_id,name").single();
    else result=await supabase.from("pillars").insert(payload).select("id,pillar_code,niche_id,name").single();
    if(result.error)throw new Error(`Pillars (${r.pillar_code}): ${result.error.message}`);
    map.set(code,result.data);
    stats.pillars++;
  }
  return map;
}

async function syncTopics(rows,nicheMap,pillarMap,stats){
  const {data:existing,error}=await supabase.from("topics").select("id,topic_code,pillar_id,niche_id,name");
  if(error)throw error;
  const map=new Map((existing||[]).filter(r=>r.topic_code).map(r=>[norm(r.topic_code),r]));

  for(const r of rows){
    const code=norm(r.topic_code);
    if(!code)throw new Error("Topic row is missing topic_code.");
    const niche=findNiche(nicheMap,r);
    const pillar=findPillar(pillarMap,r);
    if(!niche)throw new Error(`Topic ${r.topic_code}: niche ${r.niche_code||r.niche_name||""} was not found.`);
    if(!pillar)throw new Error(`Topic ${r.topic_code}: pillar ${r.pillar_code||r.pillar_name||""} was not found.`);
    const payload={name:r.topic_name||r.topic_code,topic_code:r.topic_code,niche_id:niche.id,pillar_id:pillar.id,description:r.topic_description||null,status:r.status||"active"};
    const old=map.get(code);
    let result;
    if(old) result=await supabase.from("topics").update(payload).eq("id",old.id).select("id,topic_code,pillar_id,niche_id,name").single();
    else result=await supabase.from("topics").insert(payload).select("id,topic_code,pillar_id,niche_id,name").single();
    if(result.error)throw new Error(`Topics (${r.topic_code}): ${result.error.message}`);
    map.set(code,result.data);
    stats.topics++;
  }
  return map;
}

async function syncKeywords(rows,nicheMap,pillarMap,topicMap,stats){
  if(!rows.length)return;
  const {data:existing,error}=await supabase.from("keywords").select("id,keyword_code");
  if(error)throw error;
  const map=new Map((existing||[]).filter(r=>r.keyword_code).map(r=>[norm(r.keyword_code),r]));

  for(const r of rows){
    const code=norm(r.keyword_code);
    const niche=findNiche(nicheMap,r);
    const pillar=findPillar(pillarMap,r);
    const topic=findTopic(topicMap,r);
    if(!niche)throw new Error(`Keyword ${r.keyword_code}: niche ${r.niche_code||r.niche_name||""} was not found.`);
    if(!pillar)throw new Error(`Keyword ${r.keyword_code}: pillar ${r.pillar_code||r.pillar_name||""} was not found.`);
    if(!topic)throw new Error(`Keyword ${r.keyword_code}: topic ${r.topic_code||""} was not found.`);
    const payload={keyword:r.keyword,keyword_code:r.keyword_code,niche_id:niche.id,pillar_id:pillar.id,topic_id:topic.id,category:r.keyword_category||null,vietnamese_meaning:r.vietnamese_meaning||null,platform:r.keyword_platform||null,status:r.status||"active"};
    const old=map.get(code);
    let result;
    if(old) result=await supabase.from("keywords").update(payload).eq("id",old.id).select("id,keyword_code").single();
    else result=await supabase.from("keywords").insert(payload).select("id,keyword_code").single();
    if(result.error)throw new Error(`Keywords (${r.keyword_code}): ${result.error.message}`);
    map.set(code,result.data);
    stats.keywords++;
  }
}

async function syncTags(rows,nicheMap,pillarMap,topicMap,stats){
  if(!rows.length)return;
  const {data:existing,error}=await supabase.from("tags").select("id,name,slug");
  if(error)throw error;
  const map=new Map();
  (existing||[]).forEach(r=>{if(r.slug)map.set(norm(r.slug),r);if(r.name)map.set(`name:${norm(r.name)}`,r)});

  for(const r of rows){
    const tagSlug=slug(r.tag_name);
    if(!tagSlug)throw new Error("Tag row has an invalid tag_name.");
    const niche=findNiche(nicheMap,r);
    const pillar=findPillar(pillarMap,r);
    const topic=findTopic(topicMap,r);
    const payload={name:r.tag_name,slug:tagSlug,niche_id:niche?.id||null,pillar_id:pillar?.id||null,topic_id:topic?.id||null,description:r.tag_description||null};
    const old=map.get(tagSlug)||map.get(`name:${norm(r.tag_name)}`);
    let result;
    if(old) result=await supabase.from("tags").update(payload).eq("id",old.id).select("id,name,slug").single();
    else result=await supabase.from("tags").insert(payload).select("id,name,slug").single();
    if(result.error)throw new Error(`Tags (${r.tag_name}): ${result.error.message}`);
    map.set(tagSlug,result.data);
    map.set(`name:${norm(r.tag_name)}`,result.data);
    stats.tags++;
  }
}

function uniqueByCode(rows,field){
  const seen=new Set();
  return rows.filter(r=>{const key=norm(r[field]);if(!key||seen.has(key))return false;seen.add(key);return true;});
}
function uniqueTags(rows){
  const seen=new Set();
  return rows.filter(r=>{const key=slug(r.tag_name);if(!key||seen.has(key))return false;seen.add(key);return true;});
}
function findNiche(map,r){return map.get(norm(r.niche_code))||map.get(`name:${norm(r.niche_name)}`)||null}
function findPillar(map,r){return map.get(norm(r.pillar_code))||null}
function findTopic(map,r){return map.get(norm(r.topic_code))||null}

function downloadTemplate(){const sample=[["niche","DIG","Digital Design","Design and creative tools","","","","","","","","","","","","","","active"],["pillar","DIG","","","PS","Photoshop","Photoshop workflow","","","","","","","","","","","active"],["topic","DIG","","","PS","","","MASK","Layer Masks","Masking techniques","","","","","","","","active"],["keyword","DIG","","","PS","","","MASK","","","KW001","layer mask","Tutorial","mat thuop lop","Douyin","","","active"],["tag","DIG","","","PS","","","MASK","","","","","","","","Tutorial","Beginner tutorial","active"]];const csv=[COLUMNS.join(","),...sample.map(r=>r.map(csvCell).join(","))].join("\n")+"\n";download(csv,"taxonomy-all-template.csv")}
function parseCsv(text){const lines=[];let row=[],cell="",quoted=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'){if(quoted&&n==='"'){cell+='"';i++}else quoted=!quoted}else if(c===","&&!quoted){row.push(cell);cell=""}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))lines.push(row);row=[];cell=""}else cell+=c}row.push(cell);if(row.some(v=>v.trim()))lines.push(row);const headers=(lines.shift()||[]).map(v=>v.trim());return lines.map(values=>Object.fromEntries(headers.map((h,i)=>[h,(values[i]||"").trim()])))}
function normalize(row){const out={};COLUMNS.forEach(k=>out[k]=row[k]||"");out.record_type=norm(out.record_type);return out}
function norm(v){return String(v||"").trim().toLowerCase()}
function slug(v){return norm(v).replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
function csvCell(v){const s=String(v??"");return /[",\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
function download(text,name){const a=document.createElement("a");const url=URL.createObjectURL(new Blob(["\ufeff",text],{type:"text/csv;charset=utf-8"}));a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)}
function showMessage(modal,text,error){const box=modal.querySelector("[data-message]");box.textContent=text;box.classList.toggle("error",!!error);box.classList.remove("hidden")}
