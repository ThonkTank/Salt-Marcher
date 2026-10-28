import { GROUP_PROFILES, type GroupRecipe } from './room-group-contracts';
import { generateRoomGroup } from './room-group-generator';
import { atlasFieldValue, setAtlasFieldValue } from './atlas-units';
import { dungeonSvg } from './drawing-model';
/** A local preview never writes. Main regenerates from the accepted recipe. */
export function chooseRoomGroup(
  initial: GroupRecipe,
  allowEmpty = false,
): Promise<GroupRecipe | 'empty' | null> {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'room-group-dialog';
    dialog.setAttribute('aria-label', 'Raumgruppe erzeugen');
    dialog.innerHTML =
      '<form method="dialog"><h2>Raumgruppe erzeugen</h2><div class="group-recipe-fields"><label>Art<select name="profile"></select></label><label>Breite in m<input id="room-group-width" name="width" type="number" min="3" max="80" step="any"></label><label>Tiefe in m<input id="room-group-depth" name="depth" type="number" min="3" max="80" step="any"></label><label>Geschosse<select name="floors"><option value="">Passend zur Art</option>' +
      [1, 2, 3, 4, 5, 6].map((n) => '<option>' + n + '</option>').join('') +
      '</select></label><label>Keller<select name="basement"><option value="">Passend zur Art</option><option value="yes">Mit Keller</option><option value="no">Ohne Keller</option></select></label><label>Zufallsstartwert<input name="seed" maxlength="200" required></label></div><div class="toolbar"><button type="button" data-reroll>Neu würfeln</button><label>Vorschaugeschoss<select name="previewFloor"></select></label></div><p role="status"></p><div class="group-preview"></div><div class="toolbar"><button value="cancel" formnovalidate>Abbrechen</button>' +
      (allowEmpty ? '<button value="empty" formnovalidate>Leer beginnen</button>' : '') +
      '<button value="accept">Übernehmen</button></div></form>';
    const input = (name: string) =>
      dialog.querySelector<HTMLInputElement | HTMLSelectElement>('[name="' + name + '"]')!;
    const profile = input('profile');
    for (const name of GROUP_PROFILES) {
      const o = document.createElement('option');
      o.textContent = name;
      profile.append(o);
    }
    for (const name of ['profile', 'seed'] as const) input(name).value = String(initial[name]);
    for (const name of ['width', 'depth'] as const) setAtlasFieldValue(input(name), initial[name]);
    input('floors').value = String(initial.floors ?? '');
    input('basement').value = initial.basement === undefined ? '' : initial.basement ? 'yes' : 'no';
    let recipe: GroupRecipe | null = null;
    const preview = () => {
      try {
        recipe = {
          version: 1,
          profile: input('profile').value as GroupRecipe['profile'],
          width: Number(atlasFieldValue(input('width'))),
          depth: Number(atlasFieldValue(input('depth'))),
          seed: input('seed').value,
          ...(input('floors').value ? { floors: Number(input('floors').value) } : {}),
          ...(input('basement').value ? { basement: input('basement').value === 'yes' } : {}),
        };
        const draft = generateRoomGroup('preview', recipe),
          select = input('previewFloor') as HTMLSelectElement,
          previous = select.value;
        select.replaceChildren();
        for (const f of draft.floors) {
          const o = document.createElement('option');
          o.value = f.id;
          o.textContent = f.name;
          select.append(o);
        }
        select.value = draft.floors.some((f) => f.id === previous) ? previous : 'ground';
        dialog.querySelector('.group-preview')!.innerHTML = dungeonSvg(
          draft.rooms,
          { elements: draft.elements, styles: [], hiddenRooms: [], hiddenFloors: [], features: [] },
          'preview',
          select.value,
          false,
        );
        dialog.querySelector('[role=status]')!.textContent =
          draft.rooms.length +
          ' Räume · ' +
          draft.floors.length +
          ' Ebenen · ' +
          draft.elements.filter((e) => e.kind === 'object').length +
          ' Einrichtungsobjekte. Alle Teile bleiben bearbeitbar.';
        dialog.querySelector<HTMLButtonElement>('[value=accept]')!.disabled = false;
      } catch (e) {
        recipe = null;
        dialog.querySelector('[role=status]')!.textContent = (e as Error).message;
        dialog.querySelector<HTMLButtonElement>('[value=accept]')!.disabled = true;
      }
    };
    dialog.addEventListener('input', preview);
    input('previewFloor').addEventListener('change', preview);
    dialog.querySelector('[data-reroll]')!.addEventListener('click', () => {
      input('seed').value = crypto.randomUUID().slice(0, 8);
      preview();
    });
    dialog.addEventListener(
      'close',
      () => {
        const value = dialog.returnValue;
        dialog.remove();
        resolve(value === 'accept' ? recipe : value === 'empty' ? 'empty' : null);
      },
      { once: true },
    );
    document.body.append(dialog);
    dialog.showModal();
    preview();
  });
}
