import type { ItemInput, ItemCategory } from "./progression";
export function rewardItemsEditor(
  root: HTMLElement,
  items: (Omit<ItemInput, "quantity"> & { quantity: string | number })[],
  changed: () => void,
  raw = false,
) {
  root.replaceChildren();
  for (const [itemIndex, item] of items.entries()) {
    const row = document.createElement("fieldset"),
      legend = document.createElement("legend");
    legend.textContent = "Gegenstand " + (itemIndex + 1);
    const name = document.createElement("input"),
      quantity = document.createElement("input"),
      value = document.createElement("input"),
      category = document.createElement("select"),
      remove = document.createElement("button");
    name.value = item.name;
    name.setAttribute("aria-label", "Gegenstand");
    quantity.type = raw ? "text" : "number";
    quantity.inputMode = "numeric";
    quantity.min = "1";
    quantity.value = String(item.quantity);
    quantity.setAttribute("aria-label", "Menge");
    value.value = item.valueGold;
    value.setAttribute("aria-label", "Wert pro Stück in Gold");
    for (const [id, label] of [
      ["coins", "Münzen"],
      ["equipment", "Ausrüstung"],
      ["trade-goods", "Handelsgut"],
      ["magic", "Magischer Gegenstand"],
      ["other", "Sonstiges"],
    ]) {
      const o = document.createElement("option");
      o.value = id!;
      o.textContent = label!;
      category.append(o);
    }
    category.value = item.category;
    name.oninput = () => {
      item.name = name.value;
      delete item.reference;
      changed();
    };
    quantity.oninput = () => {
      item.quantity = raw ? quantity.value : Number(quantity.value);
      changed();
    };
    value.oninput = () => {
      item.valueGold = value.value;
      delete item.reference;
      changed();
    };
    category.onchange = () => {
      item.category = category.value as ItemCategory;
      delete item.reference;
      changed();
    };
    remove.type = "button";
    remove.textContent = "Gegenstand entfernen";
    remove.onclick = () => {
      items.splice(itemIndex, 1);
      rewardItemsEditor(root, items, changed, raw);
      changed();
    };
    row.append(legend, name, category, quantity, value, remove);
    root.append(row);
  }
  const add = document.createElement("button");
  add.type = "button";
  add.textContent = "Weiteren Gegenstand hinzufügen";
  add.onclick = () => {
    items.push({
      name: "",
      category: "equipment",
      quantity: raw ? "1" : 1,
      valueGold: "0",
    });
    rewardItemsEditor(root, items, changed, raw);
    changed();
  };
  root.append(add);
}
