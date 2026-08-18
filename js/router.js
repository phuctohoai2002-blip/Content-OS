const routes = {

    dashboard: {
        title: "Dashboard",
        breadcrumb: "Workspace",
        file: "pages/dashboard.html"
    },

    research: {
        title: "Research",
        breadcrumb: "Workspace",
        file: "pages/research.html"
    },

    content: {
        title: "Content",
        breadcrumb: "Workspace",
        file: "pages/content.html"
    },

    calendar: {
        title: "Calendar",
        breadcrumb: "Workspace",
        file: "pages/calendar.html"
    },

    tracking: {
        title: "Video Tracking",
        breadcrumb: "Tracking",
        file: "pages/tracking.html"
    },

    analytics: {
        title: "Analytics",
        breadcrumb: "Tracking",
        file: "pages/analytics.html"
    },

    niches: {
        title: "Niches",
        breadcrumb: "System",
        file: "pages/niches.html"
    },

    settings: {
        title: "Settings",
        breadcrumb: "System",
        file: "pages/settings.html"
    }

};

async function loadPage(pageName) {
    const route = routes[pageName] || routes.dashboard;
    const pageContent = document.getElementById("pageContent");
    const pageTitle = document.getElementById("pageTitle");

    pageTitle.textContent = route.title;

    try {
        const response = await fetch(route.file);

        if (!response.ok) {
            throw new Error("Page not found");
        }

        pageContent.innerHTML = await response.text();

    } catch (error) {
        pageContent.innerHTML = `
            <div class="card">
                <div class="empty-state">
                    <div class="empty-state-icon">⚠</div>
                    <strong>Unable to load page</strong>
                    <p>${error.message}</p>
                </div>
            </div>
        `;
    }

    updateActiveNavigation(pageName);
}

function updateActiveNavigation(pageName) {
    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.remove("active");
    });

    const activeItem = document.querySelector(`.nav-item[href="#${pageName}"]`);

    if (activeItem) {
        activeItem.classList.add("active");
    }
}

function initRouter() {
    const hash = window.location.hash.replace("#", "");
    loadPage(hash || "dashboard");

    window.addEventListener("hashchange", () => {
        const page = window.location.hash.replace("#", "");
        loadPage(page || "dashboard");
    });
}
