import { newRestockCatalog, renderRestockCatalog } from '../catalog/shop-restock-catalog-ui';
import type { ShopView } from '../catalog/items-contracts';
import { weightShares } from '../campaign/generation-contracts';

export function renderShopRestockTables(
  root: HTMLElement,
  view: ShopView,
  options: {
    api: Pick<Window['campaign'], 'itemDefinitions'>;
    changed: () => void;
    rebuild: () => void;
    button: (title: string, action: () => Promise<unknown> | void) => HTMLButtonElement;
    roll: (id: string) => Promise<void>;
  },
) {
  const document = root.ownerDocument;
  const section = document.createElement('section');
  section.className = 'session-group-card';
  const heading = document.createElement('h3');
  heading.textContent = 'Gewichtete Warenauffüllung';
  section.append(heading);
  const explanation = document.createElement('p');
  explanation.textContent =
    'Wähle bestehende Mengenstapel, Gewichte und Mengen je Ziehung. Ergebnisse werden zum Bestand hinzugefügt; Preise, Einzelstücke und andere Zeilen bleiben erhalten. Alternativ zieht eine Kataloglieferung neue passende Waren. Automatische Regeln verwenden bestätigte Kampagnenzeit.';
  section.append(explanation);
  root.append(section);
  const available = view.shop.stock.filter((e) => !e.unique);
  const add = options.button('Auffülltabelle anlegen', () => {
    view.shop.restockTables ??= [];
    view.shop.restockTables.push({
      id: crypto.randomUUID(),
      revision: 0,
      name: 'Neue Warenlieferung',
      seed: crypto.randomUUID(),
      rolls: 3,
      entries: available
        .slice(0, 1)
        .map((e) => ({ entryId: e.id, weight: '1', minimum: 1, maximum: 1 })),
      schedule: null,
    });
    options.changed();
    options.rebuild();
  });
  add.disabled = !available.length || view.unavailable;
  section.append(add);
  const addCatalog = options.button('Kataloglieferung anlegen', () => {
    view.shop.restockTables ??= [];
    view.shop.restockTables.push({
      id: crypto.randomUUID(),
      revision: 0,
      name: 'Neue Kataloglieferung',
      seed: crypto.randomUUID(),
      rolls: 3,
      entries: [],
      catalog: newRestockCatalog(),
      schedule: null,
    });
    options.changed();
    options.rebuild();
  });
  addCatalog.disabled = view.unavailable;
  section.append(addCatalog);
  if (!available.length) {
    const p = document.createElement('p');
    p.textContent = 'Zuerst einen Gegenstand als Mengenstapel zum Shop hinzufügen.';
    section.append(p);
  }
  for (const table of view.shop.restockTables ?? []) {
    const details = document.createElement('details');
    details.open = true;
    const summary = document.createElement('summary');
    summary.textContent = table.name + ' · Revision ' + table.revision;
    details.append(summary);
    section.append(details);
    const change = () => {
      if (table.schedule) table.schedule.nextDueMs = '0';
      options.changed();
    };
    const field = (
      parent: HTMLElement,
      title: string,
      value: string,
      type: string,
      update: (s: string) => void,
      changed = change,
    ) => {
      const label = document.createElement('label'),
        input = document.createElement('input');
      label.textContent = title;
      input.type = type;
      input.value = value;
      if (type === 'number') {
        input.min = '1';
        input.max = '1000000';
        input.step = '1';
      }
      input.oninput = () => {
        update(input.value);
        changed();
      };
      label.append(input);
      parent.append(label);
      return input;
    };
    const fields = document.createElement('div');
    fields.className = 'time-fields';
    details.append(fields);
    field(fields, 'Name', table.name, 'text', (v) => (table.name = v), options.changed);
    field(
      fields,
      'Ziehungen je Lieferung (1–100)',
      String(table.rolls),
      'number',
      (v) => (table.rolls = Number(v)),
    ).max = '100';
    field(fields, 'Zufallsbasis', table.seed, 'text', (v) => (table.seed = v));
    const sourceLabel = document.createElement('label'),
      source = document.createElement('select');
    sourceLabel.textContent = 'Warenquelle';
    source.setAttribute('aria-label', 'Warenquelle');
    sourceLabel.append(source);
    details.append(sourceLabel);
    for (const [value, title] of [
      ['stock', 'Gewichtete vorhandene Mengenstapel'],
      ['catalog', 'Gefilterter Gegenstandskatalog'],
    ]) {
      const o = document.createElement('option');
      o.value = value!;
      o.textContent = title!;
      source.append(o);
    }
    source.value = table.catalog ? 'catalog' : 'stock';
    source.options[0]!.disabled = !available.length;
    source.onchange = () => {
      table.catalog = source.value === 'catalog' ? newRestockCatalog() : null;
      table.entries = table.catalog
        ? []
        : available
            .slice(0, 1)
            .map((e) => ({ entryId: e.id, weight: '1', minimum: 1, maximum: 1 }));
      change();
      options.rebuild();
    };
    if (table.catalog)
      renderRestockCatalog(details, table.catalog, {
        api: options.api,
        changed: change,
        button: options.button,
      });
    else {
      let shares: string[] = [];
      try {
        shares = weightShares(table.entries.map((e) => e.weight));
      } catch {
        /* Invalid drafts remain editable. */
      }
      const entries = document.createElement('div');
      details.append(entries);
      for (const stock of available) {
        const row = document.createElement('fieldset'),
          legend = document.createElement('legend'),
          check = document.createElement('input'),
          label = document.createElement('label');
        check.type = 'checkbox';
        let entry = table.entries.find((e) => e.entryId === stock.id);
        check.checked = !!entry;
        label.append(
          check,
          document.createTextNode(
            view.items.find((d) => d.id === stock.reference.definitionId)?.name ?? 'Gegenstand',
          ),
        );
        legend.append(label);
        row.append(legend);
        entries.append(row);
        check.onchange = () => {
          if (check.checked)
            table.entries.push({ entryId: stock.id, weight: '1', minimum: 1, maximum: 1 });
          else table.entries = table.entries.filter((e) => e.entryId !== stock.id);
          change();
          options.rebuild();
        };
        if (!entry) continue;
        const selected = entry,
          index = table.entries.indexOf(selected),
          weights = field(
            row,
            'Gewicht' + (shares[index] ? ' · ' + shares[index] : ''),
            selected.weight,
            'text',
            (v) => (selected.weight = v),
          );
        weights.inputMode = 'decimal';
        field(
          row,
          'Mindestmenge je Treffer',
          String(selected.minimum),
          'number',
          (v) => (selected.minimum = Number(v)),
        );
        field(
          row,
          'Höchstmenge je Treffer',
          String(selected.maximum),
          'number',
          (v) => (selected.maximum = Number(v)),
        );
      }
    }
    const triggerLabel = document.createElement('label'),
      trigger = document.createElement('select');
    triggerLabel.textContent = 'Auslöser der Warenlieferung';
    trigger.setAttribute('aria-label', 'Auslöser der Warenlieferung');
    triggerLabel.append(trigger);
    details.append(triggerLabel);
    for (const [id, title] of [
      ['manual', 'Nur manuell'],
      ['interval', 'Nach verstrichener Kampagnenzeit'],
      ['event', 'Bei Beginn eines Kalenderereignisses'],
    ] as const) {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = title;
      trigger.append(o);
    }
    trigger.value = table.schedule
      ? 'eventId' in table.schedule
        ? 'event'
        : 'interval'
      : 'manual';
    trigger.onchange = () => {
      const e = view.restockEvents?.find((e) => !e.trashed);
      table.schedule =
        trigger.value === 'interval'
          ? { intervalMs: '86400000', nextDueMs: '0' }
          : trigger.value === 'event' && e
            ? { eventId: e.id, eventRevision: e.revision, repeatMs: e.repeatMs, nextDueMs: '0' }
            : null;
      change();
      options.rebuild();
    };
    if (!view.restockEvents?.some((e) => !e.trashed)) trigger.options[2]!.disabled = true;
    if (table.schedule && 'eventId' in table.schedule) {
      const schedule = table.schedule,
        events = view.restockEvents ?? [],
        event = events.find((e) => e.id === schedule.eventId),
        label = document.createElement('label'),
        select = document.createElement('select');
      label.textContent = 'Lieferereignis';
      select.setAttribute('aria-label', 'Lieferereignis');
      label.append(select);
      details.append(label);
      for (const e of events.filter((e) => !e.trashed || e.id === schedule.eventId)) {
        const o = document.createElement('option');
        o.value = e.id;
        o.textContent =
          e.name +
          (e.trashed ? ' · Papierkorb' : '') +
          (e.repeatMs ? ' · wiederkehrend' : ' · einmalig');
        select.append(o);
      }
      if (!event) {
        const o = document.createElement('option');
        o.value = schedule.eventId;
        o.textContent = 'Ereignis fehlt';
        select.append(o);
      }
      select.value = schedule.eventId;
      select.onchange = () => {
        const e = events.find((e) => e.id === select.value);
        if (!e || e.trashed) return;
        table.schedule = {
          eventId: e.id,
          eventRevision: e.revision,
          repeatMs: e.repeatMs,
          nextDueMs: '0',
        };
        change();
        options.rebuild();
      };
      const paused = !event || event.trashed || event.revision !== schedule.eventRevision,
        p = document.createElement('p');
      p.textContent = paused
        ? 'Lieferung pausiert: Ereignis fehlt, wurde geändert oder liegt im Papierkorb. Bindung erneuern oder anderes Ereignis wählen.'
        : schedule.nextDueMs === null
          ? 'Einmalige Lieferung abgeschlossen; kein weiterer Termin.'
          : schedule.nextDueMs === '0'
            ? 'Beim Speichern wird der erste Ereignisbeginn nach der gewählten Scenezeit gebunden.'
            : 'Nächster Ereignisbeginn: ' +
              schedule.nextDueMs +
              ' ms Kampagnenzeit · Ereignisrevision ' +
              schedule.eventRevision;
      if (paused) p.setAttribute('role', 'status');
      details.append(p);
      if (event && !event.trashed && paused)
        details.append(
          options.button('Ereignisbindung erneuern', () => {
            table.schedule = {
              eventId: event.id,
              eventRevision: event.revision,
              repeatMs: event.repeatMs,
              nextDueMs: '0',
            };
            change();
            options.rebuild();
          }),
        );
      const hint = document.createElement('p');
      hint.textContent =
        'Alle neuen Ereignisbeginne seit der Bindung werden bei bestätigtem Zeitfortschritt nachgeholt, unabhängig vom Gruppenort. Vergangene Termine werden beim Anlegen oder Erneuern übersprungen. Einmalige Termine liefern genau einmal.';
      details.append(hint);
    } else if (table.schedule) {
      const schedule = table.schedule;
      field(
        details,
        'Intervall in Tagen zu je 24 Stunden',
        String(Number(schedule.intervalMs) / 86400000),
        'number',
        (v) => {
          const days = Number(v);
          schedule.intervalMs =
            Number.isSafeInteger(days) && days > 0 ? (BigInt(days) * 86400000n).toString() : v;
        },
      );
      const due = document.createElement('p');
      due.textContent =
        schedule.nextDueMs === '0'
          ? 'Erste Fälligkeit wird beim Speichern aus der gewählten Scenezeit berechnet.'
          : 'Nächste Fälligkeit: ' + schedule.nextDueMs + ' ms Kampagnenzeit';
      details.append(due);
    }
    if (!view.restockEvents?.some((e) => !e.trashed)) {
      const p = document.createElement('p');
      p.textContent =
        'Für einen Ereignisauslöser zuerst in der Agenda einen Termin anlegen und den Shop neu öffnen.';
      details.append(p);
    }
    const actions = document.createElement('div');
    actions.className = 'toolbar';
    const roll = options.button('Jetzt Warenlieferung würfeln', () => options.roll(table.id));
    roll.disabled = view.unavailable;
    actions.append(
      roll,
      options.button('Tabelle entfernen', () => {
        view.shop.restockTables = view.shop.restockTables!.filter((t) => t.id !== table.id);
        options.changed();
        options.rebuild();
      }),
    );
    details.append(actions);
  }
}
