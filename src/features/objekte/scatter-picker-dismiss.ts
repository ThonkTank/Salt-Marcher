import {
  mountObjectColorPicker,
  type MountedObjectColorPicker,
  type ObjectColorPickerHooks,
} from "./rgba-picker";

export interface PointerDownSource {
  addEventListener(
    type: "pointerdown",
    listener: (event: PointerEvent) => void,
    capture: true,
  ): void;
  removeEventListener(
    type: "pointerdown",
    listener: (event: PointerEvent) => void,
    capture: true,
  ): void;
}

type Containment = Pick<HTMLElement, "contains">;

/** Closes only on a pointer press outside both the picker and its opener. */
export function attachScatterPickerOutsideDismiss(
  source: PointerDownSource,
  picker: Containment,
  opener: Containment,
  dismiss: () => boolean,
): () => void {
  let active = true;
  const onPointerDown = (event: PointerEvent) => {
    if (
      !active ||
      !event.target ||
      picker.contains(event.target as Node) ||
      opener.contains(event.target as Node)
    )
      return;
    if (!dismiss()) return;
    if (!active) return;
    active = false;
    source.removeEventListener("pointerdown", onPointerDown, true);
  };
  source.addEventListener("pointerdown", onPointerDown, true);
  return () => {
    if (!active) return;
    active = false;
    source.removeEventListener("pointerdown", onPointerDown, true);
  };
}

/** Scatter's directly observed outside-click gesture, using the common RGBA picker. */
export function mountScatterColorPicker(
  host: HTMLElement,
  opener: HTMLElement,
  rgb: number,
  alpha: number,
  hooks: ObjectColorPickerHooks,
  pointerSource: PointerDownSource = document,
): MountedObjectColorPicker {
  let removeOutside = () => {};
  const mounted = mountObjectColorPicker(host, rgb, alpha, {
    ...hooks,
    onClose: (reason) => {
      removeOutside();
      hooks.onClose?.(reason);
    },
  });
  const initialArgb = mounted.controller.argb;
  removeOutside = attachScatterPickerOutsideDismiss(
    pointerSource,
    mounted.element,
    opener,
    () => {
      // Outside dismissal was observed only without an intervening color edit.
      // Keep a changed picker open until the native value rule is measured.
      if (mounted.controller.argb !== initialArgb) return false;
      mounted.close("escape");
      return true;
    },
  );
  return mounted;
}
