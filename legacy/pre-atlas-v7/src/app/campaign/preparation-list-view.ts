import type { ManualPlan } from '../../features/planner/manual-planner';
import type { NoteRow } from './note-data';
import type { LocationRow } from './preparation-contracts';

type ReadProjection<T> = T extends string | number | boolean | bigint | symbol | null | undefined
  ? T
  : T extends object
    ? { readonly [K in keyof T]: ReadProjection<T[K]> }
    : T;

type Surface = {
  document: Document;
  get<T extends HTMLElement = HTMLElement>(id: string): T;
};
/** DOM receives projections and named selection actions; it cannot change a
 * draft, acknowledge a command, or replace the confirmed preparation data. */
export class PreparationListView {
  constructor(private readonly surface: Surface) {}
  save(status: { open: boolean; blocked: boolean; unresolved: boolean }) {
    const { get } = this.surface;
    get('preparation-apply').hidden = !status.open || status.blocked;
    get('preparation-reconcile').hidden = !status.unresolved;
    get('preparation-refresh').hidden = !status.blocked;
  }
  problems(messages: readonly string[]) {
    const { get } = this.surface;
    const problems = [...new Set(messages)];
    get('preparation-problems').textContent = problems.join('\n');
    get('preparation-problems').hidden = !problems.length;
  }
  notes(
    input: {
      rows: readonly ReadProjection<NoteRow>[];
      selected: string | null;
      trash: boolean;
      error: string | null;
    },
    select: (id: string) => Promise<void>,
  ) {
    const { document, get } = this.surface,
      list = get('world-list');
    list.replaceChildren();
    if (input.error) {
      const message = document.createElement('p');
      message.setAttribute('role', 'alert');
      message.textContent = input.error;
      list.append(message);
      return;
    }
    for (const row of input.rows.filter((row) => row.trashed === input.trash)) {
      const button = document.createElement('button');
      button.textContent = row.note.title;
      if (row.searchPreview) {
        const preview = row.searchPreview,
          excerpt = document.createElement('small');
        excerpt.className = 'note-result-excerpt';
        excerpt.id = `note-result-${row.note.id}`;
        excerpt.append(`${preview.owner}: `);
        for (const part of preview.parts) {
          if (part.matched) {
            const mark = document.createElement('mark');
            mark.textContent = part.text;
            excerpt.append(mark);
          } else excerpt.append(part.text);
        }
        button.setAttribute('aria-label', row.note.title);
        button.setAttribute('aria-describedby', excerpt.id);
        button.append(excerpt);
      }
      button.setAttribute('aria-pressed', String(row.note.id === input.selected));
      button.onclick = () => {
        void select(row.note.id);
      };
      list.append(button);
    }
    if (!list.childNodes.length) {
      const message = document.createElement('p');
      message.textContent = 'Keine Einträge in dieser Auswahl.';
      list.append(message);
    }
  }
  plans(plans: readonly ReadProjection<ManualPlan>[], selected: string | null) {
    const { document, get } = this.surface,
      select = get<HTMLSelectElement>('plans');
    select.replaceChildren();
    for (const plan of plans) {
      const option = document.createElement('option');
      option.value = plan.id;
      option.textContent = plan.name || 'Unbenannter Plan';
      select.append(option);
    }
    select.value = selected ?? '';
  }
  planSaved(id: string, name: string) {
    const option = [...this.surface.get<HTMLSelectElement>('plans').options].find(
      (option) => option.value === id,
    );
    if (option) option.textContent = name || 'Unbenannter Plan';
  }
  scenes(
    input: {
      plan: ReadProjection<ManualPlan> | null | undefined;
      selected: string | null;
      query: string;
      locations: ReadonlyMap<string, string>;
      readAlouds: ReadonlyMap<string, string> | null;
    },
    select: (id: string) => Promise<void>,
  ) {
    const { document, get } = this.surface,
      list = get('scene-list');
    const terms = input.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let matches = 0,
      selectedVisible = false;
    list.replaceChildren();
    input.plan?.scenes.forEach((scene, index) => {
      const text = [
        scene.title,
        scene.notes,
        input.readAlouds?.get(scene.id) ?? '',
        scene.locationId ? (input.locations.get(scene.locationId) ?? '') : '',
      ]
        .join('\n')
        .toLocaleLowerCase();
      if (!terms.every((term) => text.includes(term))) return;
      matches++;
      if (scene.id === input.selected) selectedVisible = true;
      const button = document.createElement('button');
      button.textContent = `${index + 1}. ${scene.title || 'Unbenannte Szene'}`;
      button.setAttribute('aria-pressed', String(scene.id === input.selected));
      button.onclick = () => {
        void select(scene.id);
      };
      list.append(button);
    });
    get('scene-search-clear').hidden = !input.query;
    get('scene-search-status').textContent =
      matches +
      ' von ' +
      (input.plan?.scenes.length ?? 0) +
      ' Besuchen' +
      (!matches ? ' · Keine passenden Besuche.' : '') +
      (input.selected && !selectedVisible
        ? ' · Der ausgewählte Besuch bleibt im Editor geöffnet.'
        : '');
  }
  locations(
    input: {
      rows: readonly ReadProjection<LocationRow>[];
      selected: string | null;
      query: string;
      trash: boolean;
    },
    select: (id: string) => Promise<void>,
  ) {
    const { document, get } = this.surface,
      list = get('location-list'),
      needle = input.query.toLocaleLowerCase();
    list.replaceChildren();
    for (const row of input.rows.filter(
      (row) =>
        row.trashed === input.trash &&
        `${row.document.name} ${row.document.sections.map((section) => section.markdown).join('\n')}`
          .toLocaleLowerCase()
          .includes(needle),
    )) {
      const button = document.createElement('button');
      button.textContent = row.document.name;
      button.setAttribute('aria-pressed', String(row.document.id === input.selected));
      button.onclick = () => {
        void select(row.document.id);
      };
      list.append(button);
    }
  }
}
