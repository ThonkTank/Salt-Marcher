/** DOM composition only. The Hex owner keeps the sole Scene, route and position state. */
export interface LiveAtlasSurface {
  mount(map: HTMLElement, navigation: HTMLElement, console: HTMLElement): void;
  show(visible: boolean): void;
  unmount(): void;
  focus(): void;
}
let atlasSurface: LiveAtlasSurface | null = null;
export function setLiveAtlasSurface(surface: LiveAtlasSurface | null) {
  atlasSurface = surface;
}
export function liveHexSurface() {
  const get = (id: string) => document.getElementById(id)!;
  const writing = document.querySelector<HTMLElement>('.live-desk-writing')!;
  const tabs = document.createElement('div');
  tabs.id = 'live-center-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Szenenmitte');
  const scene = document.createElement('div');
  scene.id = 'live-center-scene';
  scene.setAttribute('role', 'tabpanel');
  scene.append(...writing.childNodes);
  const map = document.createElement('section');
  map.id = 'live-center-map';
  map.setAttribute('role', 'tabpanel');
  map.hidden = true;
  const toolbar = document.createElement('div');
  toolbar.id = 'live-center-tools';
  toolbar.append(tabs);
  writing.append(toolbar, scene, map);
  let center: 'scene' | 'map' = 'scene',
    docked = false,
    shared: LiveAtlasSurface | null = null;
  const sceneTab = document.createElement('button'),
    mapTab = document.createElement('button');
  for (const [button, id, label] of [
    [sceneTab, 'scene', 'Szene'],
    [mapTab, 'map', 'Karte'],
  ] as const) {
    button.type = 'button';
    button.id = 'live-center-' + id + '-tab';
    button.textContent = label;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', 'live-center-' + id);
    button.onclick = () => show(id);
    tabs.append(button);
    get('live-center-' + id).setAttribute('aria-labelledby', button.id);
  }
  const reference = document.querySelector<HTMLElement>('.live-desk-reference')!,
    panel = get('live-world-panel'),
    panelHome = document.createComment('world panel home');
  panel.before(panelHome);
  const toggle = get('live-travel-toggle');
  toolbar.append(toggle);
  const host = get('live-travel-host'),
    weather = document.createElement('details'),
    weatherTitle = document.createElement('summary');
  weather.id = 'live-travel-weather';
  weatherTitle.textContent = 'Wetter und Fristen';
  weather.append(weatherTitle);
  for (const child of [...panel.children])
    if (child !== host) {
      if (child.tagName === 'H3') child.remove();
      else weather.append(child);
    }
  weather.open = true;
  panel.append(host, weather);
  const open = document.createElement('button');
  open.type = 'button';
  open.id = 'live-travel-map-open';
  open.textContent = 'Karte öffnen';
  open.onclick = () => {
    show('map');
    if (shared) shared.focus();
    else get('world-map').focus({ preventScroll: true });
  };
  host.append(open);
  const canvas = get('world-map').closest<HTMLElement>('.world-map-canvas')!;
  const zoom = get('world-zoom-in').parentElement!,
    travel = get('world-travel-form').closest<HTMLElement>('.world-travel')!;
  const camera = [
    zoom,
    get('world-map').parentElement!.querySelector<HTMLElement>('.map-canvas-controls')!,
    get('travel-draft-status'),
    get('travel-place-cursor'),
  ];
  for (const node of camera.slice(0, 2)) node.classList.add('legacy-hex-camera');
  const navigation = document.createElement('details'),
    navigationTitle = document.createElement('summary');
  navigation.id = 'live-travel-navigation';
  navigationTitle.textContent = 'Kartenansicht und Gruppe platzieren';
  navigation.append(navigationTitle);
  host.append(navigation);
  const nodes = [
    get('world-map-select').closest<HTMLElement>('.world-map-selection')!,
    get('world-current'),
    get('world-map-modes'),
    travel,
  ];
  const homes = [...nodes, ...camera, canvas].map((node) => {
    const marker = document.createComment('hex surface home');
    node.before(marker);
    return { node, marker };
  });
  function paint() {
    scene.hidden = docked && center === 'map';
    map.hidden = !docked || center !== 'map';
    sceneTab.setAttribute('aria-selected', String(!scene.hidden));
    mapTab.setAttribute('aria-selected', String(!map.hidden));
    mapTab.disabled = !docked;
    open.hidden = !docked || center === 'map';
    writing.classList.toggle('live-map-center-open', !map.hidden);
    shared?.show(!map.hidden);
  }
  function show(next: 'scene' | 'map') {
    if (next === 'map' && !docked) return;
    center = next;
    paint();
  }
  paint();
  return {
    show,
    get center() {
      return center;
    },
    dock(on: boolean) {
      if (on !== docked) {
        docked = on;
        weather.open = !on;
        if (on) {
          reference.prepend(panel);
          panel.scrollTop = 0;
          host.append(...nodes, navigation);
          navigation.append(...camera);
          shared = atlasSurface;
          if (shared) shared.mount(map, navigation, host);
          else map.append(canvas);
        } else {
          shared?.unmount();
          shared = null;
          panelHome.before(panel);
          for (const { node, marker } of homes) marker.before(node);
        }
      }
      host.dataset.sharedAtlas = String(!!shared);
      host.classList.toggle('live-travel-owner', on);
      canvas.classList.toggle('live-hex-canvas', on);
      paint();
    },
    close() {
      center = 'scene';
      this.dock(false);
    },
  };
}
