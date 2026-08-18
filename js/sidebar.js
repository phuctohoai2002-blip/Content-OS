(() => {
    const sidebar = document.getElementById('sidebar');
    const resizer = document.getElementById('sidebarResizer');

    if (!sidebar || !resizer) return;

    const MIN_WIDTH = 210;
    const MAX_WIDTH = 360;
    const STORAGE_KEY = 'content-os-sidebar-width';

    const savedWidth = Number(localStorage.getItem(STORAGE_KEY));
    if (savedWidth >= MIN_WIDTH && savedWidth <= MAX_WIDTH) {
        setWidth(savedWidth);
    }

    let isDragging = false;

    function setWidth(width) {
        const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
        document.documentElement.style.setProperty('--sidebar-width', `${clamped}px`);
    }

    resizer.addEventListener('mousedown', (event) => {
        if (window.innerWidth <= 900) return;

        isDragging = true;
        document.body.classList.add('is-resizing');
        event.preventDefault();
    });

    window.addEventListener('mousemove', (event) => {
        if (!isDragging) return;
        setWidth(event.clientX);
    });

    window.addEventListener('mouseup', () => {
        if (!isDragging) return;

        isDragging = false;
        document.body.classList.remove('is-resizing');

        const width = getComputedStyle(document.documentElement)
            .getPropertyValue('--sidebar-width')
            .trim();

        localStorage.setItem(STORAGE_KEY, parseInt(width, 10));
    });
})();
