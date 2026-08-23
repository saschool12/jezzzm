document.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.getElementById("sidebar");
    const mobileMenu = document.getElementById("mobileMenu");
    const main = document.querySelector(".main");

    if (!sidebar || !mobileMenu || !main) return;

    const isMobile = () => window.innerWidth <= 700;

    function closeSidebar() {
        if (!isMobile()) return;

        sidebar.classList.remove("open");
        mobileMenu.textContent = "☰";
    }

    mobileMenu.addEventListener("click", (event) => {
        event.stopPropagation();

        if (!isMobile()) return;

        const isOpen = sidebar.classList.toggle("open");

        mobileMenu.textContent = isOpen ? "×" : "☰";
    });

    main.addEventListener("click", () => {
        closeSidebar();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeSidebar();
        }
    });

    window.addEventListener("resize", () => {
        if (!isMobile()) {
            sidebar.classList.remove("open");
            mobileMenu.textContent = "☰";
        }
    });
});
