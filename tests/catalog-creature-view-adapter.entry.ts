import assert from "node:assert/strict";
import test from "node:test";
import { parseHTML } from "linkedom";
import bundledSrd from "../src/features/catalog/data/srd-5.1.generated.json";
import { CreatureCatalog, SRD_5_1_NOTICE } from "../src/features/catalog/creature-catalog";
import { CreatureCatalogView } from "../src/features/catalog/creature-catalog-view";
import { CREATURE_CATALOG_VIEW } from "../src/ui/view-types";

test("Obsidian catalog ItemView is a thin port adapter for host-neutral content", async () => {
  const { document } = parseHTML("<html><body><main id='catalog'></main></body></html>");
  const root = document.querySelector<HTMLElement>("#catalog")!;
  const catalog = new CreatureCatalog(bundledSrd);
  const plugin = { creatureCatalog: { notice: SRD_5_1_NOTICE, load: async () => catalog } };
  const view = new CreatureCatalogView({ contentEl: root } as never, plugin as never);
  assert.equal(view.getViewType(), CREATURE_CATALOG_VIEW);
  assert.equal(view.getDisplayText(), "Monsterkatalog");
  assert.equal(view.getIcon(), "book-open");
  await view.onOpen();
  assert.ok(root.querySelector(".dn-catalog-results"));
  await view.setState({ text: "aboleth", textDraft: "aboleth" });
  assert.equal(view.getState().text, "aboleth");
  assert.match(root.querySelector(".dn-catalog-footer")?.textContent ?? "", /1–1 von 1/);
  await view.onClose();
  assert.equal(root.childElementCount, 0);
});
