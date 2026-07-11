/** localStorage key for light/dark preference */
export const THEME_STORAGE_KEY = "pmo-theme";

/**
 * Blocking bootstrap for theme class on <html>.
 * Used with next/script strategy="beforeInteractive".
 */
export const themeInitScript = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}var d=document.documentElement;d.classList.toggle("dark",t==="dark");d.style.colorScheme=t;}catch(e){}})();`;
