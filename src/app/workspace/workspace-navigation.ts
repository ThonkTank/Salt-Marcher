// Existing controls stay single instances with their original handlers and save boundaries.
export function syncWorkspaceNavigation() {
  const active = document.querySelector<HTMLButtonElement>(
    '#workspace-navigation button[aria-pressed="true"]',
  );
  const summary = document.getElementById('workspace-nav-summary');
  if (summary) summary.textContent = 'Bereiche · ' + (active?.textContent ?? 'Kampagne');
}
export function initWorkspaceNavigation() {
  const header = document.querySelector('header')!,
    tools = document.getElementById('workspace-tools') as HTMLDetailsElement;
  const content = document.getElementById('workspace-tools-content')!;
  for (const id of ['narrative-journal-open', 'location-notebook-open']) {
    const control = document.getElementById(id);
    if (control) content.append(control);
  }
  for (const id of ['quick-reference-open', 'location-material-return']) {
    const control = document.getElementById(id);
    if (control) header.insertBefore(control, tools);
  }
  const menu = document.getElementById('workspace-nav-menu') as HTMLDetailsElement;
  const narrow = window.matchMedia('(max-width: 850px)');
  const resize = () => {
    menu.open = document.body.classList.contains('atlas-workspace') || !narrow.matches;
  };
  narrow.addEventListener('change', resize);
  resize();
  menu.addEventListener('click', (event) => {
    if (narrow.matches && (event.target as Element).closest('button')) {
      menu.open = false;
      menu.querySelector('summary')!.focus();
    }
  });
  content.addEventListener('click', (event) => {
    if ((event.target as Element).closest('button')) tools.open = false;
  });
  document.addEventListener('pointerdown', (event) => {
    if (!tools.contains(event.target as Node)) tools.open = false;
    if (narrow.matches && !menu.contains(event.target as Node)) menu.open = false;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('dialog[open]'))
      return;
    for (const panel of [tools, ...(narrow.matches ? [menu] : [])])
      if (panel.open) {
        panel.open = false;
        panel.querySelector('summary')!.focus();
        event.preventDefault();
        break;
      }
  });
  const navigation = document.getElementById('workspace-navigation')!,
    focus = document.getElementById('live-focus-bar')!,
    footer = document.getElementById('music-mini')!;
  const measure = () => {
    const style = document.documentElement.style;
    const atlas = document.body.classList.contains('atlas-workspace');
    style.setProperty(
      '--workspace-header-height',
      (atlas
        ? document.querySelector('.atlas-command-bar')!.getBoundingClientRect().height
        : header.getBoundingClientRect().height) + 'px',
    );
    style.setProperty(
      '--workspace-nav-height',
      (!atlas && narrow.matches ? navigation.getBoundingClientRect().height : 0) + 'px',
    );
    style.setProperty('--live-focus-height', focus.getBoundingClientRect().height + 'px');
    style.setProperty(
      '--workspace-footer-height',
      (atlas ? 0 : footer.getBoundingClientRect().height) + 'px',
    );
  };
  const observer = new ResizeObserver(measure);
  for (const element of [header, navigation, focus, footer]) observer.observe(element);
  document.addEventListener('workspace-layout-changed', measure);
  narrow.addEventListener('change', measure);
  measure();
  syncWorkspaceNavigation();
}
