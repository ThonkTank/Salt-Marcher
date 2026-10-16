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

/** Obsidian popouts own a different document from the main editor window. */
export function scatterPointerSource(
  host: Pick<HTMLElement, "ownerDocument">,
): PointerDownSource {
  return host.ownerDocument;
}

/** A changed native Scatter color survives outside dismissal. */
export function dismissScatterPickerOnOutside(
  mounted: Pick<MountedObjectColorPicker, "close">,
): boolean {
  mounted.close("escape");
  return true;
}

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
  pointerSource: PointerDownSource = scatterPointerSource(host),
): MountedObjectColorPicker {
  let removeOutside = () => {};
  const mounted = mountObjectColorPicker(host, rgb, alpha, {
    ...hooks,
    onClose: (reason) => {
      removeOutside();
      hooks.onClose?.(reason);
    },
  });
  removeOutside = attachScatterPickerOutsideDismiss(
    pointerSource,
    mounted.element,
    opener,
    () => dismissScatterPickerOnOutside(mounted),
  );
  return mounted;
}
