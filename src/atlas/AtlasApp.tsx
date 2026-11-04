import { ParcelProperties } from "./ParcelProperties";
import { NumberField } from "./Fields";
import { PopulationPanel } from "./PopulationPanel";
import { EditorActions } from "./EditorActions";
import { ToolOptions, labels } from "./ToolOptions";
import type { Tool } from "./editorSelection";
import { Inspector } from "./Inspector";
import { Modal } from "../Modal";
import { AtlasClient } from "./client";
import { AtlasCanvas } from "./AtlasCanvas";
import { useAtlasEditor } from "./useAtlasEditor";
import "./atlas.css";
const desktop = new AtlasClient();
export default function AtlasApp({
  client = desktop,
}: {
  client?: AtlasClient;
}) {
  const {
    view,
    actions,
    populationProps,
    session,
    parcelProperties,
    excludedParcels,
    selectPlanParcel,
    deletion,
    changeContext,
    context,
    interior,
    tool,
    chooseTool,
    host,
    hoverReason,
    plannedAction,
    house,
    presentation,
    zoomToEdit,
    floor,
    camera,
    fit,
    history,
    selectEvent,
    leave,
    reads,
    fitPending,
    workflowError,
    preview,
    canAccept,
    workflow,
    canvasProps,
    toolOptionsProps,
    inspectorProps,
  } = useAtlasEditor(client);
  return (
    <div className="atlas-app">
      <header className="atlas-header" inert={session.exclusive || !!deletion}>
        <strong>
          SaltMarcher <small>ATLAS V7</small>
        </strong>
        <button onClick={() => void session.document("new")}>Neu</button>
        <button onClick={() => void session.document("open")}>Öffnen</button>
        <button onClick={() => void session.document("save")}>Speichern</button>
        <button onClick={() => void session.document("saveAs")}>
          Speichern unter
        </button>
        <span className="atlas-document">
          {session.status?.dirty ? "● " : ""}
          {session.status?.path?.split(/[\\/]/).pop() ?? "Unbenannter Atlas"}
        </span>
        <button
          disabled={!session.status?.canUndo || session.exclusive}
          onClick={() => history(false)}
        >
          Rückgängig
        </button>
        <button
          disabled={!session.status?.canRedo || session.exclusive}
          onClick={() => history(true)}
        >
          Wiederholen
        </button>
      </header>
      <div className="atlas-workspace" inert={session.exclusive || !!deletion}>
        <aside className="atlas-tools">
          <div className="eyebrow">
            {context.kind === "parcel"
              ? "IN DER PARZELLE"
              : interior
                ? "IM GEBÄUDE"
                : "DORF GESTALTEN"}
          </div>
          {(interior
            ? ["select", "draw", "erase", "assign", "opening", "stairs"]
            : ["select", "road", "area", "house"]
          ).map((t) => (
            <button
              key={t}
              aria-pressed={tool === t}
              onClick={() => chooseTool(t as Tool)}
            >
              <span aria-hidden="true">
                {
                  {
                    select: "↖",
                    road: "↝",
                    area: "▧",
                    house: "⌂",
                    draw: "▱",
                    erase: "⌫",
                    assign: "⇥",
                    opening: "⊓",
                    stairs: "▥",
                  }[t]
                }
              </span>{" "}
              {labels[t as Tool]}
            </button>
          ))}
        </aside>
        <main className="atlas-map" ref={host}>
          <AtlasCanvas {...canvasProps} />
          <div className="atlas-map-help">
            <span>
              {tool === "road"
                ? "Klicken: Punkt · Enter / Rechtsklick: Übernehmen"
                : tool === "area"
                  ? "Klicken: Eckpunkt · Enter / Rechtsklick: Übernehmen"
                  : tool === "select"
                    ? "Klicken: Auswählen · Ziehen: Bearbeiten"
                    : "Ziehen: Zeichnen"}
            </span>
            <details>
              <summary>Hilfe</summary>
              <p>
                Mittlere Maustaste oder Leertaste + Ziehen: Karte bewegen ·
                Mausrad: Zoom · Escape: Abbrechen
              </p>
            </details>
          </div>
          {hoverReason && plannedAction && (
            <div
              className="atlas-hover"
              style={{
                left: hoverReason.point[0] + 12,
                top: hoverReason.point[1] + 12,
              }}
            >
              {hoverReason.reason}
            </div>
          )}
          <div className="atlas-map-title">
            {interior
              ? `${house?.name ?? (context.kind === "parcel" ? "Leere Parzelle" : "Gebäude")} · Geschoss ${presentation?.floor ?? floor}`
              : "Atlas · Stadtkarte"}
          </div>
          {interior && camera.scale < 1.28 && (
            <div className="atlas-transition">
              Zum Innenbearbeiten auf mindestens 20 % zoomen.
            </div>
          )}
          {!interior && camera.scale < 1.28 && (
            <div className="atlas-overview-hint">
              Stadtübersicht · Doppelklick zum Hineinzoomen
            </div>
          )}
          <div className="atlas-navigation">
            {!interior && camera.scale < 1.28 && (
              <button onClick={zoomToEdit}>Zum Bearbeiten hineinzoomen</button>
            )}
            <button onClick={fit}>Einpassen</button>
            <span>{Number(((camera.scale / 6.4) * 100).toPrecision(3))} %</span>
            {interior && (
              <>
                <button
                  onClick={() => {
                    selectEvent({ type: "stepFloor", delta: -1 });
                  }}
                >
                  Geschoss −
                </button>
                <NumberField
                  label="Geschoss"
                  value={floor}
                  onChange={(floor) => {
                    selectEvent({ type: "changeFloor", floor });
                  }}
                />
                <button
                  onClick={() => {
                    selectEvent({ type: "stepFloor", delta: 1 });
                  }}
                >
                  Geschoss +
                </button>
                <button onClick={leave}>Zur Dorfansicht</button>
              </>
            )}
          </div>
          {!reads.error && (!reads.fresh || fitPending) && (
            <div className="atlas-transition atlas-readiness">
              Ansicht wird geladen …
            </div>
          )}
          {reads.error && (
            <div className="atlas-transition">
              {reads.error}
              <button onClick={reads.retry}>Erneut laden</button>
            </div>
          )}
        </main>
        {view.panel === "objects" ? (
          <details className="atlas-object-drawer">
            <summary>Objekte</summary>
            <aside className="atlas-inspector">
              <Inspector {...inspectorProps} />
            </aside>
          </details>
        ) : (
          <aside
            className="atlas-inspector"
            aria-label={
              view.panel === "parcel"
                ? "Parzelleneinstellungen"
                : view.panel === "tool"
                  ? "Werkzeugeinstellungen"
                  : "Eigenschaften"
            }
          >
            <div className="atlas-panel-content">
              {view.panel === "parcel" && parcelProperties ? (
                <ParcelProperties {...parcelProperties} />
              ) : view.panel === "population" ? (
                <PopulationPanel {...populationProps} />
              ) : view.panel === "tool" ? (
                <ToolOptions {...toolOptionsProps} />
              ) : (
                <Inspector
                  {...inspectorProps}
                  parcelEditor={
                    parcelProperties ? (
                      <ParcelProperties {...parcelProperties} />
                    ) : undefined
                  }
                />
              )}
              {(view.panel === "tool" || view.panel === "population") &&
                !!excludedParcels.length && (
                  <details>
                    <summary>
                      Ausgelassene Parzellen ({excludedParcels.length})
                    </summary>
                    {excludedParcels.map((p, i) => (
                      <button
                        key={p.key}
                        onClick={() => selectPlanParcel(p.key)}
                      >
                        Parzelle {i + 1} bearbeiten
                      </button>
                    ))}
                  </details>
                )}
            </div>
            <EditorActions {...actions} />
          </aside>
        )}
      </div>
      {deletion && (
        <Modal title="Objekt löschen" onClose={changeContext}>
          {!("preview" in deletion.stage) || !deletion.stage.preview.valid ? (
            <p>Löschung wird vollständig geprüft …</p>
          ) : (
            <p>
              {deletion.stage.preview.cascadeCounts.roads} Straßen ·{" "}
              {deletion.stage.preview.cascadeCounts.parcels} Parzellen ·{" "}
              {deletion.stage.preview.cascadeCounts.houses} Häuser ·{" "}
              {deletion.stage.preview.cascadeCounts.rooms} Räume ·{" "}
              {deletion.stage.preview.cascadeCounts.connections} Verbindungen
              löschen?
            </p>
          )}
          {(workflowError || preview?.reason) && (
            <p>{workflowError || preview?.reason}</p>
          )}
          {(deletion.stage.phase === "stale" ||
            deletion.stage.phase === "failed") && (
            <button onClick={() => void workflow.controller.recheck()}>
              Vorschau erneut prüfen
            </button>
          )}
          <button
            className="text-danger"
            disabled={!canAccept}
            onClick={() => void workflow.controller.accept(true)}
          >
            Löschen bestätigen
          </button>
          <button onClick={changeContext}>Abbrechen</button>
        </Modal>
      )}
      {session.unsaved && (
        <Modal
          title={
            session.unsaved.unavailable
              ? "Verbindung zum Dokument unterbrochen"
              : "Ungespeicherte Änderungen"
          }
          onClose={() => session.unsaved?.resolve("cancel")}
        >
          <p>
            {session.unsaved.unavailable
              ? "Der Dokumentstand ist nicht erreichbar. Ungespeicherte Änderungen können beim Schließen verloren gehen. Trotzdem schließen?"
              : "Änderungen vor dem Fortfahren speichern?"}
          </p>
          {!session.unsaved.unavailable && (
            <button onClick={() => session.unsaved?.resolve("save")}>
              Speichern und fortfahren
            </button>
          )}
          <button onClick={() => session.unsaved?.resolve("discard")}>
            {session.unsaved.unavailable ? "Trotzdem schließen" : "Verwerfen"}
          </button>
          <button onClick={() => session.unsaved?.resolve("cancel")}>
            Abbrechen
          </button>
        </Modal>
      )}
      <footer
        className="atlas-status"
        role="status"
        aria-label="Dokumentstatus"
      >
        {session.error ||
          (session.pending && !actions.committing
            ? "Änderung wird übernommen …"
            : session.exclusive
              ? "Dateivorgang …"
              : "Außen frei · Innenraster 5 Fuß")}
        {session.error && (
          <button onClick={() => session.setError("")}>Schließen</button>
        )}
        {session.uncertain && (
          <button onClick={() => void session.reconcile()}>
            Sitzung erneut laden
          </button>
        )}
      </footer>
    </div>
  );
}
