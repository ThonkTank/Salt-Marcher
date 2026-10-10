(() => {
  "use strict";
  const heading = document.querySelector("#scene-heading");
  const status = document.querySelector("#status");
  const surface = document.querySelector("#surface");
  const art = document.querySelector("#art");
  const markers = document.querySelector("#markers");
  const legend = document.querySelector("#legend");
  const details = document.querySelector("#details");
  let rendered = null;

  function clearChildren(element) {
    while (element.firstChild) element.firstChild.remove();
  }

  function render(value) {
    if (rendered) {
      if (value.generation < rendered.generation) return;
      if (value.generation === rendered.generation) {
        const renderedTerminal = rendered.state !== "blank";
        if (
          (renderedTerminal && value.state !== rendered.state) ||
          (!renderedTerminal && value.state === "blank")
        )
          return;
      }
    }
    rendered = { generation: value.generation, state: value.state };
    document.documentElement.dataset.generation = String(value.generation);
    document.documentElement.dataset.projectionState = value.state;
    surface.dataset.state = value.state;
    clearChildren(markers);
    clearChildren(legend);
    surface.removeAttribute("style");
    art.removeAttribute("style");
    art.setAttribute("aria-label", "No released art");
    if (value.state !== "ready") {
      heading.textContent =
        value.state === "error" ? "Scene unavailable" : "Changing scene";
      status.textContent =
        value.state === "error"
          ? "No party-safe scene is available"
          : "Preparing released view";
      details.hidden = true;
      legend.hidden = true;
      return;
    }
    heading.textContent = value.map.label;
    status.textContent = "Released party-safe scene";
    surface.style.backgroundColor = value.map.backgroundColor;
    surface.style.borderColor = value.map.gridColor;
    if (value.releasedImage) {
      art.style.backgroundColor = value.releasedImage.color;
      art.style.borderColor = value.releasedImage.accentColor;
      art.setAttribute("aria-label", value.releasedImage.alt);
    }
    for (const marker of value.releasedMarkers) {
      const item = document.createElement("li");
      item.textContent = marker.label;
      item.style.left = `${marker.x}%`;
      item.style.top = `${marker.y}%`;
      item.style.backgroundColor = marker.color;
      markers.append(item);
      const line = document.createElement("p");
      line.textContent = marker.label;
      legend.append(line);
    }
    details.hidden = value.releasedMarkers.length === 0;
  }

  details.addEventListener("click", () => {
    const open = details.getAttribute("aria-expanded") !== "true";
    details.setAttribute("aria-expanded", String(open));
    legend.hidden = !open;
  });

  window.partyDisplay.subscribeProjectionChanged(render);
  window.partyDisplay
    .readProjection()
    .then(render, () => render({ state: "error", generation: 0 }));
})();
