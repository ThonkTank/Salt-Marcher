export class HexAccessChoices {
  private owner = '';
  private chosen = new Set<string>();
  constructor(
    private root: HTMLElement,
    private changed: () => void,
  ) {}
  values() {
    return [...this.chosen].sort();
  }
  render(owner: string, names: string[], initial: string[] = []) {
    const document = this.root.ownerDocument;
    if (owner !== this.owner) {
      this.owner = owner;
      this.chosen = new Set(initial);
    }
    this.root.replaceChildren();
    const all = [...new Set([...names, ...this.chosen])].sort();
    this.root.hidden = !all.length;
    if (!all.length) return;
    const legend = document.createElement('legend');
    legend.textContent = 'Für diese Reise vorhanden';
    this.root.append(legend);
    const hint = document.createElement('p');
    hint.textContent =
      'Nur ausdrücklich angelegte Hex-Voraussetzungen. Die Auswahl ist eine GM-Angabe; kein Inventar wird verändert.';
    this.root.append(hint);
    for (const name of all) {
      const label = document.createElement('label'),
        box = document.createElement('input');
      label.className = 'check-label';
      box.type = 'checkbox';
      box.value = name;
      box.checked = this.chosen.has(name);
      box.onchange = () => {
        if (!box.isConnected || owner !== this.owner) return;
        if (box.checked) this.chosen.add(name);
        else this.chosen.delete(name);
        this.changed();
      };
      label.append(box, document.createTextNode(name));
      this.root.append(label);
    }
  }
}
