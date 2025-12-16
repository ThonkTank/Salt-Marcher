// src/ui/workmode/split-view-container.ts
// Resizable split-view container for workmode layouts

export interface SplitViewConfig {
    /** CSS class name for the container */
    className?: string;
    /** Initial split ratio (0-1), defaults to 0.6 (60% upper, 40% lower) */
    initialSplit?: number;
    /** Minimum size for upper pane in pixels */
    minUpperSize?: number;
    /** Minimum size for lower pane in pixels */
    minLowerSize?: number;
    /** Orientation of the split */
    orientation?: "horizontal" | "vertical";
    /** Whether the split is resizable */
    resizable?: boolean;
    /** Callback when split ratio changes */
    onSplitChange?: (ratio: number) => void;
}

export interface SplitViewHandle {
    readonly element: HTMLElement;
    readonly upperElement: HTMLElement;
    readonly lowerElement: HTMLElement;
    readonly resizerElement?: HTMLElement;
    /** Get the current split ratio (0-1) */
    getSplitRatio(): number;
    /** Set the split ratio (0-1) */
    setSplitRatio(ratio: number): void;
    /** Toggle the upper pane visibility */
    toggleUpper(visible?: boolean): void;
    /** Toggle the lower pane visibility */
    toggleLower(visible?: boolean): void;
    /** Clean up and remove the container */
    destroy(): void;
}

const DEFAULT_SPLIT = 0.6;
const DEFAULT_MIN_SIZE = 100;

export function createSplitView(
    parent: HTMLElement,
    config: SplitViewConfig = {}
): SplitViewHandle {
    const {
        className,
        initialSplit = DEFAULT_SPLIT,
        minUpperSize = DEFAULT_MIN_SIZE,
        minLowerSize = DEFAULT_MIN_SIZE,
        orientation = "horizontal",
        resizable = true,
        onSplitChange,
    } = config;

    // Create container
    const container = parent.createDiv({ cls: "sm-split-view" });
    container.dataset.orientation = orientation;
    if (className) {
        container.addClass(className);
    }

    // Create panes
    const upperPane = container.createDiv({ cls: "sm-split-view__upper" });
    const lowerPane = container.createDiv({ cls: "sm-split-view__lower" });

    let currentSplit = Math.max(0.1, Math.min(0.9, initialSplit));
    let isDragging = false;
    let dragStartY = 0;
    let dragStartSplit = 0;

    const applySplit = () => {
        if (orientation === "horizontal") {
            upperPane.style.height = `${currentSplit * 100}%`;
            lowerPane.style.height = `${(1 - currentSplit) * 100}%`;
        } else {
            upperPane.style.width = `${currentSplit * 100}%`;
            lowerPane.style.width = `${(1 - currentSplit) * 100}%`;
        }
    };

    applySplit();

    // Create resizer if enabled
    let resizer: HTMLElement | undefined;
    if (resizable) {
        resizer = container.createDiv({ cls: "sm-split-view__resizer" });
        resizer.dataset.orientation = orientation;

        // Insert resizer between panes
        container.insertBefore(resizer, lowerPane);

        const handlePointerDown = (e: PointerEvent) => {
            if (e.button !== 0) return; // Only left button
            e.preventDefault();
            e.stopPropagation();

            isDragging = true;
            dragStartY = orientation === "horizontal" ? e.clientY : e.clientX;
            dragStartSplit = currentSplit;

            resizer!.setPointerCapture(e.pointerId);
            container.addClass("is-resizing");
        };

        const handlePointerMove = (e: PointerEvent) => {
            if (!isDragging) return;
            e.preventDefault();
            e.stopPropagation();

            const containerRect = container.getBoundingClientRect();
            const containerSize = orientation === "horizontal"
                ? containerRect.height
                : containerRect.width;

            const currentPos = orientation === "horizontal" ? e.clientY : e.clientX;
            const deltaPos = currentPos - dragStartY;
            const deltaRatio = deltaPos / containerSize;

            let newSplit = dragStartSplit + deltaRatio;

            // Apply minimum size constraints
            const minUpperRatio = minUpperSize / containerSize;
            const minLowerRatio = minLowerSize / containerSize;

            newSplit = Math.max(minUpperRatio, Math.min(1 - minLowerRatio, newSplit));

            if (Math.abs(newSplit - currentSplit) > 0.001) {
                currentSplit = newSplit;
                applySplit();
                onSplitChange?.(currentSplit);
            }
        };

        const stopDragging = (e?: PointerEvent) => {
            if (!isDragging) return;
            if (e) {
                e.preventDefault();
                e.stopPropagation();
                resizer!.releasePointerCapture(e.pointerId);
            }
            isDragging = false;
            container.removeClass("is-resizing");
        };

        resizer.addEventListener("pointerdown", handlePointerDown);
        resizer.addEventListener("pointermove", handlePointerMove);
        resizer.addEventListener("pointerup", stopDragging);
        resizer.addEventListener("pointercancel", stopDragging);
        resizer.addEventListener("pointerleave", (e) => {
            if (isDragging) stopDragging(e);
        });
    }

    return {
        element: container,
        upperElement: upperPane,
        lowerElement: lowerPane,
        resizerElement: resizer,

        getSplitRatio() {
            return currentSplit;
        },

        setSplitRatio(ratio: number) {
            currentSplit = Math.max(0.1, Math.min(0.9, ratio));
            applySplit();
            onSplitChange?.(currentSplit);
        },

        toggleUpper(visible?: boolean) {
            const shouldShow = visible ?? upperPane.style.display === "none";
            upperPane.style.display = shouldShow ? "" : "none";
            if (resizer) {
                resizer.style.display = shouldShow ? "" : "none";
            }
        },

        toggleLower(visible?: boolean) {
            const shouldShow = visible ?? lowerPane.style.display === "none";
            lowerPane.style.display = shouldShow ? "" : "none";
            if (resizer) {
                resizer.style.display = shouldShow ? "" : "none";
            }
        },

        destroy() {
            if (isDragging) {
                isDragging = false;
                container.removeClass("is-resizing");
            }
            container.remove();
        },
    };
}
