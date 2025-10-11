// tests/ui/workmode/create/number-stepper.test.ts
// Validates the shared number stepper control renders Library styling and behaviour.
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createNumberStepper } from "../../../../src/ui/workmode/create";

const proto = HTMLElement.prototype as any;
if (!proto.createEl) {
  proto.createEl = function(tag: keyof HTMLElementTagNameMap, options?: { cls?: string | string[]; text?: string; attr?: Record<string, string> }) {
    const el = document.createElement(tag);
    if (options?.cls) {
      if (Array.isArray(options.cls)) {
        el.className = options.cls.join(" ");
      } else {
        el.className = options.cls;
      }
    }
    if (options?.text) el.textContent = options.text;
    if (options?.attr) {
      for (const [key, value] of Object.entries(options.attr)) {
        if (value === undefined) continue;
        el.setAttribute(key, value);
      }
    }
    this.appendChild(el);
    return el;
  };
}
if (!proto.createDiv) {
  proto.createDiv = function(options?: { cls?: string | string[]; text?: string; attr?: Record<string, string> }) {
    return this.createEl("div", options);
  };
}
if (!proto.empty) {
  proto.empty = function() {
    while (this.firstChild) {
      this.removeChild(this.firstChild);
    }
    return this;
  };
}

let host: HTMLElement;

describe("createNumberStepper", () => {
  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
  });

  afterEach(() => {
    host.remove();
  });

  it("renders default structure and preserves the Library button styling", () => {
    const stepper = createNumberStepper(host, { value: 3 });

    expect(stepper.container.classList.contains("sm-inline-number")).toBe(true);
    expect(stepper.input.value).toBe("3");
    expect(stepper.decrementButton.textContent).toBe("−");
    expect(stepper.incrementButton.textContent).toBe("+");
    expect(stepper.decrementButton.classList.contains("btn-compact")).toBe(true);
    expect(stepper.incrementButton.classList.contains("btn-compact")).toBe(true);
  });

  it("steps within bounds and fires callbacks only when the value changes", () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    const stepper = createNumberStepper(host, {
      min: 0,
      max: 4,
      step: 2,
      value: 0,
      onInput,
      onChange,
    });

    stepper.incrementButton.click();
    expect(stepper.input.value).toBe("2");
    expect(onInput).toHaveBeenLastCalledWith(2, "2");
    expect(onChange).toHaveBeenLastCalledWith(2);

    stepper.incrementButton.click();
    expect(stepper.input.value).toBe("4");
    expect(onInput).toHaveBeenLastCalledWith(4, "4");
    expect(onChange).toHaveBeenLastCalledWith(4);

    // Clamp at max - no additional callbacks
    stepper.incrementButton.click();
    expect(stepper.input.value).toBe("4");
    expect(onInput).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledTimes(2);

    stepper.decrementButton.click();
    expect(stepper.input.value).toBe("2");
    expect(onInput).toHaveBeenLastCalledWith(2, "2");
    expect(onChange).toHaveBeenLastCalledWith(2);

    stepper.decrementButton.click();
    expect(stepper.input.value).toBe("0");

    // Clamp at min
    stepper.decrementButton.click();
    expect(stepper.input.value).toBe("0");
    expect(onInput).toHaveBeenCalledTimes(4);
    expect(onChange).toHaveBeenCalledTimes(4);
  });

  it("exposes value helpers and honours custom wrapper/button classes", () => {
    const stepper = createNumberStepper(host, {
      wrapperClassName: "sm-cc-stat-row__score",
      buttonClassName: "btn-custom",
      className: "sm-cc-input sm-cc-stat-row__score-input",
    });

    expect(stepper.container.classList.contains("sm-cc-stat-row__score")).toBe(true);
    expect(stepper.decrementButton.classList.contains("btn-custom")).toBe(true);
    expect(stepper.incrementButton.classList.contains("btn-custom")).toBe(true);

    expect(stepper.getValue()).toBeUndefined();
    stepper.setValue(7);
    expect(stepper.input.value).toBe("7");
    expect(stepper.getValue()).toBe(7);

    stepper.setValue(undefined);
    expect(stepper.input.value).toBe("");
    expect(stepper.getValue()).toBeUndefined();
  });
});
