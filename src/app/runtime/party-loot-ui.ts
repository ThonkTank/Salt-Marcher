import type { Result } from '../shared/contracts';
import {
  gold,
  ledgerCopper,
  type LedgerItem,
  type LedgerPage,
  type ProgressAction,
  type ProgressHistory,
} from './progression';
const unwrap = <T>(r: Result<T>) => {
  if (!r.ok) throw Error(r.error);
  return r.value;
};
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  return e;
};
/** A member-bound projection over the existing ledger and Progress writer. */
export class PartyLootPanel {
  private owner: { token: string; id: string; current: () => boolean } | null = null;
  private request = 0;
  private detailRequest = 0;
  private historyRequest = 0;
  private writing = false;
  private page: LedgerPage | null = null;
  private selected: LedgerItem | null = null;
  private history: ProgressHistory = { items: [], next: null };
  private title = node('h3');
  private search = node('input');
  private filter = node('select');
  private list = node('div');
  private status = node('p');
  private detailStatus = node('p');
  private summary = node('p');
  private more = node('button', 'Ältere Beute');
  private retry = node('button', 'Erneut laden');
  private back = node('button', '← Zur Party');
  private recoverButton = node('button', 'Buchungsstatus prüfen');
  private form = node('form');
  private quantity = node('input');
  private reason = node('input');
  private price = node('input');
  private priceLabel = node('label', 'Gesamtverkaufspreis (Gold)');
  private save = node('button', 'Menge berichtigen');
  private facts = node('p');
  private historyList = node('div');
  private historyMore = node('button', 'Älterer Beuteverlauf');
  private historyRetry = node('button', 'Verlauf erneut laden');
  constructor(
    private root: HTMLElement,
    private commit: (
      token: string,
      action: Extract<ProgressAction, { kind: 'ledger' }>,
      current: () => boolean,
    ) => Promise<void>,
    private dismiss: () => void,
    private recover: () => Promise<void> = async () => {},
  ) {
    root.id = 'party-loot-panel';
    root.hidden = true;
    const head = node('div');
    head.className = 'toolbar';
    head.append(this.back, this.title);
    this.search.type = 'search';
    this.search.id = 'party-loot-search';
    this.search.placeholder = 'Beute suchen';
    this.search.setAttribute('aria-label', 'Persönliche Beute suchen');
    for (const [value, label] of [
      ['', 'Alle Einträge'],
      ['received', 'Erhalten'],
      ['sold', 'Verkauft'],
      ['given', 'Weitergegeben'],
    ]) {
      const o = node('option', label);
      o.value = value!;
      this.filter.append(o);
    }
    this.filter.id = 'party-loot-filter';
    this.filter.setAttribute('aria-label', 'Beutestatus');
    this.more.id = 'party-loot-more';
    this.retry.id = 'party-loot-retry';
    this.list.id = 'party-loot-list';
    this.list.className = 'party-loot-list';
    this.status.id = 'party-loot-status';
    this.status.setAttribute('role', 'status');
    this.summary.id = 'party-loot-summary';
    this.detailStatus.id = 'party-loot-detail-status';
    this.detailStatus.setAttribute('role', 'status');
    this.quantity.type = 'number';
    this.quantity.min = '0';
    this.quantity.max = '1000000';
    this.quantity.step = '1';
    this.quantity.required = true;
    this.quantity.id = 'party-loot-quantity';
    this.reason.required = true;
    this.reason.maxLength = 10000;
    this.reason.id = 'party-loot-reason';
    this.price.id = 'party-loot-price';
    this.price.inputMode = 'decimal';
    const amount = node('label', 'Neue Gesamtmenge'),
      reason = node('label', 'Grund der Berichtigung');
    amount.append(this.quantity);
    reason.append(this.reason);
    this.priceLabel.append(this.price);
    this.form.id = 'party-loot-form';
    this.form.hidden = true;
    this.form.append(
      this.facts,
      amount,
      this.priceLabel,
      reason,
      this.save,
      this.detailStatus,
      this.recoverButton,
    );
    this.save.type = 'submit';
    const history = node('details'),
      label = node('summary', 'Persönlicher Beuteverlauf');
    history.id = 'party-loot-history';
    history.append(label, this.historyRetry, this.historyList, this.historyMore);
    root.append(
      head,
      this.search,
      this.filter,
      this.status,
      this.retry,
      this.summary,
      this.list,
      this.more,
      this.form,
      history,
    );
    for (const b of [this.back, this.retry, this.more, this.historyMore, this.historyRetry])
      b.type = 'button';
    this.back.onclick = () => {
      if (!this.writing) {
        this.close();
        this.dismiss();
      }
    };
    this.search.oninput = () => {
      if (!this.writing) void this.load();
    };
    this.filter.onchange = () => {
      if (!this.writing) void this.load();
    };
    this.retry.onclick = () => void this.load();
    this.more.onclick = () => void this.load(true);
    history.ontoggle = () => {
      if (history.open) void this.loadHistory();
    };
    this.historyMore.onclick = () => void this.loadHistory(true);
    this.historyRetry.onclick = () => void this.loadHistory();
    this.recoverButton.id = 'party-loot-recover';
    this.recoverButton.type = 'button';
    this.recoverButton.hidden = true;
    this.recoverButton.onclick = () => void this.recoverBooking();
    this.form.onsubmit = (e) => {
      e.preventDefault();
      void this.correct();
    };
  }
  private current(o = this.owner) {
    return !!o && this.owner === o && !this.root.hidden && o.current();
  }
  open(token: string, id: string, name: string, current: () => boolean) {
    if (this.writing) return false;
    this.close();
    this.owner = { token, id, current };
    this.title.textContent = 'Beute · ' + name;
    this.title.title = id;
    this.root.hidden = false;
    this.search.value = '';
    this.filter.value = '';
    this.reason.value = '';
    this.recoverButton.hidden = true;
    this.historyList.replaceChildren();
    this.history = { items: [], next: null };
    this.historyMore.hidden = true;
    if (this.root.querySelector<HTMLDetailsElement>('#party-loot-history')?.open)
      void this.loadHistory();
    void this.load();
    this.search.focus();
    return true;
  }
  close() {
    this.owner = null;
    this.request++;
    this.detailRequest++;
    this.historyRequest++;
    this.root.hidden = true;
    this.page = null;
    this.selected = null;
    this.form.hidden = true;
    this.list.replaceChildren();
  }
  private lock() {
    for (const e of this.root.querySelectorAll<
      HTMLInputElement | HTMLButtonElement | HTMLSelectElement
    >('input,button,select'))
      e.disabled = this.writing;
    for (const e of [this.quantity, this.reason, this.price])
      e.disabled = this.writing || !this.selected;
    this.save.disabled = this.writing || !this.selected;
  }
  private async load(more = false) {
    const o = this.owner;
    if (!this.current(o) || this.writing) return;
    const request = ++this.request,
      query = {
        characterId: o!.id,
        after: more ? (this.page?.next ?? null) : null,
        search: this.search.value,
        status: this.filter.value as '' | 'received' | 'sold' | 'given',
      };
    this.status.textContent = 'Beute wird geladen …';
    this.retry.hidden = true;
    this.more.disabled = true;
    try {
      const result = unwrap(await window.campaign.ledger(o!.token, query));
      if (!this.current(o) || request !== this.request) return;
      if (result.items.some((i) => i.characterId !== o!.id))
        throw Error('Beuteantwort gehört zu einer anderen Figur.');
      this.page =
        more && this.page ? { ...result, items: [...this.page.items, ...result.items] } : result;
      this.draw();
      this.status.textContent = '';
    } catch (e) {
      if (this.current(o) && request === this.request) {
        this.status.textContent = 'Beute nicht verfügbar: ' + (e as Error).message;
        this.retry.hidden = false;
      }
    } finally {
      if (this.current(o) && request === this.request) this.more.disabled = false;
    }
  }
  private draw() {
    this.list.replaceChildren();
    const p = this.page;
    if (!p) return;
    this.summary.textContent =
      'Kumulativ erhalten: ' +
      (p.totalCopper === null ? 'Wert nicht vollständig bekannt' : gold(p.totalCopper)) +
      ' · Käufe ausgeschlossen';
    for (const item of p.items) {
      const amount = ledgerCopper(item),
        b = node(
          'button',
          item.quantity +
            ' × ' +
            (item.currentName ?? item.name) +
            ' · ' +
            { received: 'Erhalten', sold: 'Verkauft', given: 'Weitergegeben' }[item.status] +
            (item.origin === 'purchase'
              ? ' · Gekauft'
              : item.origin === 'transfer'
                ? ' · Übernahme'
                : '') +
            ' · ' +
            (amount === null ? 'Wert unbekannt' : gold(amount.toString())),
        );
      b.type = 'button';
      b.dataset.ledgerId = item.id;
      b.title = item.id;
      if (item.sourceTitle) b.append(node('small', 'Fund: ' + item.sourceTitle));
      b.onclick = () => void this.choose(item.id);
      this.list.append(b);
    }
    for (const problem of p.problems) {
      const error = node('p', 'Eintrag nicht verfügbar: ' + problem.id + ' · ' + problem.message);
      error.className = 'error';
      this.list.append(error);
    }
    if (!p.items.length && !p.problems.length)
      this.list.textContent = 'Keine passenden persönlichen Beuteeinträge.';
    this.more.hidden = !p.next;
    this.lock();
  }
  private async choose(id: string) {
    const o = this.owner;
    if (!this.current(o) || this.writing) return;
    const request = ++this.detailRequest;
    this.selected = null;
    this.form.hidden = false;
    this.detailStatus.textContent = 'Eintrag wird geladen …';
    this.lock();
    try {
      const item = unwrap(await window.campaign.ledgerItem(o!.token, id));
      if (!this.current(o) || request !== this.detailRequest) return;
      if (item.id !== id || item.characterId !== o!.id)
        throw Error('Eintrag gehört nicht zur gewählten Figur.');
      this.selected = item;
      this.quantity.value = String(item.quantity);
      this.reason.value = '';
      this.price.value =
        item.actualSaleCopper === null ? '' : gold(item.actualSaleCopper).replace(' GM', '');
      this.priceLabel.hidden = item.status !== 'sold';
      this.facts.textContent = [
        item.currentName ?? item.name,
        item.sourceTitle ? 'Fund: ' + item.sourceTitle : '',
        item.provenance,
        item.counterparty,
        item.recordedAt,
        'ID ' + item.id,
      ]
        .filter(Boolean)
        .join(' · ');
      this.detailStatus.textContent =
        'Ändert den gespeicherten Eintrag mit nachvollziehbarem Grund. Der bisherige Stand bleibt im Verlauf.';
      this.lock();
    } catch (e) {
      if (this.current(o) && request === this.detailRequest) {
        this.detailStatus.textContent = 'Eintrag nicht verfügbar: ' + (e as Error).message;
        this.lock();
      }
    }
  }
  private async correct() {
    const o = this.owner,
      item = this.selected;
    if (!this.current(o) || !item || this.writing) return;
    const raw = this.quantity.value.trim(),
      quantity = Number(raw),
      reason = this.reason.value;
    if (
      !raw ||
      !Number.isSafeInteger(quantity) ||
      quantity < 0 ||
      quantity > 1000000 ||
      !reason.trim()
    ) {
      this.detailStatus.textContent = 'Nichtnegative ganze Gesamtmenge und einen Grund eingeben.';
      return;
    }
    if (item.status === 'sold' && !this.price.value.trim()) {
      this.detailStatus.textContent =
        'Tatsächlichen Gesamtverkaufspreis eingeben; unbekannt wird nicht zu null Gold.';
      return;
    }
    this.writing = true;
    this.lock();
    this.detailStatus.textContent = 'Berichtigung wird gespeichert …';
    try {
      await this.commit(
        o!.token,
        {
          kind: 'ledger',
          entryId: item.id,
          expectedRevision: item.revision,
          operation: 'correct',
          quantity: 0,
          correctedQuantity: quantity,
          actualGold: item.status === 'sold' ? this.price.value : '0',
          counterparty: item.counterparty,
          reason,
        },
        () => this.current(o),
      );
      if (!this.current(o)) return;
      this.selected = null;
      this.form.hidden = true;
    } catch (e) {
      if (this.current(o)) {
        this.detailStatus.textContent = (e as Error).message;
        this.recoverButton.hidden = false;
      }
    } finally {
      this.writing = false;
      if (this.current(o)) {
        this.lock();
        if (!this.selected) {
          await this.load();
          const history = this.root.querySelector<HTMLDetailsElement>('#party-loot-history');
          if (history?.open) await this.loadHistory();
        }
      }
    }
  }
  private async recoverBooking() {
    const o = this.owner,
      item = this.selected;
    if (!this.current(o) || !item || this.writing) return;
    this.writing = true;
    this.lock();
    try {
      await this.recover();
      if (!this.current(o)) return;
      const latest = unwrap(await window.campaign.ledgerItem(o!.token, item.id));
      if (!this.current(o)) return;
      if (latest.id !== item.id || latest.characterId !== o!.id)
        throw Error('Eintrag gehört nicht zur gewählten Figur.');
      if (latest.revision !== item.revision) {
        this.selected = null;
        this.form.hidden = true;
      } else
        this.detailStatus.textContent =
          'Status geprüft. Eingabe bleibt erhalten; Buchungsmeldung oben beachten.';
    } catch (e) {
      if (this.current(o)) this.detailStatus.textContent = (e as Error).message;
    } finally {
      this.writing = false;
      if (this.current(o)) {
        this.lock();
        if (!this.selected) {
          await this.load();
          if (this.root.querySelector<HTMLDetailsElement>('#party-loot-history')?.open)
            await this.loadHistory();
        }
      }
    }
  }
  private async loadHistory(more = false) {
    const o = this.owner;
    if (!this.current(o)) return;
    const request = ++this.historyRequest;
    try {
      const p = unwrap(
        await window.campaign.progressHistory(o!.token, o!.id, more ? this.history.next : null),
      );
      if (!this.current(o) || request !== this.historyRequest) return;
      this.history = more ? { items: [...this.history.items, ...p.items], next: p.next } : p;
      this.historyList.replaceChildren();
      for (const entry of this.history.items.filter(
        (e) => e.kind.startsWith('loot-') || e.kind === 'manual-loot',
      )) {
        const f = entry.facts,
          item = f.portion ?? f.entry ?? f.after,
          change =
            entry.kind === 'loot-correction'
              ? 'Menge ' + f.before?.quantity + ' → ' + f.after?.quantity
              : ((
                  {
                    'loot-sold': 'Verkauft',
                    'loot-given': 'Weitergegeben',
                    'manual-loot': 'Persönlich erhalten',
                    'loot-award': 'Beute erhalten',
                  } as Record<string, string>
                )[entry.kind] ?? entry.kind);
        this.historyList.append(
          node('p', [item?.name, change, f.reason, f.recordedAt].filter(Boolean).join(' · ')),
        );
      }
      if (!this.historyList.childElementCount)
        this.historyList.textContent = 'Auf dieser Seite keine Beuteänderungen.';
      this.historyMore.hidden = !p.next;
    } catch (e) {
      if (this.current(o) && request === this.historyRequest)
        this.historyList.textContent = 'Verlauf nicht verfügbar: ' + (e as Error).message;
    }
  }
}
