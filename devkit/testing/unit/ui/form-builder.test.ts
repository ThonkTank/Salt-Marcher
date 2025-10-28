// salt-marcher/tests/ui/form-builder.test.ts
// Prüft den Formular-Builder auf DOM-Aufbau, Handles und Eventbindung.
import { describe, expect, it, vi } from "vitest";
import {
    buildForm,
    type FormSelectHandle,
    type FormSliderHandle,
} from "../../src/ui/form-builder";

describe("buildForm", () => {
    it("renders configured sections and wires control callbacks", () => {
        const root = document.createElement("div");
        const onSelect = vi.fn();
        const onSlider = vi.fn();

        const form = buildForm(root, {
            sections: [
                { kind: "header", text: "Demo" },
                { kind: "static", id: "static", text: "Static text", cls: "demo-static" },
                {
                    kind: "row",
                    label: "Option",
                    controls: [
                        {
                            kind: "select",
                            id: "choice",
                            options: [
                                { label: "First", value: "first" },
                                { label: "Second", value: "second" },
                            ],
                            onChange: onSelect,
                        },
                    ],
                },
                {
                    kind: "row",
                    label: "Strength",
                    controls: [
                        {
                            kind: "slider",
                            id: "strength",
                            min: 1,
                            max: 10,
                            value: 5,
                            onInput: onSlider,
                        },
                    ],
                },
                { kind: "hint", id: "hint", cls: "demo-hint" },
                { kind: "status", id: "status", cls: "demo-status" },
            ],
        });

        expect(root.querySelector("h3")?.textContent).toBe("Demo");
        expect(root.querySelector(".demo-static")?.textContent).toBe("Static text");

        const selectHandle = form.getControl("choice") as FormSelectHandle;
        selectHandle.element.value = "second";
        selectHandle.element.dispatchEvent(new Event("change"));
        expect(onSelect).toHaveBeenCalledTimes(1);

        const sliderHandle = form.getControl("strength") as FormSliderHandle;
        sliderHandle.element.value = "7";
        sliderHandle.element.dispatchEvent(new Event("input"));
        expect(onSlider).toHaveBeenCalledTimes(1);
        expect(sliderHandle.valueElement?.textContent).toBe("7");

        const hint = form.getHint("hint");
        hint?.set({ text: "Hint text", tone: "info" });
        expect(hint?.element.textContent).toBe("Hint text");
        expect(hint?.element.style.display).toBe("");

        const status = form.getStatus("status");
        status?.set({ message: "Ready", tone: "info" });
        expect(status?.element.textContent).toBe("Ready");
        expect(status?.element.classList.contains("is-empty")).toBe(false);

        form.destroy();

        selectHandle.element.dispatchEvent(new Event("change"));
        expect(onSelect).toHaveBeenCalledTimes(1);
    });
});
