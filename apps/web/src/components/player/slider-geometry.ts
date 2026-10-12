/** 0–1 along the track local X axis, including CSS-rotated mobile landscape emulate. */
export function sliderRatioFromClient(el: HTMLElement, clientX: number, clientY: number): number {
  let angle = 0;
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    const transform = window.getComputedStyle(node).transform;
    if (transform && transform !== "none") {
      try {
        const matrix = new DOMMatrixReadOnly(transform);
        angle += Math.atan2(matrix.b, matrix.a);
      } catch {
        /* ignore invalid transform lists */
      }
    }
  }
  const rect = el.getBoundingClientRect();
  const dx = clientX - (rect.left + rect.width / 2);
  const dy = clientY - (rect.top + rect.height / 2);
  const localX = dx * Math.cos(-angle) - dy * Math.sin(-angle);
  const width = el.offsetWidth || 1;
  const ratio = localX / width + 0.5;
  return Math.min(1, Math.max(0, ratio));
}
