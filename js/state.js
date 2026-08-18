const appState = {

    currentNiche: "ALL",

    currentPage: "dashboard",

    sidebarOpen: false

};


function setCurrentNiche(nicheId) {

    appState.currentNiche = nicheId;

}


function getCurrentNiche() {

    return appState.currentNiche;

}