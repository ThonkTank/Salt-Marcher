// src/plugins/layout-editor/element-preview.ts
import { createInlineEditor } from "./inline-edit";
import type { ElementPreviewDependencies, ElementPreviewContext } from "./elements/base";
import { getLayoutElementComponent } from "./elements/registry";

export function renderElementPreview(deps: ElementPreviewDependencies) {
    const { host, element } = deps;
    const hostWithCleanup = host as HTMLElement & { __smPreviewCleanup__?: () => void };
    if (hostWithCleanup.__smPreviewCleanup__) {
        hostWithCleanup.__smPreviewCleanup__();
        delete hostWithCleanup.__smPreviewCleanup__;
    }
    host.empty();
    host.toggleClass("sm-le-box__content", true);
    const preview = host.createDiv({ cls: `sm-le-preview sm-le-preview--${element.type}` });
    const registerPreviewCleanup = (cleanup: () => void) => {
        if (hostWithCleanup.__smPreviewCleanup__) {
            hostWithCleanup.__smPreviewCleanup__();
        }
        hostWithCleanup.__smPreviewCleanup__ = cleanup;
    };
    const context: ElementPreviewContext = { ...deps, preview, container: host, registerPreviewCleanup };

    const component = getLayoutElementComponent(element.type);
    if (component) {
        component.renderPreview(context);
        return;
    }

    renderFallbackPreview(context);
}

function renderFallbackPreview(context: ElementPreviewContext) {
    const { preview, element, finalize } = context;
    const fallback = preview.createDiv({ cls: "sm-le-preview__field" });
    const labelHost = fallback.createSpan({ cls: "sm-le-preview__label" });
    createInlineEditor({
        parent: labelHost,
        value: element.label,
        placeholder: "Label eingeben…",
        onCommit: value => {
            const next = value || "";
            if (next === element.label) return;
            element.label = next;
            finalize(element);
        },
    });
}
