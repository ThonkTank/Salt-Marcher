import { sessionDay, restLabel } from './session-day';
import type { ManualPlan } from '../../features/planner/manual-planner';
import type { SessionAction, SessionProfile, SessionView } from '../campaign/session-contracts';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};
export class SessionDayPanel {
  private root = node('details');
  private version = 0;
  constructor(
    private apply: (action: SessionAction, current: () => boolean) => Promise<unknown>,
    private navigate: (id: string, current: () => boolean) => Promise<void>,
    private tell: (text: string, error?: boolean) => void,
  ) {
    this.root.id = 'session-day-plan';
    document.getElementById('session-panel')!.before(this.root);
  }
  reset() {
    this.version++;
    this.root.replaceChildren();
    this.root.hidden = true;
  }
  render(plan: ManualPlan, view: SessionView, profile: SessionProfile) {
    const version = ++this.version,
      current = () => version === this.version;
    this.root.hidden = false;
    this.root.replaceChildren(node('summary', 'Abenteuertag · Begegnungen und Rasten'));
    try {
      const day = sessionDay(plan, view, profile),
        summary = node('p');
      summary.id = 'session-day-budget';
      summary.setAttribute('role', 'status');
      summary.textContent =
        'Geplant: ' +
        day.plannedXp +
        ' angepasste XP' +
        (day.missingXp ? ' · ' + day.missingXp + ' Gegner ohne bekannte XP' : '') +
        (day.budget === null
          ? ' · Für einen Budgetvergleich fehlen bekannte Planungslevel.'
          : ' / ' +
            day.budget +
            ' Planungsbudget · ' +
            (day.remainingXp! >= 0
              ? day.remainingXp + ' XP übrig'
              : -day.remainingXp! + ' XP überschritten')) +
        '.';
      if (day.remainingXp !== null && day.remainingXp < 0) summary.className = 'error';
      const heading = this.root.querySelector('summary')!;
      heading.append(document.createTextNode(' · ' + summary.textContent));
      heading.className = summary.className;
      this.root.append(summary);
      if (day.budget !== null)
        this.root.append(
          node(
            'p',
            'Szenenziele: ' +
              day.allocatedXp +
              ' XP verteilt · ' +
              Math.max(0, day.budget - day.allocatedXp) +
              ' XP unverplant' +
              (day.allocatedXp > day.budget
                ? ' · ' + (day.allocatedXp - day.budget) + ' XP über dem Planungsbudget'
                : '') +
              ' · Tagesbudget ' +
              day.dayBudget +
              ' XP.',
          ),
        );
      if (!plan.scenes.length) {
        this.root.append(
          node(
            'p',
            'Szenen hinzufügen und gespeicherte Begegnungen anhängen. Rasten lassen sich anschließend zwischen zwei Szenen planen.',
          ),
        );
        return;
      }
      const table = node('table'),
        head = node('tr');
      table.id = 'session-day-table';
      for (const label of ['Szene', 'Begegnungen', 'Ziel-XP', 'Seit langer Rast'])
        head.append(node('th', label));
      table.append(head);
      for (const [index, row] of day.rows.entries()) {
        const tr = node('tr');
        tr.dataset.dayVisitId = row.scene.id;
        const title = node('td'),
          open = node('button', index + 1 + '. ' + (row.scene.title || 'Unbenannte Szene'));
        open.type = 'button';
        open.onclick = () => {
          if (current())
            void this.navigate(row.scene.id, current).catch((e) => this.tell(e.message, true));
        };
        title.append(open);
        tr.append(
          title,
          node(
            'td',
            row.groupCount
              ? row.assessment.adjustedXp +
                  ' XP · ' +
                  row.assessment.count +
                  ' Gegner · ' +
                  (row.assessment.difficulty ?? 'Level / XP offen')
              : 'Ohne Begegnung',
          ),
        );
        const allocation = node('td'),
          input = node('input'),
          save = node('button', 'Ziel übernehmen');
        input.type = 'number';
        input.min = '0';
        input.step = '1';
        input.placeholder = 'Kein Ziel';
        input.value = row.detail?.allocationXp === undefined ? '' : String(row.detail.allocationXp);
        input.setAttribute('aria-label', 'Ziel-XP ' + (row.scene.title || index + 1));
        save.type = 'button';
        save.onclick = () => {
          if (!current()) return;
          const raw = input.value.trim(),
            value = raw ? Number(raw) : null;
          if (value !== null && (!Number.isSafeInteger(value) || value < 0)) {
            this.tell('Szenenziel benötigt eine nichtnegative ganze XP-Zahl.', true);
            input.focus();
            return;
          }
          void this.apply(
            {
              kind: 'scene-planning',
              planId: plan.id,
              expectedPlanRevision: plan.revision,
              visitId: row.scene.id,
              expectedVisitRevision: row.detail?.revision ?? 0,
              allocationXp: value,
            },
            () => current() && save.isConnected,
          ).catch((e) => this.tell(e.message, true));
        };
        allocation.append(input, save);
        if (row.detail?.allocationXp !== undefined)
          allocation.append(
            node(
              'small',
              (row.assessment.adjustedXp - row.detail.allocationXp >= 0 ? '+' : '') +
                (row.assessment.adjustedXp - row.detail.allocationXp) +
                ' XP zum Szenenziel',
            ),
          );
        tr.append(
          allocation,
          node(
            'td',
            row.sinceLongXp + ' XP' + (day.dayBudget === null ? '' : ' / ' + day.dayBudget),
          ),
        );
        table.append(tr);
        const next = plan.scenes[index + 1];
        if (!next) continue;
        const gap = node('tr'),
          cell = node('td'),
          select = node('select');
        gap.className = 'session-day-gap';
        gap.dataset.afterVisitId = row.scene.id;
        cell.colSpan = 4;
        select.setAttribute('aria-label', 'Rast nach ' + (row.scene.title || index + 1));
        for (const [value, text] of [
          ['', 'Keine Rast'],
          ['short', 'Kurze Rast'],
          ['long', 'Lange Rast'],
        ]) {
          const option = node('option', text);
          option.value = value!;
          select.append(option);
        }
        select.value = row.rest?.kind ?? '';
        const write = (kind: 'short' | 'long' | null) =>
          this.apply(
            {
              kind: 'scene-planning',
              planId: plan.id,
              expectedPlanRevision: plan.revision,
              visitId: row.scene.id,
              expectedVisitRevision: row.detail?.revision ?? 0,
              rest: { beforeVisitId: next.id, kind },
            },
            () => current() && select.isConnected,
          );
        select.onchange = () => {
          if (current())
            void write(select.value ? (select.value as 'short' | 'long') : null).catch((e) =>
              this.tell(e.message, true),
            );
        };
        cell.append(node('span', 'Vor ' + (next.title || 'der nächsten Szene') + ': '), select);
        if (row.suggestion && !row.rest) {
          const suggest = node('button', restLabel(row.suggestion) + ' einplanen');
          suggest.type = 'button';
          suggest.onclick = () => {
            if (current())
              void write(row.suggestion as 'short' | 'long').catch((e) =>
                this.tell(e.message, true),
              );
          };
          cell.append(node('span', ' · Nach geplanter XP-Belastung erwägen: '), suggest);
        }
        gap.append(cell);
        table.append(gap);
      }
      const scroll = node('div');
      scroll.className = 'session-day-scroll';
      scroll.append(table);
      this.root.append(
        scroll,
        node(
          'p',
          'Rasten bleiben Planungshinweise und stehen auch in der GM-Mappe. Eine lange Rast beginnt einen neuen Tagesabschnitt; das gesamte Planungsbudget bleibt unverändert. Vorschläge folgen der XP-Belastung, nicht dem tatsächlichen Ressourcenverbrauch.',
        ),
      );
    } catch (error) {
      this.root.append(node('p', (error as Error).message));
    }
  }
}
