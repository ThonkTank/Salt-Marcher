import test from "node:test";
import assert from "node:assert/strict";
import type { App } from "obsidian";
import { CopyAtlasModal } from "../src/ui/atlas-copy-modal";
import { modalTestApp, notices } from "./fixtures/obsidian-atlas-modal-stub";

function button(modal: CopyAtlasModal, name: string) {
  return [
    ...modal.contentEl.querySelectorAll<HTMLButtonElement>("button"),
  ].find((b) => b.textContent === name)!;
}
const settle = () => new Promise((resolve) => setImmediate(resolve));
test("Accepted copy stays visible through Cancel, Escape, X, outside click and direct close until delayed completion", async () => {
  const { app, document, window } = modalTestApp();
  let release!: (open: () => Promise<boolean>) => void,
    opened = 0,
    calls = 0;
  const modal = new CopyAtlasModal(
    app as unknown as App,
    "Insel",
    () => {
      calls++;
      return new Promise((resolve) => {
        release = resolve;
      });
    },
    async () => ({ state: "none" }),
  );
  modal.open();
  button(modal, "Kopie speichern").click();
  await settle();
  assert.equal(modal.modalEl.getAttribute("aria-busy"), "true");
  assert.match(
    modal.contentEl.querySelector('[role="status"]')!.textContent!,
    /gespeichert/,
  );
  assert.equal(
    modal.contentEl.querySelector<HTMLInputElement>("input")!.disabled,
    true,
  );
  assert.equal(modal.canDismiss(), false);
  button(modal, "Abbrechen").click();
  const escape = new window.Event("keydown");
  Object.defineProperty(escape, "key", { value: "Escape" });
  document.dispatchEvent(escape);
  modal.modalEl
    .querySelector<HTMLButtonElement>(".modal-header-button")!
    .click();
  modal.containerEl.dispatchEvent(new window.Event("click"));
  modal.close();
  button(modal, "Kopie speichern").click();
  assert.equal(modal.containerEl.isConnected, true);
  assert.equal(calls, 1);
  release(async () => {
    opened++;
    return true;
  });
  await settle();
  assert.equal(opened, 1);
  assert.equal(modal.containerEl.isConnected, false);
  assert.deepEqual(notices, []);
});
test("Cancel before acceptance creates nothing; delayed failure restores controls, name and dismissal", async () => {
  const { app } = modalTestApp();
  let calls = 0;
  const cancelled = new CopyAtlasModal(
    app as unknown as App,
    "Insel",
    async () => {
      calls++;
      return async () => true;
    },
    async () => ({ state: "none" }),
  );
  cancelled.open();
  button(cancelled, "Abbrechen").click();
  assert.equal(calls, 0);
  let reject!: (error: Error) => void;
  const modal = new CopyAtlasModal(
    app as unknown as App,
    "Insel",
    () =>
      new Promise((_resolve, r) => {
        reject = r;
      }),
    async () => ({ state: "none" }),
  );
  modal.open();
  button(modal, "Kopie speichern").click();
  await settle();
  reject(new Error("interruption"));
  await settle();
  assert.equal(modal.canDismiss(), true);
  assert.equal(
    modal.contentEl.querySelector<HTMLInputElement>("input")!.value,
    "Insel Kopie",
  );
  assert.equal(button(modal, "Kopie speichern").disabled, false);
  assert.match(notices.at(-1)!, /interruption/);
  modal.close();
  assert.equal(modal.containerEl.isConnected, false);
});
test("Late completion after source change reports the saved copy without navigating", async () => {
  const { app } = modalTestApp();
  let current = true,
    navigations = 0;
  let release!: () => void;
  const modal = new CopyAtlasModal(
    app as unknown as App,
    "Insel",
    async () => {
      await new Promise<void>((r) => {
        release = r;
      });
      return async () => {
        if (!current) return false;
        navigations++;
        return true;
      };
    },
    async () => ({ state: "none" }),
  );
  modal.open();
  button(modal, "Kopie speichern").click();
  await settle();
  current = false;
  release();
  await settle();
  assert.equal(navigations, 0);
  assert.equal(modal.containerEl.isConnected, false);
  assert.match(notices.at(-1)!, /Insel Kopie.*gespeichert/);
});
test("Explicit copy recovery uses the entered name, holds the same lock and permits retry after rollback", async () => {
  const { app, window } = modalTestApp();
  let target = "",
    copies = 0;
  let release!: (value: { state: "rolled_back" }) => void;
  const modal = new CopyAtlasModal(
    app as unknown as App,
    "Insel",
    async () => {
      copies++;
      return async () => true;
    },
    (name) => {
      target = name;
      return new Promise((r) => {
        release = r;
      });
    },
  );
  modal.open();
  const input = modal.contentEl.querySelector<HTMLInputElement>("input")!;
  input.value = "Verlorene Kopie";
  input.dispatchEvent(new window.Event("input"));
  button(modal, "Unterbrochene Kopie wiederherstellen").click();
  await settle();
  modal.close();
  assert.equal(modal.containerEl.isConnected, true);
  assert.equal(target, "Verlorene Kopie");
  assert.equal(copies, 0);
  release({ state: "rolled_back" });
  await settle();
  assert.equal(input.value, target);
  assert.equal(modal.canDismiss(), true);
  assert.match(
    modal.contentEl.querySelector('[role="status"]')!.textContent!,
    /zurückgenommen/,
  );
  button(modal, "Kopie speichern").click();
  await settle();
  assert.equal(copies, 1);
});
