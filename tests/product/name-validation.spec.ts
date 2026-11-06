import { selectObject } from "../support/editor";
import type { House } from "../../src/atlas/model";
import {
  calls,
  clearCalls,
  metadata,
  openHouse,
  ready,
  scene,
  seedHouse,
  selectRoom,
  status,
  url,
} from "../support/editor";
import { expect, test } from "../support/fixture";

for (const kind of ["house", "room"] as const) {
  test(`${kind} names validate Unicode codepoints without truncation or invalid writes`, async ({
    page,
  }) => {
    await page.goto(url);
    const house = await seedHouse(page, 4, 4, [0]);
    await openHouse(page, house);
    const room = await selectRoom(page, house.id);
    const field = page.getByRole("textbox", {
      name: kind === "house" ? "Name" : "Raumname",
      exact: true,
    });
    const savedName = async () =>
      kind === "house"
        ? (await scene(page)).objects.find(
            (o): o is House => o.kind === "house" && o.id === house.id,
          )?.name
        : (await metadata(page, house.id)).rooms.find((r) => r.id === room.id)
            ?.name;

    for (const name of ["💧".repeat(120), "Küche am Bach", "\uFEFF"]) {
      await clearCalls(page);
      await field.fill(name);
      await field.blur();
      await expect.poll(savedName).toBe(name);
      await ready(page);
      await expect(field).toHaveValue(name);
      await expect(field).not.toHaveAttribute("aria-invalid", "true");
      expect(await calls(page, "commit")).toHaveLength(1);
    }

    const before = await status(page);
    for (const invalid of ["💧".repeat(121), "", "   ", "\u0085\u00A0"]) {
      await clearCalls(page);
      await field.fill(invalid);
      await field.blur();
      await expect(field).toHaveValue(invalid);
      await expect(field).toHaveAttribute("aria-invalid", "true");
      await expect(field).toHaveAccessibleDescription(
        invalid.length > 120
          ? "Der Name darf höchstens 120 Unicodezeichen enthalten."
          : "Der Name darf nicht leer sein oder nur Leerraum enthalten.",
      );
      expect(await calls(page, "commit")).toHaveLength(0);
      expect(await savedName()).toBe("\uFEFF");
      expect(await status(page)).toEqual(before);
    }

    await field.fill("Korrigierter Name");
    await field.blur();
    await expect.poll(savedName).toBe("Korrigierter Name");
    await expect(field).not.toHaveAttribute("aria-invalid", "true");
    await expect(
      page.getByText(
        "Der Name darf nicht leer sein oder nur Leerraum enthalten.",
      ),
    ).toHaveCount(0);
  });
}

test("selecting another object discards an invalid name draft without changing either name", async ({
  page,
}) => {
  await page.goto(url);
  const first = await seedHouse(page, 4, 4, [0]);
  const second = await seedHouse(page, 4, 4, [0], 100);
  await page.reload();
  await ready(page);
  await selectObject(page, `⌂ ${first.name}`);
  await ready(page);
  const field = page.getByRole("textbox", { name: "Name", exact: true });
  await clearCalls(page);
  await field.fill("💧".repeat(121));
  await selectObject(page, `⌂ ${second.name}`);
  await ready(page);
  await expect(field).toHaveValue(second.name);
  await expect(field).not.toHaveAttribute("aria-invalid", "true");
  await selectObject(page, `⌂ ${first.name}`);
  await ready(page);
  await expect(field).toHaveValue(first.name);
  expect(await calls(page, "commit")).toHaveLength(0);
});
