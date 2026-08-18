const appState = {
    currentNiche: "ALL",
    currentNicheId: null,
    currentPage: "dashboard",
    sidebarOpen: false
};

function setCurrentNiche(nicheCode, nicheId = null) {
    appState.currentNiche = nicheCode || "ALL";
    appState.currentNicheId = nicheId;
}

function getCurrentNiche() {
    return appState.currentNiche;
}

function getCurrentNicheId() {
    return appState.currentNicheId;
}
