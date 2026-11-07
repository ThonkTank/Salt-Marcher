import {
  holdResponse,
  openHouse,
  ready,
  releaseResponse,
  seedHouse,
  url,
} from "../support/editor";
import { expect, test } from "../support/fixture";
test("delete and unsaved modals preserve focus and keyboard access at minimum viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 620 });
  await page.goto(url);
  const house = await seedHouse(page, 5, 4, [-1, 0, 1]);
  await page.reload();
  await ready(page);
  await openHouse(page, house);
  await ready(page);
  const opener = page.getByRole("button", {
    name: "Objekt löschen",
    exact: true,
  });
  await holdResponse(page, "preview");
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Objekt löschen" });
  await expect(dialog).toBeVisible();
  await expect(page.locator(".atlas-header")).toHaveAttribute("inert", "");
  await verifyFocusCycle(dialog);
  await expect(
    dialog.getByRole("button", { name: "Löschen bestätigen" }),
  ).toBeDisabled();
  await releaseResponse(page);
  await expect(
    dialog.getByRole("button", { name: "Löschen bestätigen" }),
  ).toBeEnabled();
  await verifyFocusCycle(dialog);
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((d) => d.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  const fresh = page.getByRole("button", { name: "Neu", exact: true });
  await fresh.click();
  const unsaved = page.getByRole("dialog", {
    name: "Ungespeicherte Änderungen",
  });
  await expect(unsaved).toBeVisible();
  await verifyFocusCycle(unsaved);
  await page.keyboard.press("Escape");
  await expect(unsaved).toHaveCount(0);
  await expect(fresh).toBeFocused();
});

async function verifyFocusCycle(dialog: import("@playwright/test").Locator) {
  const buttons = dialog.locator("button:not(:disabled)");
  const count = await buttons.count();
  await buttons.first().focus();
  // WebKitGTK reports native Shift+Tab with an unidentified key but Tab code.
  const allowed = await buttons.first().evaluate((button) =>
    button.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Unidentified",
        code: "Tab",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  expect(allowed).toBe(false);
  await expect(buttons.last()).toBeFocused();
  await buttons.first().focus();
  for (const direction of ["Shift+Tab", "Tab"]) {
    for (let step = 1; step <= count; step++) {
      await dialog.page().keyboard.press(direction);
      const index = direction === "Tab" ? step % count : (count - step) % count;
      await expect(buttons.nth(index)).toBeFocused();
    }
  }
}
