import dashboardHtml from "../pages/dashboard.html?raw";
import libraryHtml from "../pages/library.html?raw";
import calendarHtml from "../pages/calendar.html?raw";
import trackingHtml from "../pages/tracking.html?raw";
import analyticsHtml from "../pages/analytics.html?raw";
import taxonomyHtml from "../pages/niches.html?raw";
import settingsHtml from "../pages/settings.html?raw";

import { initLibrary } from "./library.js";
import { initCalendarWorkspace } from "./calendar.js";
import { initTrackingWorkspace } from "./tracking.js";
import { initAnalyticsWorkspace } from "./workspace.js";
import { initTaxonomy } from "./taxonomy-v2.js";

const routes={
    dashboard:{title:"Overview",breadcrumb:"Workspace",html:dashboardHtml},
    library:{title:"Library",breadcrumb:"Library",html:libraryHtml},
    calendar:{title:"Calendar",breadcrumb:"Calendar",html:calendarHtml},
    tracking:{title:"Published Videos",breadcrumb:"Tracking",html:trackingHtml},
    analytics:{title:"Performance",breadcrumb:"Tracking",html:analyticsHtml},
    taxonomy:{title:"Taxonomy",breadcrumb:"System",html:taxonomyHtml},
    niches:{title:"Taxonomy",breadcrumb:"System",html:taxonomyHtml},
    settings:{title:"Settings",breadcrumb:"System",html:settingsHtml}
};

const contextMenus={
    dashboard:{label:"OVERVIEW",items:[{label:"Workspace",href:"#dashboard",icon:"⌂"},{label:"Library",href:"#library",icon:"□"}]},
    library:{label:"LIBRARY",items:[{label:"Creators",view:"creators",icon:"◎"},{label:"Videos",view:"videos",icon:"▶"},{label:"Content",view:"content",icon:"✦"},{label:"Products",view:"products",icon:"◇"}]},
    calendar:{label:"CALENDAR",items:[{label:"Schedule",view:"schedule",icon:"□"},{label:"Upcoming",view:"upcoming",icon:"◷"}]},
    tracking:{label:"TRACKING",items:[{label:"Published Videos",href:"#tracking",icon:"↗"},{label:"Performance",href:"#analytics",icon:"◒"}]},
    analytics:{label:"TRACKING",items:[{label:"Published Videos",href:"#tracking",icon:"↗"},{label:"Performance",href:"#analytics",icon:"◒"}]},
    taxonomy:{label:"TAXONOMY",items:[{label:"Niches",view:"niches",icon:"◈"},{label:"Pillars",view:"pillars",icon:"◉"},{label:"Topics",view:"topics",icon:"◇"},{label:"Keywords",view:"keywords",icon:"⌕"},{label:"Tags",view:"tags",icon:"#"}]},
    niches:{label:"TAXONOMY",items:[{label:"Niches",view:"niches",icon:"◈"},{label:"Pillars",view:"pillars",icon:"◉"},{label:"Topics",view:"topics",icon:"◇"},{label:"Keywords",view:"keywords",icon:"⌕"},{label:"Tags",view:"tags",icon:"#"}]},
    settings:{label:"SYSTEM",items:[{label:"Settings",href:"#settings",icon:"⚙"},{label:"Taxonomy",href:"#taxonomy",icon:"◈"}]}
};

function loadPage(pageName){
    const route=routes[pageName]||routes.dashboard;
    const pageContent=document.getElementById("pageContent"),pageTitle=document.getElementById("pageTitle"),breadcrumb=document.getElementById("pageBreadcrumb");
    if(pageTitle)pageTitle.textContent=route.title;
    if(breadcrumb)breadcrumb.textContent=route.breadcrumb;
    renderContextNavigation(pageName);
    try {
        pageContent.innerHTML=route.html;
        if(pageName==="dashboard") window.initDashboardWorkspace?.();
        if(pageName==="library") initLibrary().catch(e=>console.error("Library module failed:",e));
        if(pageName==="calendar") initCalendarWorkspace().catch(e=>console.error("Calendar module failed:",e));
        if(pageName==="tracking") initTrackingWorkspace().catch(e=>console.error("Tracking module failed:",e));
        if(pageName==="analytics") initAnalyticsWorkspace();
        if(pageName==="taxonomy"||pageName==="niches") initTaxonomy().catch(e=>console.error("Taxonomy module failed:",e));
    } catch(error) {
        pageContent.innerHTML=`<div class="card"><div class="empty-state"><div class="empty-state-icon">⚠</div><strong>Unable to load page</strong><p>${error.message}</p></div></div>`;
    }
    updateActiveNavigation(pageName);
}

function renderContextNavigation(pageName){
    const nav=document.getElementById("contextNav");if(!nav)return;
    const config=contextMenus[pageName]||contextMenus.dashboard;
    nav.innerHTML=`<div class="nav-section"><span class="nav-label">${config.label}</span>${config.items.map((item,i)=>item.view?`<button type="button" class="nav-item ${i===0?'active':''}" data-context-view="${item.view}"><span class="nav-icon">${item.icon}</span><span>${item.label}</span></button>`:`<a href="${item.href}" class="nav-item"><span class="nav-icon">${item.icon}</span><span>${item.label}</span></a>`).join("")}</div><div class="nav-section"><span class="nav-label">FILTER</span><div class="context-filter-list"><button type="button">Platform <span>⌄</span></button><button type="button">Status <span>⌄</span></button><button type="button">Niche <span>⌄</span></button></div></div>`;
    nav.querySelectorAll("[data-context-view]").forEach(b=>b.addEventListener("click",()=>{
        nav.querySelectorAll("[data-context-view]").forEach(x=>x.classList.toggle("active",x===b));
        const view=b.dataset.contextView;
        if(pageName==="library")document.dispatchEvent(new CustomEvent("content-os:library-view",{detail:view}));
        else if(pageName==="taxonomy"||pageName==="niches")document.dispatchEvent(new CustomEvent("content-os:taxonomy-view",{detail:view}));
        else if(pageName==="calendar")document.dispatchEvent(new CustomEvent("content-os:calendar-view",{detail:view}));
    }));
}

function updateActiveNavigation(pageName){document.querySelectorAll(".global-nav-item").forEach(item=>item.classList.toggle("active",item.getAttribute("href")==="#"+pageName||pageName==="analytics"&&item.getAttribute("href")==="#tracking"));}

export function initRouter(){const hash=window.location.hash.replace("#","");loadPage(hash||"dashboard");window.addEventListener("hashchange",()=>loadPage(window.location.hash.replace("#","")||"dashboard"));}
