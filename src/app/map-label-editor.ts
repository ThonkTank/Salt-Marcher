import { validateMapLabelStyle, type MapLabelStyle } from './map-label-style';
export function mapLabelEditor(
  root: HTMLElement,
  prefix: string,
  style: MapLabelStyle | undefined,
  changed: () => void,
) {
  root.querySelector('#' + prefix + '-labels')?.remove();
  const details = document.createElement('details');
  details.id = prefix + '-labels';
  const title = document.createElement('summary');
  title.textContent = 'Beschriftung';
  details.append(title);
  const field = (title: string, id: string, value: string, type = 'number') => {
    const label = document.createElement('label'),
      input = document.createElement('input');
    label.textContent = title;
    input.id = prefix + '-label-' + id;
    input.type = type;
    input.step = 'any';
    input.value = value;
    input.oninput = changed;
    label.append(input);
    details.append(label);
    return input;
  };
  const rank = field(
    'Bedeutung (0–5, leer = automatisch)',
    'rank',
    style?.rank === undefined ? '' : String(style.rank),
  );
  rank.min = '0';
  rank.max = '5';
  rank.step = '1';
  field('Name ausblenden', 'hidden', '', 'checkbox').checked = style?.hidden ?? false;
  field('X in Kartenmetern (leer = automatisch)', 'x', style?.point ? String(style.point.x) : '');
  field('Y in Kartenmetern', 'y', style?.point ? String(style.point.y) : '');
  field(
    'Drehung in Grad (leer = automatisch)',
    'angle',
    style?.angle === undefined ? '' : String((style.angle * 180) / Math.PI),
  );
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Automatische Beschriftung';
  reset.onclick = () => {
    details.querySelectorAll('input').forEach((i) => {
      i.value = '';
      i.checked = false;
    });
    changed();
  };
  details.append(reset);
  root.append(details);
}
export function readMapLabelEditor(root: ParentNode, prefix: string): MapLabelStyle | undefined {
  const input = (id: string) => root.querySelector<HTMLInputElement>('#' + prefix + '-label-' + id),
    rank = input('rank');
  if (!rank) return undefined;
  const x = input('x')!.value,
    y = input('y')!.value,
    angle = input('angle')!.value;
  if ((x === '') !== (y === '')) throw Error('Beschriftungsposition benötigt X und Y.');
  const style: MapLabelStyle = {
    ...(rank.value === '' ? {} : { rank: Number(rank.value) }),
    ...(input('hidden')!.checked ? { hidden: true } : {}),
    ...(x === '' ? {} : { point: { x: Number(x), y: Number(y) } }),
    ...(angle === '' ? {} : { angle: (Number(angle) * Math.PI) / 180 }),
  };
  validateMapLabelStyle(style);
  return Object.keys(style).length ? style : undefined;
}
