const appState = {
    currentNiche: "ALL",
    currentNicheId: null,
    currentPage: "dashboard",
    sidebarOpen: false
};

export function setCurrentNiche(nicheCode, nicheId = null) {
    appState.currentNiche = nicheCode || "ALL";
    appState.currentNicheId = nicheId;
}

export function getCurrentNiche() {
    return appState.currentNiche;
}

export function getCurrentNicheId() {
    return appState.currentNicheId;
}

export { appState };
