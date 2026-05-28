async function loadComponent(elementId, filePath) {
    const element = document.getElementById(elementId);

    if (!element) return;

    try {
        const response = await fetch(filePath);

        if (!response.ok) {
            throw new Error(`Could not load ${filePath}`);
        }

        const html = await response.text();

        element.innerHTML = html;
    } catch (error) {
        console.error(error);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadComponent("header-container", "assets/components/header.html");
});