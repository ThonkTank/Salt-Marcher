// src/workmodes/cartographer/components/tool-toolbar.ts
// Icon-based toolbar for tool switching (replaces mode dropdown)

import type { App } from "obsidian";
import { configurableLogger } from "@services/logging/configurable-logger";

const logger = configurableLogger.forModule("cartographer-tool-toolbar");

export type ToolId = string;

export type ToolbarTool = {
    id: ToolId;
    label: string;
    icon: string;
    tooltip: string;
};

export type ToolToolbarHandle = {
    setActive(toolId: ToolId): void;
    setEnabled(toolId: ToolId, enabled: boolean): void;
    destroy(): void;
};

type ToolToolbarOptions = {
    tools: ToolbarTool[];
    initialTool: ToolId;
    onToolSelect: (toolId: ToolId) => void | Promise<void>;
};

/**
 * Create icon-based tool toolbar
 */
export function createToolToolbar(
    app: App,
    container: HTMLElement,
    options: ToolToolbarOptions
): ToolToolbarHandle {
    const { tools, initialTool, onToolSelect } = options;

    // Create toolbar container
    const toolbar = container.createDiv({ cls: "sm-cartographer__toolbar" });

    const buttons = new Map<ToolId, HTMLButtonElement>();
    let activeTool: ToolId = initialTool;

    // Create tool buttons
    for (const tool of tools) {
        const button = toolbar.createEl("button", {
            cls: "sm-cartographer__tool-button",
            attr: {
                "data-tool-id": tool.id,
                "aria-label": tool.tooltip,
                "title": tool.tooltip,
            },
        });

        // Icon
        const iconEl = button.createSpan({ cls: "sm-cartographer__tool-icon" });
        iconEl.textContent = tool.icon;

        // Label
        button.createSpan({ cls: "sm-cartographer__tool-label", text: tool.label });

        // Click handler
        button.addEventListener("click", async () => {
            logger.info("Button clicked", {
                toolId: tool.id,
                currentlyActive: activeTool,
                alreadyActive: activeTool === tool.id
            });

            if (activeTool === tool.id) {
                logger.info("Tool already active, ignoring click", { toolId: tool.id });
                return; // Already active
            }

            try {
                logger.info("Calling onToolSelect", { toolId: tool.id });
                await onToolSelect(tool.id);
                logger.info("onToolSelect completed", { toolId: tool.id });
                // onToolSelect is responsible for calling setActive()
            } catch (error) {
                logger.error("tool selection failed", { toolId: tool.id, error });
            }
        });

        buttons.set(tool.id, button);
    }

    // Set initial active state
    const initialButton = buttons.get(initialTool);
    if (initialButton) {
        initialButton.addClass("sm-cartographer__tool-button--active");
    }

    function setActive(toolId: ToolId) {
        logger.info("setActive called", {
            toolId,
            previousActive: activeTool,
            buttonExists: buttons.has(toolId)
        });

        // Remove active class from all buttons
        for (const [id, button] of buttons) {
            if (id === toolId) {
                logger.info("Adding active class", { toolId: id });
                button.addClass("sm-cartographer__tool-button--active");
            } else {
                button.removeClass("sm-cartographer__tool-button--active");
            }
        }

        activeTool = toolId;
        logger.info("Active tool updated", { activeTool });
    }

    function setEnabled(toolId: ToolId, enabled: boolean) {
        const button = buttons.get(toolId);
        if (!button) return;

        button.disabled = !enabled;
        if (enabled) {
            button.removeClass("sm-cartographer__tool-button--disabled");
        } else {
            button.addClass("sm-cartographer__tool-button--disabled");
        }
    }

    function destroy() {
        // Remove event listeners (handled by removing DOM)
        toolbar.remove();
        buttons.clear();
    }

    return {
        setActive,
        setEnabled,
        destroy,
    };
}
