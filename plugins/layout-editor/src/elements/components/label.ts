import { createInlineEditor } from "../../inline-edit";
import type { LayoutElementComponent } from "../base";

const labelComponent: LayoutElementComponent = {
    definition: {
        type: "label",
        buttonLabel: "Label",
        defaultLabel: "Überschrift",
        category: "element",
        paletteGroup: "element",
        width: 260,
        height: 160,
    },
    renderPreview({ preview, element, finalize }) {
        const block = preview.createDiv({ cls: "sm-le-preview__headline" });
        const inner = block.createDiv({ cls: "sm-le-preview__headline-inner" });
        let labelEl: HTMLElement | undefined;

        const autoScaleHeadlineText = () => {
            if (!labelEl || !inner.isConnected) return;
            const maxWidth = Math.max(0, inner.clientWidth - 12);
            const maxHeight = Math.max(0, inner.clientHeight - 12);
            if (!maxWidth || !maxHeight) return;
            const contentLength = (labelEl.textContent ?? "").trim().length;
            const minSize = 18;
            if (contentLength === 0) {
                const fallback = Math.max(minSize, Math.min(maxWidth, maxHeight) / 3);
                labelEl.style.fontSize = `${Math.round(fallback)}px`;
                return;
            }
            let low = minSize;
            let high = Math.max(minSize, Math.min(maxWidth, maxHeight));
            for (let i = 0; i < 10; i++) {
                const mid = (low + high) / 2;
                labelEl.style.fontSize = `${mid}px`;
                const fits = labelEl.scrollWidth <= maxWidth && labelEl.scrollHeight <= maxHeight;
                if (fits) {
                    low = mid;
                } else {
                    high = mid - 1;
                }
            }
            labelEl.style.fontSize = `${Math.floor(low)}px`;
        };

        labelEl = createInlineEditor({
            parent: inner,
            value: element.label,
            placeholder: "Überschrift eingeben…",
            multiline: true,
            block: true,
            trim: false,
            onInput: () => autoScaleHeadlineText(),
            onCommit: value => {
                const next = value || "";
                if (next === element.label) return;
                element.label = next;
                finalize(element);
                autoScaleHeadlineText();
            },
        });
        labelEl.addClass("sm-le-preview__headline-text");
        autoScaleHeadlineText();
        if (element.description !== undefined) {
            element.description = undefined;
        }
    },
};

export default labelComponent;
