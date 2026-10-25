import type { UpdateStatus } from './update-contracts';
import type { Result } from './contracts';
const unwrap = <T>(r: Result<T>) => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
export function initUpdateUI(beforeInstall: () => Promise<boolean>) {
  const api = window.campaign;
  if (!api.updateStatus) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'updates-dialog';
  dialog.setAttribute('aria-labelledby', 'updates-heading');
  dialog.innerHTML =
    '<h2 id="updates-heading">Updates</h2><p id="updates-version"></p><label><input id="updates-automatic" type="checkbox"> Automatisch nach Updates suchen</label><p id="updates-last"></p><p id="updates-message" role="status" aria-live="polite"></p><progress id="updates-progress" hidden></progress><pre id="updates-notes"></pre><section id="updates-force-confirmation" aria-labelledby="updates-force-heading" hidden><h3 id="updates-force-heading">Ungespeicherte Eingaben verwerfen?</h3><p>Noch nicht gesicherte Eingaben können verloren gehen. Bereits gespeicherte Daten und gesicherte Arbeitsentwürfe bleiben erhalten und werden vor dem Update gesichert.</p><div class="actions"><button id="updates-force-back">Zurück</button><button id="updates-force-confirm">Ungespeicherte Eingaben verwerfen und aktualisieren</button></div></section><div class="actions"><button id="updates-check">Nach Updates suchen</button><button id="updates-download" hidden>Herunterladen</button><button id="updates-cancel" hidden>Download abbrechen</button><button id="updates-install" hidden>Installieren und neu starten</button><button id="updates-force" hidden>Trotzdem aktualisieren…</button><button id="updates-close">Schließen</button></div>';
  document.body.append(dialog);
  const get = <T extends HTMLElement>(id: string) => dialog.querySelector<T>('#updates-' + id)!;
  const banner = document.createElement('button');
  banner.id = 'update-notice';
  banner.hidden = true;
  banner.type = 'button';
  document.querySelector('header')?.append(banner);
  let latest: UpdateStatus | null = null,
    installStep: 'saving' | 'installing' | null = null,
    feedback: string | null = null,
    focus: HTMLElement | null = null;
  let failedPreparationVersion: string | null = null,
    confirming = false;
  const installing = () => installStep !== null || latest?.phase === 'installing';
  const canForce = () =>
    !installing() &&
    latest?.phase === 'ready' &&
    failedPreparationVersion !== null &&
    failedPreparationVersion === latest.available?.version;
  const resetFeedback = () => {
    feedback = null;
    failedPreparationVersion = null;
    confirming = false;
  };
  function render(s: UpdateStatus) {
    latest = s;
    const busy = installing();
    if (!canForce()) confirming = false;
    get('version').textContent =
      'Installiert: ' +
      s.currentVersion +
      (s.available ? ' · Verfügbar: ' + s.available.version : '');
    get<HTMLInputElement>('automatic').checked = s.automatic;
    get('last').textContent = s.lastChecked
      ? 'Zuletzt geprüft: ' + new Date(s.lastChecked).toLocaleString('de-DE')
      : 'Noch nicht geprüft.';
    get('message').textContent =
      installStep === 'saving'
        ? 'Neustart wird vorbereitet…'
        : (feedback ??
          (installStep === 'installing' && s.phase !== 'installing'
            ? 'Installation wird vorbereitet. SaltMarcher startet anschließend neu…'
            : s.message));
    get('notes').textContent = s.available?.notes ?? '';
    const running = ['checking', 'downloading', 'installing'].includes(s.phase);
    get<HTMLButtonElement>('check').disabled =
      busy || confirming || running || s.phase === 'unsupported';
    get('download').hidden = busy || !s.available || s.phase === 'ready' || running;
    get('install').hidden = !busy && s.phase !== 'ready';
    get('cancel').hidden = s.phase !== 'downloading';
    get<HTMLButtonElement>('install').disabled = busy || confirming;
    get('install').textContent =
      installStep === 'saving'
        ? 'Wird vorbereitet…'
        : busy
          ? 'Installation läuft…'
          : 'Installieren und neu starten';
    get<HTMLButtonElement>('download').disabled = busy || confirming;
    get<HTMLButtonElement>('close').disabled = busy;
    get<HTMLInputElement>('automatic').disabled = busy || confirming || s.phase === 'unsupported';
    get('force').hidden = !canForce() || confirming;
    get('force-confirmation').hidden = !confirming;
    get<HTMLButtonElement>('force-confirm').disabled = !confirming;
    const progress = get<HTMLProgressElement>('progress');
    progress.hidden = !busy && s.phase !== 'downloading';
    progress.setAttribute('aria-label', busy ? 'Installation läuft' : 'Downloadfortschritt');
    progress.max = s.total || 1;
    if (busy) progress.removeAttribute('value');
    else progress.value = s.received;
    banner.hidden = !s.available;
    banner.textContent = s.phase === 'ready' ? 'Update bereit' : 'Update verfügbar';
  }
  const run = async (action: () => Promise<Result<UpdateStatus>>) => {
    try {
      render(unwrap(await action()));
    } catch (e) {
      feedback = (e as Error).message;
      if (latest) render(latest);
      else get('message').textContent = feedback;
    }
  };
  function open() {
    focus = document.activeElement as HTMLElement;
    if (!dialog.open) dialog.showModal();
    void run(() => api.updateStatus());
  }
  banner.onclick = open;
  document.addEventListener('saltmarcher-open-updates', open);
  get('check').onclick = () => {
    resetFeedback();
    void run(() => api.updateCheck());
  };
  get('download').onclick = () => {
    resetFeedback();
    void run(() => api.updateDownload());
  };
  get('cancel').onclick = () => {
    resetFeedback();
    void run(() => api.updateCancel());
  };
  get<HTMLInputElement>('automatic').onchange = () => {
    resetFeedback();
    void run(() => api.updateAutomatic(get<HTMLInputElement>('automatic').checked));
  };
  function cancelConfirmation() {
    confirming = false;
    if (latest) render(latest);
    get('force').focus();
  }
  get('close').onclick = () => {
    if (installing()) return;
    confirming = false;
    if (latest) render(latest);
    dialog.close();
    focus?.focus();
  };
  dialog.oncancel = (e) => {
    if (installing()) e.preventDefault();
    else if (confirming) {
      e.preventDefault();
      cancelConfirmation();
    }
  };
  function install(force = false) {
    if (
      installing() ||
      latest?.phase !== 'ready' ||
      (force ? !confirming || !canForce() : confirming)
    )
      return;
    const version = latest.available?.version ?? null;
    resetFeedback();
    installStep = force ? 'installing' : 'saving';
    render(latest);
    void (async () => {
      try {
        if (!force && !(await beforeInstall()))
          throw new Error(
            'Installation nicht gestartet. Der Arbeitszustand konnte nicht abgeschlossen werden. Schließe diesen Dialog und prüfe die Meldung im Arbeitsbereich.',
          );
        installStep = 'installing';
        if (latest) render(latest);
        // Forced continuation only skips renderer preparation. Main still drains
        // file operations and uses the same verified package/backup transaction.
        unwrap(await api.updateInstall());
        // A successful handoff ends this process. Keep the acknowledgement visible
        // and prevent a second request until the window actually closes.
      } catch (e) {
        if (installStep === 'saving') failedPreparationVersion = version;
        installStep = null;
        feedback = (e as Error).message;
        if (latest) render(latest);
      }
    })();
  }
  get('install').onclick = () => install();
  get('force').onclick = () => {
    if (!canForce()) return;
    confirming = true;
    if (latest) render(latest);
    get('force-back').focus();
  };
  get('force-back').onclick = cancelConfirmation;
  get('force-confirm').onclick = () => install(true);
  const unsubscribe = api.onUpdate(render);
  window.addEventListener('unload', unsubscribe, { once: true });
  void run(() => api.updateStatus());
}
export function openUpdates() {
  document.dispatchEvent(new Event('saltmarcher-open-updates'));
}
