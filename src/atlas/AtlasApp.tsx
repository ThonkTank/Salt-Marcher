import { ATLAS_VIEWS, scaleBar } from "./lod";
import { RiverPanel } from "./RiverPanel";
import { RegionPanel } from "./RegionPanel";
import { ParcelProperties } from "./ParcelProperties";
import { NumberField } from "./Fields";
import { PopulationPanel } from "./PopulationPanel";
import { EditorActions } from "./EditorActions";
import { ToolOptions, toolLabels, toolbarTools } from "./ToolOptions";
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
    regions,
    rivers,
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
    zoomToLevel,
    atlasLevel,
    floor,
    camera,
    lod,
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
                : "WELT GESTALTEN"}
          </div>
          {toolbarTools(interior).map((t) => (
            <button
              key={t}
              aria-pressed={tool === t}
              onClick={() => chooseTool(t)}
            >
              <span aria-hidden="true">{toolLabels[t].icon}</span>{" "}
              {toolLabels[t].label}
            </button>
          ))}
        </aside>
        <main className="atlas-map" ref={host}>
          <AtlasCanvas {...canvasProps} />
          <div className="atlas-map-help">
            <span>
              {tool === "road" || tool === "river"
                ? "Klicken: Punkt · Enter / Rechtsklick: Übernehmen"
                : tool === "area"
                  ? "Ziehen / Halten: Boden malen · Loslassen: Übernehmen"
                  : tool === "select"
                    ? "Klicken: Auswählen · Ziehen: Bearbeiten"
                    : "Ziehen: Zeichnen"}
            </span>
            <details>
              <summary>Hilfe</summary>
              {tool === "select" && (interior || lod.policy.exact) && (
                <p>
                  {interior
                    ? "Raum auswählen und ziehen: Raum bewegen. Türen und Treppen anklicken: Verbindung auswählen."
                    : "Haus oder Parzelle auswählen und doppelklicken: Innenraum öffnen."}
                </p>
              )}
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
              : `Atlas · ${ATLAS_VIEWS[atlasLevel].name}`}
          </div>
          {interior && !lod.policy.exact && (
            <div className="atlas-transition">
              Zum Innenbearbeiten auf mindestens 20 % zoomen.
            </div>
          )}
          {!interior && !lod.policy.exact && (
            <div className="atlas-overview-hint">
              {tool === "road" || tool === "river"
                ? "Straßenplanung · Detailbearbeitung ab 20 %"
                : "Übersicht · Doppelklick auf freie Karte zum Hineinzoomen"}
            </div>
          )}
          <div className="atlas-navigation">
            {!interior &&
              !lod.policy.detailBrushes &&
              ["area", "scenery", "water"].includes(tool) && (
                <span>
                  Lokales Detailwerkzeug · Für Küsten Land/Meer unter Höhen
                  wählen.
                </span>
              )}
            {!interior && !lod.policy.exact && (
              <button onClick={zoomToEdit}>Zum Bearbeiten hineinzoomen</button>
            )}
            {!interior && (
              <select
                aria-label="Ansichtsmaßstab"
                value={atlasLevel}
                onChange={(e) => zoomToLevel(Number(e.target.value))}
              >
                {ATLAS_VIEWS.map((v, i) => (
                  <option key={v.name} value={i}>
                    {v.name}
                  </option>
                ))}
              </select>
            )}
            <button onClick={fit}>Einpassen</button>
            <span className="atlas-scale">
              <span style={{ width: scaleBar(camera.scale).pixels }} />
              {scaleBar(camera.scale).label}
            </span>
            <span className="atlas-zoom">
              {camera.scale >= 0.064
                ? Math.round((camera.scale / 6.4) * 100)
                : Number(((camera.scale / 6.4) * 100).toPrecision(3))}{" "}
              %
            </span>
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
                <button onClick={leave}>Zur Atlasansicht</button>
              </>
            )}
          </div>
          {!reads.error &&
            (!reads.fresh ||
              fitPending ||
              (tool === "regions" && !regions.fresh && !regions.error) ||
              (tool === "river" && !rivers.fresh && !rivers.error)) && (
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
                tool === "river" ? (
                  <RiverPanel
                    editor={rivers}
                    disabled={
                      !rivers.fresh ||
                      !!session.pending ||
                      session.exclusive ||
                      session.uncertain
                    }
                  />
                ) : tool === "regions" ? (
                  <RegionPanel
                    editor={regions}
                    disabled={
                      !regions.fresh ||
                      !!session.pending ||
                      session.exclusive ||
                      session.uncertain
                    }
                  />
                ) : (
                  <ToolOptions {...toolOptionsProps} />
                )
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
              Betroffene Kartenobjekte:{" "}
              {deletion.stage.preview.deletedIds.length}.{" "}
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
