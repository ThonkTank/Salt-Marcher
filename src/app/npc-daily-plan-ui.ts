import { rawDailyPlan, readDailyPlanRaw, readDailyOverridesRaw } from './npc-daily-plan';
import type { NpcDailyRaw, NpcDailyOverrideRaw } from './npc-daily-plan';
import type { FantasyCalendar } from './world-contracts';
import { calendarDate } from './world-model';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  return e;
};
export function drawNpcDailyPlan(
  input: HTMLInputElement,
  overrideInput: HTMLInputElement,
  calendar: FantasyCalendar,
  locations: { id: string; name: string }[] = [],
) {
  let root = document.getElementById('npc-daily-plan');
  if (!root) {
    root = node('section');
    root.id = 'npc-daily-plan';
    root.className = 'npc-daily-plan';
    input.parentElement!.after(root);
  }
  root.replaceChildren(
    node('h3', 'Wochenplan und Tagesausnahmen'),
    node(
      'p',
      'Uhrzeiten folgen dem Kampagnentag. Ein Ende vor dem Beginn reicht in den Folgetag. Wochentage beziehen sich auf den Beginn. Eine Datumsausnahme ersetzt den gesamten Tag, einschließlich Aktivitäten aus der vorherigen Nacht. Wohnhaus und Arbeitsplatz verwenden die bestehenden Stadtbindungen. Für Markt, Tempel oder einen Treffpunkt wähle einen festen Kampagnenort.',
    ),
  );
  let rows: NpcDailyRaw[], overrides: NpcDailyOverrideRaw[];
  try {
    rows = readDailyPlanRaw(input.value);
    overrides = readDailyOverridesRaw(overrideInput.value);
  } catch {
    root.append(
      node(
        'p',
        'Tagesplanentwurf kann nicht angezeigt werden. Rohtext bleibt erhalten; Entwurf bei Bedarf verwerfen.',
      ),
    );
    return;
  }
  const editable = (n: HTMLElement) =>
    n.isConnected &&
    !input.disabled &&
    !input.readOnly &&
    !overrideInput.disabled &&
    !overrideInput.readOnly;
  const sync = () => {
      input.value = JSON.stringify(rows);
      overrideInput.value = JSON.stringify(overrides);
    },
    emit = () => {
      sync();
      input.dispatchEvent(new Event('input', { bubbles: true }));
    },
    redraw = () => drawNpcDailyPlan(input, overrideInput, calendar, locations);
  const newSlot = () =>
    rawDailyPlan([
      {
        id: crypto.randomUUID(),
        startMinute: 480,
        endMinute: 1020,
        activity: 'Neue Aktivität',
        place: 'work',
        notes: '',
      },
    ])[0]!;
  const card = (slot: NpcDailyRaw, removeSlot: () => void, weekly: boolean) => {
    const row = node('fieldset'),
      legend = node('legend', slot.activity || 'Aktivität');
    row.dataset.dailySlot = slot.id;
    row.append(legend);
    const locationLabel = node('label', 'Kampagnenort'),
      location = node('select');
    location.dataset.dailyField = 'locationId';
    locationLabel.hidden = slot.place !== 'location';
    location.append(new Option('Ort wählen…', ''));
    for (const l of locations) location.append(new Option(l.name, l.id));
    if (slot.locationId && !locations.some((l) => l.id === slot.locationId))
      location.append(new Option('Nicht mehr verfügbar · ' + slot.locationId, slot.locationId));
    location.value = slot.locationId ?? '';
    location.oninput = () => {
      if (!editable(location)) return;
      slot.locationId = location.value;
      sync();
    };
    locationLabel.append(location);
    for (const [field, title] of [
      ['start', 'Von'],
      ['end', 'Bis'],
      ['activity', 'Aktivität'],
      ['place', 'Geplantes Ziel'],
      ['notes', 'Hinweise'],
    ] as const) {
      const label = node('label', title),
        control =
          field === 'place' ? node('select') : field === 'notes' ? node('textarea') : node('input');
      control.dataset.dailyField = field;
      if (control instanceof HTMLSelectElement)
        for (const [value, text] of [
          ['home', 'Wohnhaus'],
          ['work', 'Arbeitsplatz'],
          ['other', 'Anderer Ort / frei'],
          ['location', 'Fester Kampagnenort'],
        ] as const) {
          const option = node('option', text);
          option.value = value;
          control.append(option);
        }
      control.value = slot[field] ?? '';
      if (field === 'start' || field === 'end') {
        (control as HTMLInputElement).placeholder = '08:00';
        (control as HTMLInputElement).size = 7;
      }
      control.oninput = () => {
        if (!editable(control)) return;
        slot[field] = control.value as never;
        if (field === 'place') {
          if (slot.place !== 'location') delete slot.locationId;
          else slot.locationId = location.value;
          locationLabel.hidden = slot.place !== 'location';
        }
        sync();
        if (field === 'activity') legend.textContent = control.value || 'Aktivität';
      };
      label.append(control);
      row.append(label);
    }
    row.append(locationLabel);
    if (weekly) {
      const week = node('div'),
        every = node('input'),
        label = node('label', ' Jeden Tag'),
        choices = node('div');
      week.className = 'npc-daily-weekdays';
      every.type = 'checkbox';
      every.dataset.dailyEvery = 'true';
      every.checked = slot.weekdays === undefined;
      choices.hidden = every.checked;
      label.prepend(every);
      week.append(label, choices);
      calendar.weekdays.forEach((title, index) => {
        const choice = node('label', ' ' + title),
          box = node('input');
        box.type = 'checkbox';
        box.dataset.dailyWeekday = String(index);
        box.checked = slot.weekdays?.includes(index) ?? false;
        box.oninput = () => {
          if (!editable(box)) return;
          const selected = new Set(slot.weekdays ?? []);
          if (box.checked) selected.add(index);
          else selected.delete(index);
          slot.weekdays = [...selected].sort((a, b) => a - b);
          sync();
        };
        choice.prepend(box);
        choices.append(choice);
      });
      every.oninput = () => {
        if (!editable(every)) return;
        if (every.checked) delete slot.weekdays;
        else
          slot.weekdays = [...choices.querySelectorAll<HTMLInputElement>('input:checked')].map(
            (n) => Number(n.dataset.dailyWeekday),
          );
        choices.hidden = every.checked;
        sync();
      };
      row.append(week);
    }
    const remove = node('button', 'Aktivität entfernen');
    remove.type = 'button';
    remove.onclick = () => {
      if (!editable(remove)) return;
      removeSlot();
      emit();
      redraw();
    };
    row.append(remove);
    return row;
  };
  const base = node('div');
  base.id = 'npc-daily-base';
  for (const slot of rows)
    base.append(
      card(
        slot,
        () => {
          rows = rows.filter((s) => s !== slot);
        },
        true,
      ),
    );
  root.append(base);
  const add = node('button', 'Aktivität hinzufügen');
  add.id = 'npc-daily-add';
  add.type = 'button';
  add.disabled = rows.length >= 48;
  add.onclick = () => {
    if (!editable(add)) return;
    rows.push(newSlot());
    emit();
    redraw();
    document
      .querySelector<HTMLElement>('#npc-daily-base fieldset:last-of-type')
      ?.scrollIntoView({ block: 'center' });
  };
  root.append(
    add,
    node('h3', 'Datumsausnahmen / Ruhetage'),
    node(
      'p',
      'Kampagnentag 1 ist der erste Tag des Kampagnenkalenders. Eine Ausnahme ohne Aktivitäten ist ein vollständig freier Tag. Entfernen stellt den normalen Wochenplan wieder her.',
    ),
  );
  const exceptions = node('div');
  exceptions.id = 'npc-daily-overrides';
  overrides.forEach((exception, index) => {
    const section = node('section'),
      heading = node('h4', exception.label || 'Tagesausnahme'),
      dayLabel = node('label', 'Kampagnentag'),
      day = node('input'),
      nameLabel = node('label', 'Bezeichnung'),
      name = node('input'),
      date = node('p'),
      slots = node('div');
    section.dataset.dailyOverride = String(index);
    section.className = 'npc-daily-exception';
    day.dataset.overrideField = 'day';
    day.inputMode = 'numeric';
    day.value = exception.day;
    name.dataset.overrideField = 'label';
    name.value = exception.label;
    const showDate = () => {
      try {
        date.textContent =
          /^\d{1,12}$/.test(day.value) && BigInt(day.value) > 0n
            ? calendarDate(
                calendar,
                ((BigInt(day.value) - 1n) * BigInt(calendar.daySeconds) * 1000n).toString(),
              ).split(' · ')[0]!
            : 'Tag ab 1 eingeben.';
      } catch {
        date.textContent = 'Tag prüfen.';
      }
    };
    day.oninput = () => {
      if (!editable(day)) return;
      exception.day = day.value;
      sync();
      showDate();
    };
    name.oninput = () => {
      if (!editable(name)) return;
      exception.label = name.value;
      heading.textContent = name.value || 'Tagesausnahme';
      sync();
    };
    dayLabel.append(day);
    nameLabel.append(name);
    showDate();
    for (const slot of exception.slots)
      slots.append(
        card(
          slot,
          () => {
            exception.slots = exception.slots.filter((s) => s !== slot);
          },
          false,
        ),
      );
    const addSlot = node('button', 'Aktivität an diesem Tag hinzufügen'),
      remove = node('button', 'Tagesausnahme entfernen');
    addSlot.type = remove.type = 'button';
    addSlot.dataset.overrideAdd = 'true';
    addSlot.disabled = exception.slots.length >= 48;
    addSlot.onclick = () => {
      if (!editable(addSlot)) return;
      exception.slots.push(newSlot());
      emit();
      redraw();
    };
    remove.onclick = () => {
      if (!editable(remove)) return;
      overrides = overrides.filter((o) => o !== exception);
      emit();
      redraw();
    };
    section.append(heading, dayLabel, nameLabel, date, slots, addSlot, remove);
    exceptions.append(section);
  });
  root.append(exceptions);
  const addException = node('button', 'Ruhetag / Tagesausnahme hinzufügen');
  addException.id = 'npc-daily-override-add';
  addException.type = 'button';
  addException.disabled = overrides.length >= 64;
  addException.onclick = () => {
    if (!editable(addException)) return;
    overrides.push({ day: '', label: 'Ruhetag', slots: [] });
    emit();
    redraw();
    document
      .querySelector<HTMLElement>('#npc-daily-overrides section:last-child')
      ?.scrollIntoView({ block: 'center' });
  };
  root.append(addException);
}
