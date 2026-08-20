import { supabase } from "./supabase.js";

const PAGE_SIZE = 5;
const VIDEO_STATUSES = ["recorded","downloaded","editing","edited","ready","scheduled","published","skipped"];
const STATUS_LABELS = { recorded:"Recorded", downloaded:"Downloaded", editing:"Editing", edited:"Edited", ready:"Ready", scheduled:"Scheduled", published:"Published", skipped:"Skipped" };

export async function initLibrary(){
  const root=document.getElementById("libraryWorkspace");
  const view=document.getElementById("libraryView");
  if(!root||!view)return;
  let activeView="creators";
  let pages={creators:1,videos:1,content:1};
  let cache={creators:null,videos:null,content:null};

  root.querySelectorAll("[data-library-view]").forEach(button=>button.addEventListener("click",()=>{
    activeView=button.dataset.libraryView;
    root.querySelectorAll("[data-library-view]").forEach(b=>b.classList.toggle("active",b===button));
    render();
  }));

  async function load(viewName){
    if(cache[viewName])return cache[viewName];
    if(viewName==="creators"){
      const {data,error}=await supabase.from("creators").select("id,creator_code,creator_name,handle,platform,niche_id,profile_url,download_path,status,created_at,niches(name,niche_code)").order("created_at",{ascending:false});
      if(error)throw error; cache.creators=data||[];
    }else{
      const query=supabase.from("videos").select("id,video_id,platform_url,title,caption,hook,status,published_at,views,likes,comments,shares,saves,created_at,creator_id,niche_id,pillar_id,topic_id,creators(creator_name,handle,creator_code),niches(name,niche_code),pillars(name,pillar_code),topics(name,topic_code)").order("created_at",{ascending:false});
      const {data,error}=await query; if(error)throw error;
      const videos=data||[];
      cache.videos=videos;
      cache.content=videos.filter(v=>["editing","edited"].includes(v.status));
    }
    return cache[viewName];
  }

  function render(){
    view.innerHTML='<div class="card"><div class="empty-state"><div class="empty-state-icon">◌</div><strong>Loading library...</strong></div></div>';
    load(activeView).then(rows=>renderView(rows)).catch(error=>{
      view.innerHTML=`<div class="card"><div class="empty-state"><div class="empty-state-icon">⚠</div><strong>Could not load ${activeView}</strong><p>${escapeHtml(error.message||"Supabase request failed.")}</p></div></div>`;
    });
  }

  function renderView(rows){
    const query=`<div class="library-toolbar"><input id="librarySearch" type="search" placeholder="Search ${activeView}..." aria-label="Search ${activeView}"><span class="library-count">${rows.length} records</span></div>`;
    const table=activeView==="creators"?creatorTable(rows):activeView==="videos"?videoTable(rows):contentTable(rows);
    view.innerHTML=`<div class="card">${query}${table}</div>`;
    const search=view.querySelector("#librarySearch");
    search.addEventListener("input",()=>filterRows(rows,search.value));
    filterRows(rows,search.value);
  }

  function filterRows(rows,term){
    const normalized=term.trim().toLowerCase();
    const filtered=!normalized?rows:rows.filter(row=>JSON.stringify(row).toLowerCase().includes(normalized));
    pages[activeView]=Math.min(pages[activeView],Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)));
    const start=(pages[activeView]-1)*PAGE_SIZE;
    const pageRows=filtered.slice(start,start+PAGE_SIZE);
    const body=view.querySelector("tbody");
    if(body)body.innerHTML=activeView==="creators"?creatorRows(pageRows):activeView==="videos"?videoRows(pageRows):contentRows(pageRows);
    renderPagination(filtered.length);
  }

  function creatorTable(rows){return `<div class="table-wrapper"><table class="data-table library-table"><thead><tr><th>Creator</th><th>Handle</th><th>Platform</th><th>Niche</th><th>Download Path</th><th>Status</th></tr></thead><tbody>${creatorRows(rows.slice(0,PAGE_SIZE))}</tbody></table></div><div id="libraryPagination" class="library-pagination"></div>`;}
  function creatorRows(rows){return rows.map(r=>`<tr><td><div class="source-title">${escapeHtml(r.creator_name||"—")}</div><div class="source-subtitle">${escapeHtml(r.creator_code||"")}</div></td><td>${escapeHtml(r.handle||"—")}</td><td>${escapeHtml(r.platform||"—")}</td><td><span class="badge">${escapeHtml(r.niches?.name||"—")}</span></td><td class="path-cell" title="${escapeHtml(r.download_path||"")}">${escapeHtml(r.download_path||"—")}</td><td>${statusPill(r.status)}</td></tr>`).join("")||emptyRow(6,"No creators yet.");}

  function videoTable(rows){return `<div class="table-wrapper"><table class="data-table library-table"><thead><tr><th>Video</th><th>Creator</th><th>Niche</th><th>Pillar / Topic</th><th>Platform</th><th>Status</th></tr></thead><tbody>${videoRows(rows.slice(0,PAGE_SIZE))}</tbody></table></div><div id="libraryPagination" class="library-pagination"></div>`;}
  function videoRows(rows){return rows.map(r=>`<tr><td><div class="source-title">${escapeHtml(r.title||r.video_id||"Untitled video")}</div><div class="source-subtitle">${escapeHtml(r.video_id||"")} ${r.platform_url?`· <a href="${escapeHtml(r.platform_url)}" target="_blank" rel="noreferrer">Open</a>`:""}</div></td><td><div class="source-title">${escapeHtml(r.creators?.creator_name||"—")}</div><div class="source-subtitle">${escapeHtml(r.creators?.handle||"")}</div></td><td>${escapeHtml(r.niches?.name||"—")}</td><td><div class="source-title">${escapeHtml(r.pillars?.name||"—")}</div><div class="source-subtitle">${escapeHtml(r.topics?.name||"")}</div></td><td>${escapeHtml(r.platform_url?.includes("douyin.com")?"Douyin":"—")}</td><td>${statusPill(r.status)}</td></tr>`).join("")||emptyRow(6,"No videos yet.");}

  function contentTable(rows){return `<div class="table-wrapper"><table class="data-table library-table"><thead><tr><th>Video</th><th>Creator</th><th>Status</th><th>Title</th><th>Hook</th><th>Caption</th></tr></thead><tbody>${contentRows(rows.slice(0,PAGE_SIZE))}</tbody></table></div><div id="libraryPagination" class="library-pagination"></div>`;}
  function contentRows(rows){return rows.map(r=>`<tr><td><div class="source-title">${escapeHtml(r.video_id||r.title||"Untitled video")}</div><div class="source-subtitle">${escapeHtml(r.platform_url||"")}</div></td><td>${escapeHtml(r.creators?.creator_name||r.creators?.handle||"—")}</td><td>${statusPill(r.status)}</td><td>${fieldPreview(r.title)}</td><td>${fieldPreview(r.hook)}</td><td>${fieldPreview(r.caption)}</td></tr>`).join("")||emptyRow(6,"No editing/edited videos yet.");}
  function fieldPreview(value){return value?`<span class="content-preview">${escapeHtml(value)}</span>`:'<span class="field-missing">Not added</span>';}
  function emptyRow(span,text){return `<tr><td colspan="${span}"><div class="empty-state compact"><strong>${text}</strong></div></td></tr>`;}
  function statusPill(status){return `<span class="status-badge status-${escapeHtml(status||"")}">${escapeHtml(STATUS_LABELS[status]||status||"—")}</span>`;}
  function renderPagination(total){
    const box=view.querySelector("#libraryPagination"); if(!box)return;
    const totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE));
    if(totalPages<=1){box.innerHTML="";return;}
    const current=pages[activeView];
    box.innerHTML=`<button class="pagination-button" data-page="prev" ${current===1?"disabled":""}>‹</button>${Array.from({length:totalPages},(_,i)=>`<button class="pagination-button ${i+1===current?"active":""}" data-page="${i+1}">${i+1}</button>`).join("")}<button class="pagination-button" data-page="next" ${current===totalPages?"disabled":""}>›</button>`;
    box.querySelectorAll("[data-page]").forEach(button=>button.addEventListener("click",()=>{const target=button.dataset.page;pages[activeView]=target==="prev"?current-1:target==="next"?current+1:Number(target);const search=view.querySelector("#librarySearch");filterRows(activeView==="creators"?cache.creators:activeView==="videos"?cache.videos:cache.content,search?.value||"");}));
  }
  function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;","\"":"&quot;"}[c]));}
  render();
}
