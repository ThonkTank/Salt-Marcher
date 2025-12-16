// src/workmodes/library/locations/breadcrumb.ts
// Breadcrumb navigation component for location hierarchy

import { buildBreadcrumbs } from "./tree-builder";
import type { LocationData } from './calendar-types';

export interface BreadcrumbOptions {
    /** Callback when a breadcrumb item is clicked */
    onLocationClick?: (locationName: string) => void;
    /** CSS class for the container */
    containerClass?: string;
    /** Separator between breadcrumb items */
    separator?: string;
}

/**
 * Renders a breadcrumb navigation for a location's hierarchy.
 * Shows: Root → Parent → Parent → Current Location
 */
export class LocationBreadcrumb {
    private containerEl: HTMLElement;
    private options: BreadcrumbOptions;

    constructor(containerEl: HTMLElement, options: BreadcrumbOptions = {}) {
        this.containerEl = containerEl;
        this.options = options;
    }

    /**
     * Renders breadcrumbs for the given location.
     */
    render(locations: LocationData[], currentLocationName: string): void {
        this.containerEl.empty();

        const path = buildBreadcrumbs(locations, currentLocationName);

        if (path.length === 0) {
            return;
        }

        const breadcrumbEl = this.containerEl.createDiv({
            cls: this.options.containerClass || "sm-location-breadcrumb",
        });

        for (let i = 0; i < path.length; i++) {
            const locationName = path[i];
            const isLast = i === path.length - 1;

            // Breadcrumb item
            const itemEl = breadcrumbEl.createSpan({
                cls: isLast ? "sm-breadcrumb-item sm-breadcrumb-current" : "sm-breadcrumb-item",
                text: locationName,
            });

            // Make clickable if not the current location
            if (!isLast && this.options.onLocationClick) {
                itemEl.addClass("sm-breadcrumb-link");
                itemEl.addEventListener("click", () => {
                    if (this.options.onLocationClick) {
                        this.options.onLocationClick(locationName);
                    }
                });
            }

            // Separator (except after last item)
            if (!isLast) {
                const separator = this.options.separator || " → ";
                breadcrumbEl.createSpan({ cls: "sm-breadcrumb-separator", text: separator });
            }
        }
    }
}

/**
 * Simple helper to render breadcrumbs into a container element.
 */
export function renderLocationBreadcrumbs(
    containerEl: HTMLElement,
    locations: LocationData[],
    currentLocationName: string,
    options: BreadcrumbOptions = {}
): LocationBreadcrumb {
    const breadcrumb = new LocationBreadcrumb(containerEl, options);
    breadcrumb.render(locations, currentLocationName);
    return breadcrumb;
}
