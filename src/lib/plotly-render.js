/*
 * Lazy Plotly loader. Plotly is loaded from the CDN on first use so we don't
 * ship a 3MB bundle to readers who never open the chart mode.
 */

const PLOTLY_SRC = "https://cdn.plot.ly/plotly-2.35.2.min.js";
let pending = null;

export function loadPlotly() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Plotly) return Promise.resolve(window.Plotly);
  if (pending) return pending;

  pending = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = PLOTLY_SRC;
    s.async = true;
    s.onload = () => (window.Plotly ? resolve(window.Plotly) : reject(new Error("Plotly missing after load")));
    s.onerror = () => reject(new Error("Plotly CDN load failed"));
    document.head.appendChild(s);
  });
  return pending;
}

export async function renderFigure(node, fig) {
  const Plotly = await loadPlotly();
  await Plotly.newPlot(node, fig.data, fig.layout, {
    responsive: true,
    displaylogo: false,
    modeBarButtonsToRemove: ["lasso2d", "select2d"],
  });
}
