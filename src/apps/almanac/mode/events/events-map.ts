// src/apps/almanac/mode/events/events-map.ts
// Renders an interactive board that plots phenomena as markers on a schematic map.

import type { EventsMapMarker } from "../contracts";

export interface EventsMapProps {
    readonly markers: ReadonlyArray<EventsMapMarker>;
}

export function renderEventsMap(host: HTMLElement, props: EventsMapProps): HTMLElement {
    const container = document.createElement("div");
    container.classList.add("almanac-events-map");
    container.dataset.component = "events-map";
    host.appendChild(container);

    const summary = document.createElement("div");
    summary.classList.add("almanac-events-map__summary");
    summary.dataset.role = "map-summary";
    const categorySet = new Set<string>();
    const calendarSet = new Set<string>();
    for (const marker of props.markers) {
        if (marker.category) {
            categorySet.add(marker.category);
        }
        for (const calendar of marker.calendars) {
            calendarSet.add(calendar.name);
        }
    }
    const summaryParts: string[] = [];
    summaryParts.push(`${props.markers.length} phenomena plotted`);
    if (categorySet.size > 0) {
        summaryParts.push(`${categorySet.size} categories`);
    }
    if (calendarSet.size > 0) {
        summaryParts.push(`${calendarSet.size} calendars`);
    }
    summary.textContent = summaryParts.join(" • ");
    container.appendChild(summary);

    const board = document.createElement("div");
    board.classList.add("almanac-events-map__board");
    board.dataset.role = "map-board";
    board.style.position = "relative";
    board.style.minHeight = "240px";
    board.style.border = "1px solid var(--background-modifier-border, #3a3a3a)";
    board.style.borderRadius = "12px";
    board.style.background = "var(--background-secondary, rgba(255,255,255,0.02))";
    board.style.overflow = "hidden";
    board.style.isolation = "isolate";
    container.appendChild(board);

    props.markers.forEach(marker => {
        const markerButton = document.createElement("button");
        markerButton.type = "button";
        markerButton.classList.add("almanac-events-map__marker");
        markerButton.dataset.role = "map-marker";
        markerButton.dataset.phenomenonId = marker.id;
        markerButton.style.position = "absolute";
        markerButton.style.width = "20px";
        markerButton.style.height = "20px";
        markerButton.style.borderRadius = "50%";
        markerButton.style.border = "2px solid var(--interactive-accent, #9c6bff)";
        markerButton.style.background = "var(--background-primary, #1a1a1a)";
        markerButton.style.transform = "translate(-50%, -50%)";
        markerButton.style.left = `${(marker.coordinates.x * 100).toFixed(2)}%`;
        markerButton.style.top = `${(marker.coordinates.y * 100).toFixed(2)}%`;
        markerButton.setAttribute("aria-label", buildMarkerLabel(marker));
        markerButton.title = buildMarkerLabel(marker);

        const markerLabel = document.createElement("span");
        markerLabel.classList.add("almanac-events-map__marker-label");
        markerLabel.textContent = marker.title;
        markerLabel.style.position = "absolute";
        markerLabel.style.top = "100%";
        markerLabel.style.left = "50%";
        markerLabel.style.transform = "translate(-50%, 4px)";
        markerLabel.style.whiteSpace = "nowrap";
        markerLabel.style.fontSize = "10px";
        markerLabel.style.pointerEvents = "none";
        markerButton.appendChild(markerLabel);

        board.appendChild(markerButton);
    });

    const legendHeading = document.createElement("h3");
    legendHeading.classList.add("almanac-events-map__legend-heading");
    legendHeading.textContent = "Map Markers";
    container.appendChild(legendHeading);

    const legendList = document.createElement("ul");
    legendList.classList.add("almanac-events-map__legend");
    legendList.dataset.role = "map-legend";
    container.appendChild(legendList);

    props.markers.forEach(marker => {
        const item = document.createElement("li");
        item.classList.add("almanac-events-map__legend-item");
        item.dataset.role = "map-legend-item";
        item.dataset.phenomenonId = marker.id;

        const title = document.createElement("strong");
        title.textContent = marker.title;
        item.appendChild(title);

        if (marker.category) {
            const category = document.createElement("span");
            category.classList.add("almanac-events-map__legend-category");
            category.textContent = ` (${marker.category})`;
            item.appendChild(category);
        }

        const calendars = document.createElement("div");
        calendars.classList.add("almanac-events-map__legend-calendars");
        calendars.textContent = marker.calendars.length
            ? `Calendars: ${marker.calendars.map(calendar => calendar.name).join(", ")}`
            : "Calendars: —";
        item.appendChild(calendars);

        if (marker.nextOccurrence) {
            const next = document.createElement("div");
            next.classList.add("almanac-events-map__legend-occurrence");
            next.textContent = `Next: ${marker.nextOccurrence}`;
            item.appendChild(next);
        }

        const coordinates = document.createElement("div");
        coordinates.classList.add("almanac-events-map__legend-coordinates");
        coordinates.textContent = `Position: ${(marker.coordinates.x * 100).toFixed(1)}%, ${(marker.coordinates.y * 100).toFixed(1)}%`;
        item.appendChild(coordinates);

        legendList.appendChild(item);
    });

    return container;
}

function buildMarkerLabel(marker: EventsMapMarker): string {
    const calendars = marker.calendars.length
        ? marker.calendars.map(calendar => calendar.name).join(", ")
        : "No calendar link";
    const segments = [marker.title];
    if (marker.category) {
        segments.push(marker.category);
    }
    if (marker.nextOccurrence) {
        segments.push(marker.nextOccurrence);
    }
    segments.push(`Calendars: ${calendars}`);
    return segments.join(" • ");
}
