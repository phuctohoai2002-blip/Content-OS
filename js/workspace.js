const STATUS_LABELS = { download:"Download", editing:"Editing", ready:"Ready", scheduled:"Scheduled", published:"Published" };

function statusBadge(status){return `<span class="status-badge status-${status}">${STATUS_LABELS[status]||status}</span>`;}
function formatNumber(value){return new Intl.NumberFormat("en-US").format(value||0);}

function initContentWorkspace(){
    const root=document.getElementById("contentWorkspace");
    if(!root)return;
    let currentFilter="all";
    const render=()=>{
        const videos=mockData.videos.filter(v=>currentFilter==="all"||v.status===currentFilter);
        const counts=Object.keys(STATUS_LABELS).reduce((a,s)=>(a[s]=mockData.videos.filter(v=>v.status===s).length,a),{});
        root.innerHTML=`
            <div class="stat-grid pipeline-stats">
                <div class="stat-card"><div class="stat-label">DOWNLOAD</div><div class="stat-value">${counts.download}</div><div class="stat-meta">Waiting for edit</div></div>
                <div class="stat-card"><div class="stat-label">EDITING</div><div class="stat-value">${counts.editing}</div><div class="stat-meta">In production</div></div>
                <div class="stat-card"><div class="stat-label">READY</div><div class="stat-value">${counts.ready}</div><div class="stat-meta">Ready to schedule</div></div>
                <div class="stat-card"><div class="stat-label">SCHEDULED</div><div class="stat-value">${counts.scheduled}</div><div class="stat-meta">On calendar</div></div>
                <div class="stat-card"><div class="stat-label">PUBLISHED</div><div class="stat-value">${counts.published}</div><div class="stat-meta">In tracking</div></div>
            </div>
            <div class="card">
                <div class="card-header"><div><h3>Video Library</h3><span class="card-header-note">Workflow: Download → Editing → Caption / Title / Hook → Ready → Scheduled → Published</span></div><select id="videoStatusFilter" class="workspace-select"><option value="all">All statuses</option>${Object.entries(STATUS_LABELS).map(([k,v])=>`<option value="${k}" ${currentFilter===k?'selected':''}>${v}</option>`).join("")}</select></div>
                <div class="table-wrapper"><table class="data-table video-table"><thead><tr><th>Video</th><th>Niche</th><th>Pillar / Topic</th><th>Platform</th><th>Status</th><th>Performance</th></tr></thead><tbody>${videos.map(v=>`<tr data-video-id="${v.id}"><td><div class="source-title">${v.title}</div><div class="source-subtitle">${v.id} · ${v.creator}</div></td><td><span class="badge">${v.niche}</span></td><td><div class="source-title">${v.pillar}</div><div class="source-subtitle">${v.topic}</div></td><td>${v.platform}</td><td>${statusBadge(v.status)}</td><td>${v.status==='published'?`${formatNumber(v.views)} views`:'—'}</td></tr>`).join("")||`<tr><td colspan="6"><div class="empty-state">No videos in this status.</div></td></tr>`}</tbody></table></div>
            </div>
            <div id="videoEditor" class="card video-editor hidden"></div>`;
        document.getElementById("videoStatusFilter").addEventListener("change",e=>{currentFilter=e.target.value;render();});
        root.querySelectorAll("tr[data-video-id]").forEach(row=>row.addEventListener("click",()=>openVideoEditor(row.dataset.videoId)));
    };
    render();

    function openVideoEditor(id){
        const v=mockData.videos.find(item=>item.id===id); const editor=document.getElementById("videoEditor"); if(!v||!editor)return;
        editor.classList.remove("hidden");
        editor.innerHTML=`<div class="card-header"><div><h3>Edit Video</h3><span class="card-header-note">Mock mode — later these fields will read/write Supabase videos.</span></div><button class="icon-button" id="closeVideoEditor">×</button></div><div class="card-body"><div class="editor-grid"><label>Title<input id="editTitle" value="${escapeHtml(v.title)}"></label><label>Status<select id="editStatus">${Object.entries(STATUS_LABELS).map(([k,label])=>`<option value="${k}" ${v.status===k?'selected':''}>${label}</option>`).join("")}</select></label><label class="full-width">Hook<textarea id="editHook">${escapeHtml(v.hook)}</textarea></label><label class="full-width">Caption<textarea id="editCaption">${escapeHtml(v.caption)}</textarea></label></div><div class="editor-meta"><span>${v.niche} · ${v.pillar} · ${v.topic}</span><span>${v.platform}</span></div><button class="capture-button" id="saveVideoMock">Save changes</button></div>`;
        document.getElementById("closeVideoEditor").addEventListener("click",()=>editor.classList.add("hidden"));
        document.getElementById("saveVideoMock").addEventListener("click",()=>{v.title=document.getElementById("editTitle").value;v.hook=document.getElementById("editHook").value;v.caption=document.getElementById("editCaption").value;v.status=document.getElementById("editStatus").value;render();});
        editor.scrollIntoView({behavior:"smooth",block:"start"});
    }
}

function initTrackingWorkspace(){
    const root=document.getElementById("trackingWorkspace"); if(!root)return;
    const published=mockData.videos.filter(v=>v.status==="published");
    const totalViews=published.reduce((s,v)=>s+v.views,0), totalLikes=published.reduce((s,v)=>s+v.likes,0), totalSaves=published.reduce((s,v)=>s+v.saves,0), totalFollowers=published.reduce((s,v)=>s+v.followers,0);
    root.innerHTML=`<div class="stat-grid"><div class="stat-card"><div class="stat-label">PUBLISHED VIDEOS</div><div class="stat-value">${published.length}</div></div><div class="stat-card"><div class="stat-label">TOTAL VIEWS</div><div class="stat-value">${formatNumber(totalViews)}</div></div><div class="stat-card"><div class="stat-label">LIKES</div><div class="stat-value">${formatNumber(totalLikes)}</div></div><div class="stat-card"><div class="stat-label">SAVES</div><div class="stat-value">${formatNumber(totalSaves)}</div></div><div class="stat-card"><div class="stat-label">FOLLOWERS GAINED</div><div class="stat-value">${formatNumber(totalFollowers)}</div></div></div><div class="card"><div class="card-header"><div><h3>Published Videos</h3><span class="card-header-note">Update performance metrics here after publishing.</span></div></div><div class="table-wrapper"><table class="data-table"><thead><tr><th>Video</th><th>Published</th><th>Views</th><th>Likes</th><th>Comments</th><th>Shares</th><th>Saves</th><th>Followers</th></tr></thead><tbody>${published.map(v=>`<tr><td><div class="source-title">${v.title}</div><div class="source-subtitle">${v.pillar} · ${v.topic}</div></td><td>${v.publishedAt}</td><td>${formatNumber(v.views)}</td><td>${formatNumber(v.likes)}</td><td>${formatNumber(v.comments)}</td><td>${formatNumber(v.shares)}</td><td>${formatNumber(v.saves)}</td><td>${formatNumber(v.followers)}</td></tr>`).join("")}</tbody></table></div></div>`;
}

function initAnalyticsWorkspace(){
    const root=document.getElementById("analyticsWorkspace"); if(!root)return;
    const published=mockData.videos.filter(v=>v.status==="published");
    const groups={}; published.forEach(v=>{groups[v.pillar]??={videos:0,views:0,likes:0,saves:0,followers:0};groups[v.pillar].videos++;groups[v.pillar].views+=v.views;groups[v.pillar].likes+=v.likes;groups[v.pillar].saves+=v.saves;groups[v.pillar].followers+=v.followers;});
    const rows=Object.entries(groups).sort((a,b)=>b[1].views-a[1].views).map(([name,g])=>`<tr><td><div class="source-title">${name}</div></td><td>${g.videos}</td><td>${formatNumber(g.views)}</td><td>${formatNumber(g.likes)}</td><td>${formatNumber(g.saves)}</td><td>${formatNumber(g.followers)}</td><td>${g.views?((g.likes/g.views)*100).toFixed(2):'0.00'}%</td></tr>`).join("");
    root.innerHTML=`<div class="card"><div class="card-header"><div><h3>Pillar Performance</h3><span class="card-header-note">Compare published video results by content pillar.</span></div></div><div class="table-wrapper"><table class="data-table"><thead><tr><th>Pillar</th><th>Videos</th><th>Views</th><th>Likes</th><th>Saves</th><th>Followers</th><th>Like Rate</th></tr></thead><tbody>${rows||'<tr><td colspan="7"><div class="empty-state">No published data yet.</div></td></tr>'}</tbody></table></div></div><div class="card analytics-note"><div class="card-body"><strong>How this maps to Supabase</strong><p>videos stores raw performance. topic_performance and pillar_performance views aggregate those metrics so the Analytics module can compare topics and pillars.</p></div></div>`;
}

function escapeHtml(value){return String(value).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c]));}
