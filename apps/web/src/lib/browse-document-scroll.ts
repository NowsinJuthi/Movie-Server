/** Reset document scroll locks on browse pages (menu/modals — not the video player). */
export function ensureBrowseDocumentScroll(): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.removeProperty("overflow");
  document.documentElement.style.removeProperty("height");
  document.body.style.removeProperty("overflow");
  document.body.style.removeProperty("position");
  document.body.style.removeProperty("height");
  document.body.style.removeProperty("width");
  document.body.style.removeProperty("touch-action");
}
