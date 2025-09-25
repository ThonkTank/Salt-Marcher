import type { ElementPreviewContext } from "../base";

export function renderContainerPreview({ preview, element, elements, ensureContainerDefaults }: ElementPreviewContext) {
    ensureContainerDefaults(element);
    const frame = preview.createDiv({ cls: "sm-le-preview__container" });
    const header = frame.createDiv({ cls: "sm-le-preview__container-header" });
    const labelText = element.label?.trim() ?? "";
    if (labelText) {
        header.createSpan({ cls: "sm-le-preview__label", text: labelText });
    } else {
        header.style.display = "none";
    }
    const body = frame.createDiv({ cls: "sm-le-preview__container-body" });
    const hasChildren = Array.isArray(element.children)
        ? element.children.some(childId => elements.some(el => el.id === childId))
        : false;
    if (!hasChildren) {
        body.createDiv({ cls: "sm-le-preview__container-placeholder", text: "Leerer Container" });
    }
}

