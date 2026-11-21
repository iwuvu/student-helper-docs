// Student Helper: when a link opens a PDF with #search=..., glide to the highlighted text instead of
// jumping there. The glide takes exactly 0.5 s and can't be interrupted (wheel, touch and scroll keys
// are ignored while it runs). Replaces PDF.js's own findController.scrollMatchIntoView, which snaps
// the match to the top edge; here it ends about a third of the way down the screen.

const DURATION = 500;   // ms
const FROM_TOP = 0.3;   // where the highlight ends up, as a share of the visible height

const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);   // ease-in-out cubic

function glide(container, toTop, toLeft) {
  const fromTop = container.scrollTop, fromLeft = container.scrollLeft;
  const block = e => e.preventDefault();
  const blockKeys = e => {
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ", "Spacebar"].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  const opts = { passive: false, capture: true };
  window.addEventListener("wheel", block, opts);
  window.addEventListener("touchmove", block, opts);
  window.addEventListener("keydown", blockKeys, opts);
  const start = performance.now();
  let done = false;
  // Position depends only on elapsed time. Steps come from animation frames (smooth) and also from
  // a 16 ms timer, so the glide still ends at exactly 0.5 s if the browser slows frames down.
  const step = () => {
    if (done) return;
    const t = Math.min(1, (performance.now() - start) / DURATION);
    const k = ease(t);
    // Set on every step, so anything else that scrolls meanwhile is overridden.
    container.scrollTop = fromTop + (toTop - fromTop) * k;
    container.scrollLeft = fromLeft + (toLeft - fromLeft) * k;
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      done = true;
      clearInterval(timer);
      window.removeEventListener("wheel", block, opts);
      window.removeEventListener("touchmove", block, opts);
      window.removeEventListener("keydown", blockKeys, opts);
    }
  };
  const timer = setInterval(step, 16);
  requestAnimationFrame(step);
}
window.studentHelperGlide = glide;   // for testing

async function install() {
  const app = window.PDFViewerApplication;
  if (!app) {
    return setTimeout(install, 50);   // viewer.mjs not loaded yet
  }
  await app.initializedPromise;
  const fc = app.findController;
  const container = app.appConfig.mainContainer;
  fc.scrollMatchIntoView = function ({ element = null, pageIndex = -1, matchIndex = -1 }) {
    // Same checks as PDF.js: only the selected match, and only once per search.
    if (!this._scrollMatches || !element) return;
    if (matchIndex === -1 || matchIndex !== this._selected.matchIdx) return;
    if (pageIndex === -1 || pageIndex !== this._selected.pageIdx) return;
    this._scrollMatches = false;
    const box = container.getBoundingClientRect();
    const hit = element.getBoundingClientRect();
    const maxTop = container.scrollHeight - container.clientHeight;
    const maxLeft = container.scrollWidth - container.clientWidth;
    const toTop = Math.max(0, Math.min(maxTop,
      container.scrollTop + (hit.top - box.top) - container.clientHeight * FROM_TOP));
    const toLeft = Math.max(0, Math.min(maxLeft,
      container.scrollLeft + (hit.left + hit.width / 2) - (box.left + container.clientWidth / 2)));
    glide(container, toTop, toLeft);
  };
}

install();
