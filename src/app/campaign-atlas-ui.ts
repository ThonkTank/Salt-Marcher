import {atlasElement as get} from './atlas-dom';
import {AtlasAuthor} from './atlas-author';
import {AtlasDrawing} from './atlas-drawing';
import type {AtlasFamily as Family} from './atlas-workbench-types';
import {AtlasRegions} from './atlas-regions';
import {AtlasJourney} from './atlas-journey';
import {AtlasOutput} from './atlas-output';

import {atlasWorkplaneData,type AtlasWorkplane} from './atlas-workplane';

import {TerrainAnalysisUI,editEntranceHeight} from './terrain-analysis-ui';
import {TerrainPresentation,interactiveTerrainFrame,type TerrainIdentity} from './terrain-presentation';
import {terrainTraceStart} from './terrain-timing';
import {BrushSizeControl} from './atlas-brush-size';
import {posedFootprint} from './city-model';
import {chooseRoomGroup} from './room-group-ui';
import {MapLabelLayout,measureMapText,paintMapLabels,drawTerritories} from './atlas-cartography';
import {TerritoryWorkbench} from './atlas-territories-ui';
import {TerrainSpatialUI} from './terrain-spatial-ui';

import {atlasFieldValue,setAtlasFieldValue,lengthLabel,atlasUnits} from './atlas-units';
import {AtlasWorkspaceLayout} from './atlas-workspace-layout';
import { AtlasReferenceUI } from "./atlas-reference-ui";
import { travelHexSizes } from "./atlas-navigation-scale";
import {regionValue} from './atlas-region-contracts';
import {selectElement} from './drawing-ui';

import {mountDungeonTravelConsole} from './dungeon-travel-console';

import {LiveAtlasPortal} from './live-atlas-portal';

import {LandscapeWorkbench} from "./atlas-landscape-ui";
import {earthView} from "./atlas-landscape";

import { atlasPartyPoint,atlasWorldRoute } from "./atlas-runtime-model";

import {openWorld,atlasWorldTravelState} from "./world-ui";

import {AtlasCanvas} from "./atlas-canvas";
import {atlasPaint} from "./atlas-canvas-scene";
import {atlasFrame,localToAtlas,atlasToLocal,frameMatrix,atlasHexPoint} from "./campaign-atlas-model";
import {
  writeAtlasCommit,
  pendingAtlasWrite,
  recoverAtlasCommit,
} from "./campaign-atlas-author";
import type {AtlasRenderView,AtlasAction} from "./campaign-atlas-contracts";
import type { WorkspaceGeometry, Point, Room } from "./contracts";
import { terrainNames } from "./world-model";
import { cityObjectsPaint, roadPoints } from "./city-model";

import {nearestAnchor} from "./drawing-model";
import {atlasCityState,atlasCityUndoPoint,openCityReference} from "./city-ui";
import {atlasDrawingSnapPoint,selectedDrawingElementId,atlasDrawingDraft,atlasDrawingHasDraft,atlasDrawingUndoPoint,reloadDrawing} from "./drawing-ui";
import {atlasDungeonState,openDungeon,stopDungeonPlayback} from "./dungeon-ui";


const shape = atlasPaint;
export class CampaignAtlasWorkbench {
  private output: AtlasOutput = this.createAtlasOutput();
  private createAtlasOutput(): AtlasOutput {
      const source = this;
      return new AtlasOutput({
          get reference() { return source.reference; },
          flush: (...args) => this.flush(...args),
          get opts() { return source.opts; },
          get root() { return source.root; },
          get family() { return source.family; },
          get layout() { return source.layout; },
          get landscape() { return source.landscape; },
          invalidateGeometry: () => { this.drawing.baseGeometry = null; },
          render: (...args) => this.render(...args),
          get owner() { return source.owner; },
          error: (...args) => this.error(...args),
          get data() { return source.regions.data; },
          get scopeId() { return source.scopeId; },
          get floorId() { return source.floorId; },
          get canvas() { return source.canvas; },
          get camera() { return source.camera; },
          geometryCurrent: (...args) => this.regions.geometryCurrent(...args),
          get spatial() { return source.spatial; },
          regionQuery: (...args) => this.regions.regionQuery(...args)
      });
  }

  private journey: AtlasJourney = this.createAtlasJourney();
  private createAtlasJourney(): AtlasJourney {
      const source = this;
      return new AtlasJourney({
          get data() { return source.regions.data; },
          get owner() { return source.owner; },
          get busy() { return source.busy; }, set busy(value) { source.busy = value; },
          get family() { return source.family; },
          refresh: (...args) => this.regions.refresh(...args),
          render: (...args) => this.render(...args),
          get opts() { return source.opts; },
          error: (...args) => this.error(...args),
          get root() { return source.root; },
          get lastPoint() { return source.author.lastPoint; },
          get canvas() { return source.canvas; }
      });
  }

  private regions: AtlasRegions = this.createAtlasRegions();
  private createAtlasRegions(): AtlasRegions {
      const source = this;
      return new AtlasRegions({
          get spatial() { return source.spatial; },
          get camera() { return source.camera; },
          get canvas() { return source.canvas; },
          get scopeId() { return source.scopeId; },
          get floorId() { return source.floorId; },
          get journey() { return source.journey; },
          get landscape() { return source.landscape; },
          scheduleRender: (...args) => this.scheduleRender(...args),
          get root() { return source.root; },
          get owner() { return source.owner; },
          get terrainAuthor() { return source.terrainAuthor; }, set terrainAuthor(value) { source.terrainAuthor = value; },
          get terrainPresentation() { return source.terrainPresentation; },
          get hitVersion() { return source.hitVersion; }, set hitVersion(value) { source.hitVersion = value; },
          get hitDialog() { return source.hitDialog; },
          render: (...args) => this.render(...args),
          error: (...args) => this.error(...args),
          get opts() { return source.opts; }
      });
  }

  private drawing: AtlasDrawing = this.createAtlasDrawing();
  private createAtlasDrawing(): AtlasDrawing {
      const source = this;
      return new AtlasDrawing({
          get regions() { return source.regions; },
          get output() { return source.output; },
          get landscape() { return source.landscape; },
          get spatial() { return source.spatial; },
          get canvas() { return source.canvas; },
          get root() { return source.root; },
          get family() { return source.family; },
          get measurementHover() { return source.author.measurementHover; },
          get scopeId() { return source.scopeId; },
          frame: (...args) => this.frame(...args),
          get floorId() { return source.floorId; },
          get roomDrag() { return source.author.roomDrag; },
          get draft() { return source.author.draft; },
          floorPlane: (...args) => this.floorPlane(...args),
          get selection() { return source.author.selection; },
          get opts() { return source.opts; },
          roomPreview: original => this.author.roomPreview(original),
          get camera() { return source.camera; },
          get pathDrag() { return source.author.pathDrag; },
          get partyDrag() { return source.author.partyDrag; }
      });
  }

  private author: AtlasAuthor = this.createAtlasAuthor();
  private createAtlasAuthor(): AtlasAuthor {
      const source = this;
      return new AtlasAuthor({
          get creation() { return source.creation; }, set creation(value) { source.creation = value; },
          get root() { return source.root; },
          get family() { return source.family; },
          get output() { return source.output; },
          get busy() { return source.busy; },
          get spacePan() { return source.spacePan; },
          get camera() { return source.camera; },
          get regions() { return source.regions; },
          get opts() { return source.opts; },
          point: (...args) => this.point(...args),
          createCity: (...args) => this.createCity(...args),
          createRoomGroup: (...args) => this.createRoomGroup(...args),
          setFamily: (...args) => this.setFamily(...args),
          get landscape() { return source.landscape; },
          entranceHeight: (...args) => this.entranceHeight(...args),
          chooseAt: (...args) => this.chooseAt(...args),
          get owner() { return source.owner; },
          navigateElement: (...args) => this.navigateElement(...args),
          navigateScope: (...args) => this.navigateScope(...args),
          navigate: (...args) => this.navigate(...args),
          get scopeId() { return source.scopeId; }, set scopeId(value) { source.scopeId = value; },
          frame: (...args) => this.frame(...args),
          write: (...args) => this.write(...args),
          render: (...args) => this.render(...args),
          get journey() { return source.journey; },
          get cityId() { return source.cityId; }, set cityId(value) { source.cityId = value; },
          doorRoomAt: (...args) => this.doorRoomAt(...args),
          chooseScope: (...args) => this.chooseScope(...args),
          get floorId() { return source.floorId; }, set floorId(value) { source.floorId = value; },
          syncDrawingFloor: (...args) => this.syncDrawingFloor(...args),
          error: (...args) => this.error(...args),
          cancel: (...args) => this.cancel(...args),
          get canvas() { return source.canvas; },
          get drawing() { return source.drawing; }
      });
  }

  readonly root = document.createElement("section");
  private canvas: HTMLCanvasElement;
  private camera: AtlasCanvas;
  private landscape: LandscapeWorkbench;
  private spatial?:TerrainSpatialUI;
  private terrainAnalysis?:TerrainAnalysisUI;
  private terrainAuthor:TerrainIdentity|null=null;
  private terrainPresentation:TerrainPresentation|null=null;
  private reference: AtlasReferenceUI;
  private owner: WorkspaceGeometry | null = null;
  private hitDialog=document.createElement('dialog');
  private hitVersion=0;
  private searchRequest=0;
  private opening:{owner:WorkspaceGeometry;task:Promise<void>}|null=null;
  private livePortal:LiveAtlasPortal|null=null;
  private liveVisible=false;
  private busy = false;
  private bindingDirty = false;
  private family: Family = "navigation";
  private cityId: string | null = null;
  private scopeId: string | null = null;
  private floorId = "ground";
  private renderQueued = false;
  private panelKey:unknown[]|null=null;
  private floorOptionsKey='';
  private territories!:TerritoryWorkbench;
  private drawingDock: {node: HTMLElement; parent: HTMLElement; next: ChildNode | null}[] = [];
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private layout: AtlasWorkspaceLayout;
  private spacePan = false;
  private creation: "city" | "dungeon" | null = null;
  constructor(
    private opts: {
      exit?: () => Promise<void>;
      selectRoom: (id: string) => Promise<void>;
      roomDraft: () => Room | null;
      flush: () => Promise<boolean>;
      updated: (w: WorkspaceGeometry) => Promise<void>;
      status: (s: string, error?: boolean) => void;
    },
  ) {
    // These controls now use the shared Canvas surface, including at the Live desk.
    // Retire their old renderers explicitly; CSS hiding alone still builds SVG trees.
    for(const id of ['map','city-map','world-map']){
      const legacy=get(id);legacy.dataset.sharedAtlas='true';legacy.replaceChildren();
    }
    this.root.id = "campaign-atlas";
    this.root.dataset.family = this.family;
    this.root.hidden = true;
    this.root.innerHTML = `<div class="atlas-command-bar"><strong>Atlas</strong><button id="atlas-output-open">Bild ausgeben</button><button id="atlas-reference-open">Größe vergleichen</button><button id="atlas-overview">Weltübersicht</button><button id="atlas-to-party">Zur Gruppe</button><button id="atlas-region-retry" hidden>Ansicht erneut laden</button><label>Ort finden<input id="atlas-search" type="search" placeholder="Stadt, Haus oder Raum"></label><button id="atlas-recover" hidden>Speicherstand klären</button><button id="atlas-undo" disabled>↶ Rückgängig</button><button id="atlas-redo" disabled>↷ Wiederholen</button></div><div id="atlas-search-results"></div><dialog id="atlas-place-confirm"><h2>Gruppe versetzen</h2><p>Die Fokusgruppe wird an den gewählten Punkt gesetzt. Dabei vergeht keine Reisezeit.</p><div class="toolbar"><button id="atlas-place-accept">Platzieren</button><button id="atlas-place-cancel">Abbrechen</button></div></dialog><div class="atlas-layout"><div class="atlas-stage"><canvas id="campaign-map" tabindex="0" role="application" aria-label="Gemeinsamer Kampagnenatlas">Atlas: Auswahl und Navigation über Ortsuche und Objektliste.</canvas><p id="atlas-save-status" role="status"></p></div><aside id="atlas-panel"><div id="atlas-edit-panel"><nav id="atlas-families" aria-label="Atlaswerkzeuge"></nav><h2 id="atlas-selection-title">Deine Kampagnenwelt</h2><p id="atlas-hint" data-idle="true">Zoome von der Landschaft bis zum Innenraum. Ziehen verschiebt die Ansicht.</p><section id="atlas-tool-fields"><label>Terrain<select id="atlas-terrain">${Object.entries(
      terrainNames,
    )
      .map(([id, title]) => `<option value="${id}">${title}</option>`)
      .join(
        "",
      )}</select></label><label>Hexstufe<select id="atlas-hex-level">${travelHexSizes.map(p => `<option value="${p.id}">${p.label} · ${p.miles.toLocaleString("de-DE")} Meilen Kante zu Kante</option>`).join("")}</select></label><label><span id="atlas-name-label">Name</span><input id="atlas-new-name" placeholder="Name"></label><button id="atlas-room-draw">Raumrechteck zeichnen</button><section id="atlas-drawing-tools" hidden></section><div id="atlas-create-tools"><button id="atlas-create-city">Stadt hier anlegen</button><button id="atlas-create-dungeon">Raumgruppe hier anlegen</button></div><label id="atlas-floor-field">Geschoss<select id="atlas-floor"></select></label><details id="atlas-room-view"><summary>Kartenansicht</summary><label><input id="atlas-roofs" type="checkbox" checked> Dächer anzeigen</label><label><input id="atlas-slice-enabled" type="checkbox"> Höhenschnitt</label><label>Höhe in m<input id="atlas-slice" type="number" step="any" value="0"></label></details><button id="atlas-draft-cancel" hidden>Zug verwerfen</button></section><section id="atlas-context-fields"><label><input id="atlas-perception" type="checkbox"> Wissen und Sicht der Gruppe</label><button id="atlas-entrance-height" hidden>Eingangshöhe</button><button id="atlas-connect-entrance" hidden>Eingang verbinden</button><div id="atlas-local-console" hidden><h3>Reise der Fokusgruppe</h3><p id="atlas-local-status" role="status"></p><button id="atlas-local-refresh" hidden>Reisekontext erneut laden</button><div class="toolbar"><button id="atlas-local-preview">Weg prüfen</button><button id="atlas-local-start" disabled>Reise starten</button><button id="atlas-local-step">Ein Schritt</button><button id="atlas-local-round">Eine Runde</button><button id="atlas-local-play">Wiedergabe starten</button><button id="atlas-local-pause">Pause</button><button id="atlas-local-end">Beenden</button></div><label id="atlas-entrance-field" hidden>Eingang<select id="atlas-entrance-choice"></select></label><button id="atlas-local-entrance" hidden>Durch Eingang</button><details><summary>Gruppe platzieren</summary><p>Versetzt die Fokusgruppe ohne Reisezeit an den zuletzt gewählten Punkt.</p><button id="atlas-local-place">Hier platzieren</button></details></div></section><details id="atlas-placement" hidden><summary>Raumgruppe und Einordnung</summary><div id="atlas-binding-pose"><label>X in m<input id="atlas-binding-x" type="number" step="any"></label><label>Y in m<input id="atlas-binding-y" type="number" step="any"></label><label>Drehung in Grad<input id="atlas-binding-angle" type="number" step="any"></label><button id="atlas-binding-save">Einordnung übernehmen</button></div><div id="atlas-group-size"><label>Gesamte Raumgruppe skalieren<input id="atlas-group-factor" type="number" min="0.1" max="10" step="0.1" value="1"></label><button id="atlas-group-scale">Größe übernehmen</button></div><div id="atlas-split-controls"><label>Raum teilen<select id="atlas-split-axis"><option value="x">Links / rechts</option><option value="y">Oben / unten</option></select></label><label>Anteil der ersten Seite in %<input id="atlas-split-ratio" type="number" min="10" max="90" value="50"></label><button id="atlas-room-split">Raum teilen</button></div></details></div><section id="atlas-output" hidden><button id="atlas-output-back">← Karte bearbeiten</button><h2>Karte exportieren</h2><p id="atlas-output-area" role="status">Aktuelle Ansicht</p><div class="toolbar"><button id="atlas-output-choose">Bereich aufziehen</button><button id="atlas-output-view">Aktuelle Ansicht</button><button id="atlas-output-dungeon" title="Alle nicht ausgeblendeten Räume und Zeichnungen des aktuellen Geschosses einrahmen" hidden>Dungeon-Grundriss</button></div><label>Inhalt<select id="atlas-export-audience"><option value="gm">GM-Ansicht</option><option value="public">Wissen der Fokusgruppe</option></select></label><button id="atlas-export-png">Bild speichern…</button><button id="atlas-export-cancel" hidden>Ausgabe abbrechen</button><details><summary>Bildoptionen</summary><label>Format<select id="atlas-export-format"><option value="png">PNG</option><option value="jpeg">JPEG</option></select></label><label>Längste Bildkante in Pixel<input id="atlas-export-size" type="number" min="256" max="8192" value="2048"></label><label><input id="atlas-export-grid" type="checkbox"> Hexraster ausgeben</label><label><input id="atlas-export-scale" type="checkbox" checked> Maßstab ausgeben</label><label><input id="atlas-export-reference" type="checkbox"> Vorlage im GM-Bild ausgeben</label></details></section></aside></div>`;
    document.getElementById("workspace-navigation")!.after(this.root);
    mountDungeonTravelConsole(get("atlas-local-console"));
    this.canvas = this.root.querySelector("#campaign-map")!;
    this.root.addEventListener("terrain-display-change",()=>{if(this.spatial?.active)this.spatial.setContours(this.landscape.contours());else void this.regions.refresh();});
    this.camera = new AtlasCanvas(this.canvas, {
      redraw:()=>this.render(),
      presentation:()=>this.spatial?.active?this.spatial:null,
      relative: true,
      smoothZoom: true,
      overlay:(root,box,mpp)=>{this.syncBrushSizes(mpp);const again=this.landscape?.drawOverlay(root,box,mpp);this.reference?.draw(root,box,mpp);this.drawing.drawAuthorMeasurements(root,box,mpp);return again;},
      initial: { x: -15000, y: -10000, width: 30000, height: 20000 },
      minWidth: 0.1,
      maxWidth: () => earthView(this.canvas.clientWidth / Math.max(1,this.canvas.clientHeight)).width * 1.1,
      pan: (e) => {
        if(e.button===1 || e.button===0 && (this.root.dataset.panMode==="true" || this.spacePan || e.altKey))return "explicit";
        return e.button===0 && this.family==="navigation" && !this.reference?.active && !this.output.exportOpen && !this.author.pointToolActive() &&
          (!this.camera.hitAt(e,["atlasObject"]) || this.camera.hitAt(e,["atlasObject"])?.data.kind==="city");
      },
      locked: () =>
        this.brushDraftPending(true) ||
        !!this.reference?.dragging ||
        !!this.author.drag ||
        !!this.author.vertexDrag ||
        !!this.author.pathDrag ||
        !!this.author.roomDrag ||
        !!this.output.exportDrag ||
        !!this.author.partyDrag ||
        this.author.brushId !== null,
      changed: () => {
        // Until object geometry arrives, terrain draws its own camera updates.
        // Complete scenes keep map and overlay in the shared AtlasCanvas frame.
        this.spatial?.reframe(this.camera.view,!this.regions.data);
        this.remember();this.canvas.dataset.atlasOriginX=String(this.camera.view.x);this.canvas.dataset.atlasOriginY=String(this.camera.view.y);
        this.regions.scheduleRegion(true);if(this.output.exportOpen)this.output.exportAreaStatus();
      },
    });
    this.root.querySelector(".map-canvas-controls")!.append(get("atlas-output-open"));
    get("atlas-output-open").onclick=()=>void this.output.setOutput(true);
    const output=get('atlas-output'),heading=output.querySelector('h2')!;
    const image=document.createElement('div');image.id='atlas-output-image';
    while(heading.nextSibling)image.append(heading.nextSibling);
    const kind=document.createElement('label');kind.textContent='Ausgabe';
    const choice=document.createElement('select');choice.id='atlas-export-kind';
    for(const [value,text] of [['image','Bild'],['campaign','Bearbeitbare Kampagne']] as const){
      const option=document.createElement('option');option.value=value;option.textContent=text;choice.append(option);
    }
    choice.onchange=()=>this.output.exportAreaStatus();kind.append(choice);
    const editable=document.createElement('section');
    editable.id='atlas-output-editable';editable.hidden=true;
    const save=document.createElement('button');save.id='atlas-output-save-campaign';save.textContent='Kampagne sichern…';
    save.onclick=()=>void this.output.saveEditableCampaign();
    const hint=document.createElement('p');hint.className='caption';hint.textContent='Vollständige Kampagne mit GM-Inhalten und Medien (.kwcampaign).';
    const receipt=document.createElement('p');receipt.id='atlas-output-save-status';receipt.setAttribute('role','status');
    editable.append(hint,save,receipt);heading.replaceWith(kind,editable,image);
    get("atlas-output-back").onclick=()=>void this.output.setOutput(false);
    get("atlas-output-choose").onclick=()=>{if(this.output.exporting)return;this.output.exportDungeon=false;this.output.exportChoosing=true;this.output.exportCorner=null;this.output.exportAreaStatus();this.canvas.focus();};
    get("atlas-output-view").onclick=()=>{if(this.output.exporting)return;this.output.exportDungeon=false;this.output.exportBox=null;this.output.exportChoosing=false;this.output.exportCorner=null;this.output.exportAreaStatus();this.render();};
    get("atlas-output-dungeon").onclick=()=>{
      if(this.output.exporting||!this.regions.geometryCurrent()||!this.output.dungeonOutputBox())return;
      this.output.exportBox=null;this.output.exportDungeon=true;this.output.exportChoosing=false;this.output.exportCorner=null;this.output.exportAreaStatus();
      this.output.frameOutput(this.output.dungeonOutputBox()!);this.render();
    };
    for(const id of ['atlas-export-size','atlas-export-scale'])get(id).addEventListener('change',()=>{
      if(this.output.exportOpen&&this.output.exportDungeon&&!this.output.exporting){const b=this.output.dungeonOutputBox();if(b)this.output.frameOutput(b);this.output.exportAreaStatus();this.render();}
    });
    get("atlas-export-cancel").onclick=()=>{this.output.cancel();};
    this.reference=new AtlasReferenceUI(this.canvas,{
      view:()=>this.camera.view,point:e=>this.camera.point(e),set:box=>this.camera.set(box,true),redraw:()=>this.camera.redrawOverlay(),
      closed:()=>{this.layout?.comparison(false);get('atlas-reference-open').setAttribute('aria-expanded','false');}
    });
    get('atlas-panel').prepend(this.reference.panel);
    get('atlas-reference-open').setAttribute('aria-expanded','false');
    get('atlas-reference-open').onclick=()=>void (async()=>{
      if(this.reference.active){this.reference.close();return;}
      if(!(await this.flush())||!(await this.opts.flush()))return;
      if(this.root.dataset.roomDraw==='true'){this.error(Error('Begonnenen Atlaszug abschließen oder verwerfen.'));return;}
      if(this.output.exportOpen)await this.output.setOutput(false);
      await this.setFamily('navigation',false);
      this.camera.stopZoom();this.reference.open();this.layout.comparison(true);
      get('atlas-reference-open').setAttribute('aria-expanded','true');
    })().catch(e=>this.error(e));
    this.territories=new TerritoryWorkbench(this.canvas,{focus:b=>{const aspect=this.canvas.clientWidth/Math.max(1,this.canvas.clientHeight),width=Math.max(b.width,b.height*aspect,10)*1.2,height=width/aspect;this.camera.set({x:b.x+b.width/2-width/2,y:b.y+b.height/2-height/2,width,height},true);},data:()=>this.regions.data,enabled:()=>this.family==='terrain'&&!this.output.exportOpen,point:e=>this.camera.point(e),box:()=>this.camera.view,current:()=>this.regions.geometryCurrent()&&this.camera.ready,write:a=>this.write(a,false,true),redraw:()=>this.scheduleRender(),error:e=>this.error(e)});
    this.landscape=new LandscapeWorkbench(this.canvas,{selected:(id,kind)=>this.layout?.landscapeSelectionChanged(id,kind),terrainGesture:active=>this.terrainGesture(active),previewHeight:stroke=>this.spatial?.previewHeight(stroke),writeTerrain:async(a,c)=>{const r=await this.write(a,false,true,c);if(!r)throw Error('Pinselzug nicht gespeichert.');return r.ack;},planning:()=>{this.author.selection=null;this.layout?.selectionChanged(null);this.layout?.showPane('tool');},navigation:e=>this.camera.navigationRequested(e),hit:(e,s)=>this.camera.hitAt(e,s),point:e=>this.camera.point(e),visibility:()=>this.spatial?.visibility(),box:()=>this.camera.view,navigate:b=>this.camera.set(b,true),redraw:()=>this.scheduleRender(),redrawOverlay:()=>this.camera.redrawOverlay(),write:a=>this.write(a,false,true),error:e=>this.error(e),data:()=>this.regions.data,refresh:()=>this.regions.refresh(),choose:p=>this.chooseAt(p,'landscape'),current:()=>this.regions.geometryCurrent()&&this.camera.ready&&(!this.spatial?.active||this.spatial.ready)});
    this.landscape.panel.append(this.territories.panel);
    get<HTMLSelectElement>('land-tool').add(new Option('Regionen','territory'));
    get('land-tool').addEventListener('change',e=>{if(this.territories.hasDraft()){get<HTMLSelectElement>('land-tool').value='territory';e.stopImmediatePropagation();this.opts.status('Regionsänderung zuerst übernehmen oder verwerfen.');}else this.territories.sync(this.owner?.token??'');},true);
    this.hitDialog.id='atlas-hit-candidates';this.hitDialog.addEventListener('close',()=>this.hitVersion++);this.root.append(this.hitDialog);
    this.root.querySelectorAll<HTMLInputElement>('#atlas-hex-level,#atlas-terrain').forEach(n=>n.addEventListener('change',()=>{if(n.id==='atlas-hex-level')get<HTMLInputElement>('land-auto-level').checked=false;this.render();}));
    let viewport:{width:number;height:number}|null=null;
    new ResizeObserver(()=>{
      const width=this.canvas.clientWidth,height=this.canvas.clientHeight;
      if(width<=0||height<=0){viewport=null;return;}
      this.camera.resizeViewport(viewport??{width,height}, {width,height});viewport={width,height};
      // The buffered geometry can remain valid; publish current selection handles at the new size too.
      this.scheduleRender();
    }).observe(this.canvas);
    const names = {terrain:"Landschaft",city:"Stadt",interior:"Räume"};
    for (const [id, name] of Object.entries(names)) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.family = id;
      b.textContent = name;
      b.onclick = () => void this.setFamily(id as Family);
      get("atlas-families").append(b);
    }
    get("atlas-entrance-choice").onchange = () => {
      this.journey.entranceId =
        get<HTMLSelectElement>("atlas-entrance-choice").value || null;
      this.journey.renderTravel();
    };
    get("atlas-region-retry").onclick=()=>void this.regions.refresh();
    get("atlas-export-png").onclick = () => void this.output.exportPNG();
    for (const id of [
      "atlas-binding-x",
      "atlas-binding-y",
      "atlas-binding-angle",
    ])
      get(id).oninput = () => {
        this.bindingDirty = true;
        get("atlas-draft-cancel").hidden = false;
      };
    get("atlas-room-split").onclick=()=>{const room=this.regions.data?.workspace.rooms.find(r=>this.author.selection?.kind==='room'&&r.id===this.author.selection.id);if(room)void this.write({kind:'group-room-split',roomId:room.id,expectedRevision:room.revision,axis:get<HTMLSelectElement>('atlas-split-axis').value as 'x'|'y',ratio:Number(get<HTMLInputElement>('atlas-split-ratio').value)/100});};
    get("atlas-group-scale").onclick=()=>{const binding=this.selectedGroupBinding();if(binding)void this.write({kind:"group-scale",scopeId:binding.ownerId,factor:Number(get<HTMLInputElement>("atlas-group-factor").value)});};
    get("atlas-binding-save").onclick = () => {
      const binding = this.selectedBinding();
      if (binding)
        void this.write({
          kind: "bind",
          binding: {
            ...binding,
            x: Number(atlasFieldValue(get<HTMLInputElement>("atlas-binding-x"))),
            y: Number(atlasFieldValue(get<HTMLInputElement>("atlas-binding-y"))),
            angle:
              (Number(get<HTMLInputElement>("atlas-binding-angle").value) *
                Math.PI) /
              180,
          },
          expectedRevision: binding.revision,
        }).then((r) => {
          if (r) {
            this.bindingDirty = false;
            get("atlas-draft-cancel").hidden = true;
            this.render();
          }
        });
    };
    get("atlas-place-cancel").onclick = () => {
      this.author.placeIntent = null;
      get<HTMLDialogElement>("atlas-place-confirm").close();
    };
    get("atlas-place-accept").onclick = () => {
      const p = this.author.placeIntent;
      this.author.placeIntent = null;
      get<HTMLDialogElement>("atlas-place-confirm").close();
      if (
        !p ||
        p.token !== this.owner?.token ||
        p.sceneId !== this.regions.data?.geometry.sceneId
      ) {
        this.error(new Error("Fokusgruppe inzwischen geändert."));
        return;
      }
      void this.journey.travel({
        kind: "place",
        point: p.point,
        expectedPositionRevision: p.revision,
        expectedMembershipRevision: p.membership,
      });
    };
    get("atlas-recover").onclick = () =>
      void (async () => {
        if (!this.owner || this.busy) return;
        this.busy = true;
        const owner = this.owner;
        try {
          if (this.journey.pendingTravel) {
            const r = await window.campaign.executeAtlasTravelCommit(
              this.journey.pendingTravel,
            );
            if (this.owner !== owner) return;
            if (!r.ok) throw new Error(r.error);
            this.journey.pendingTravel = null;await this.regions.refresh();
          } else {
            const r = await recoverAtlasCommit(owner.token);
            if (this.owner !== owner || !r) return;
            if (!r.ok) throw new Error(r.error);
            const initial=await window.campaign.workspaceInitial(owner.token);if(!initial.ok)throw new Error("Gespeichert. Arbeitsansicht erneut laden: "+initial.error);await this.opts.updated(initial.value);await this.regions.refresh();
            this.cancel();
            this.landscape.recovered();
          }
          get("atlas-save-status").textContent = "Speicherstand geklärt";
        } catch (e) {
          if (this.owner === owner) this.error(e);
        } finally {
          if (this.owner === owner) {
            this.busy = false;
            this.render();
          }
        }
      })();
    document.addEventListener("atlas-write-state", () => this.scheduleRender());
    get("atlas-overview").onclick = () => this.overview();
    get("atlas-to-party").onclick = () => this.toParty();
    get("atlas-undo").onclick = () => void this.history("undo");
    get("atlas-redo").onclick = () => void this.history("redo");
    get("atlas-search").oninput = () => this.search();
    get("atlas-roofs").onchange = () => {this.render();this.regions.scheduleRegion();};
    get("atlas-perception").onchange = () => {this.render();this.regions.scheduleRegion();};
    get("atlas-slice-enabled").onchange = () => {this.render();this.regions.scheduleRegion();};
    get("atlas-slice").oninput = () => {this.render();this.regions.scheduleRegion();};
    get("atlas-floor").onchange = () => {
      this.floorId = get<HTMLSelectElement>("atlas-floor").value;
      this.syncDrawingFloor();
      setAtlasFieldValue(get<HTMLInputElement>("atlas-slice"), String(
        this.regions.data?.geometry.floors.find(
          (f) => f.scopeId === this.scopeId && f.id === this.floorId,
        )?.elevation ?? 0,
      ));
      this.render();
    };

    for (const kind of [
      "preview",
      "start",
      "step",
      "round",
      "play",
      "pause",
      "end",
      "place",
      "entrance",
    ])
      get("atlas-local-" + kind).onclick = () => void this.journey.travelControl(kind);
    get("atlas-local-refresh").onclick = () => void this.regions.refresh();
    get("atlas-connect-entrance").onclick = () => {
      this.author.entranceDraft = [];
      get("atlas-hint").dataset.idle = "false";
      get("atlas-hint").textContent =
        "Zuerst den Außenpunkt vor dem Eingang, dann einen Innenpunkt im gewählten Raum anklicken.";
    };
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.journey.playback.stop();
    });
    window.addEventListener("blur", () => this.journey.playback.stop());
    get("atlas-create-city").textContent="Stadt platzieren";
    get("atlas-create-city").onclick = () => this.beginPlacement("city");
    get("atlas-create-dungeon").textContent="Dungeon platzieren";
    get("atlas-create-dungeon").onclick = () => this.beginPlacement("dungeon");
    get("atlas-room-draw").onclick = () => {
      if(this.author.draft.length||this.author.roomDrag){this.opts.status("Raumzug zuerst abschließen oder abbrechen.",true);return;}
      this.creation = null;delete this.root.dataset.placing;
      this.author.draft = [];
      this.root.dataset.roomDraw = "true";
      get("atlas-hint").dataset.idle = "false";
      const name = get<HTMLInputElement>("drawing-room-name");
      get("atlas-hint").textContent =
        "Rechteck im Atlas ziehen oder zwei gegenüberliegende Ecken anklicken. Escape verwirft.";
      this.render();name.focus();name.select();
    };
    get("atlas-draft-cancel").onclick = () => this.cancel();
    this.canvas.addEventListener("click", (e) => void this.author.click(e));
    this.canvas.addEventListener("pointerdown", (e) => this.author.down(e));
    document.addEventListener('atlas-units-changed',()=>{this.drawing.baseGeometry=null;this.updateHexLabels();this.render();});
    this.updateHexLabels();
    this.root.addEventListener('input',()=>this.camera.redrawOverlay());
    this.canvas.addEventListener('pointerleave',()=>{this.author.measurementHover=null;this.camera.redrawOverlay();});
    this.canvas.addEventListener("pointermove", (e) => this.author.move(e));
    this.canvas.addEventListener("pointerup", (e) => void this.author.up(e));
    this.canvas.addEventListener("pointercancel", () => this.cancel());
    this.canvas.addEventListener("lostpointercapture", () => {
      if (
        this.author.brushId !== null ||
        this.author.drag ||
        this.author.vertexDrag ||
        this.author.pathDrag ||
        this.author.partyDrag ||
        this.author.roomDrag
      )
        this.cancel();
    });
    this.layout = new AtlasWorkspaceLayout(this.root,{
      exit:async()=>{if(this.opts.exit)await this.opts.exit();else get('campaign-screen-open').click();},
      prepare:async()=>await this.flush()&&await this.opts.flush(),
      error:e=>this.error(e),
      navigation:pan=>this.setNavigationMode(pan),
      tool:async(family,id,value,settings)=>{
        if(!await this.flush()||!await this.opts.flush())return false;
        if(this.output.exportOpen)await this.output.setOutput(false);
        await this.setFamily(family,false);if(this.family!==family)return false;
        const input=get<HTMLSelectElement>(id);
        for(const [key,setting]of Object.entries(settings??{}))setAtlasFieldValue(get<HTMLSelectElement>(key), setting);
        input.value=value;input.dispatchEvent(new Event('change',{bubbles:true}));
        for(const key of Object.keys(settings??{}))get(key).dispatchEvent(new Event('change',{bubbles:true}));
        if(id==='drawing-tool'&&value==='room-rectangle'&&!get('atlas-room-draw').hidden)get('atlas-room-draw').click();
        this.render();return input.value===value;
      }
    });
    for(const id of ['land-radius','territory-radius','drawing-brush'])this.brushControls.set(id,new BrushSizeControl(get<HTMLInputElement>(id),()=>this.scheduleRender()));
    const syncBrushes=()=>this.syncBrushSizes();
    this.canvas.parentElement!.addEventListener('pointerdown',()=>this.camera.stopZoom(),true);
    this.canvas.parentElement!.addEventListener('pointerdown',syncBrushes,true);
    this.root.addEventListener('change',syncBrushes);
    this.canvas.parentElement!.addEventListener('wheel',e=>{
      if(!e.shiftKey||!this.canvas.contains(e.target as Node)||this.output.exportOpen)return;
      const id=this.family==='terrain'?(get<HTMLSelectElement>('land-tool').value==='territory'?'territory-radius':'land-radius'):
        ['interior','decoration'].includes(this.family)?'drawing-brush':undefined;
      const control=id?this.brushControls.get(id):undefined;
      if(!control||control.root.hidden||control.field.closest('dialog[open]'))return;
      if(id==='territory-radius'&&!['add','erase'].includes(get<HTMLSelectElement>('territory-operation').value))return;
      this.camera.stopZoom();syncBrushes();
      if(control.wheel(e,this.canvas.clientHeight))this.spatial?.refreshBrushCursor(e.clientX,e.clientY);
    },{capture:true,passive:false});
    this.spatial=new TerrainSpatialUI(this.canvas,{
      route:async kind=>{await this.setFamily('terrain',false);if(this.family==='terrain')await this.landscape.planTerrainRoute(kind);},live:()=>this.landscape.livePainting,draft:()=>this.landscape.spatialDraft(),writing:()=>this.busy,hasDraft:()=>this.cameraDraftPending(),navigationLocked:()=>this.cameraDraftPending(true),cancel:()=>{this.landscape.cancel();this.cancel();},
      workplane:()=>['interior','decoration'].includes(this.family)&&!this.creation?this.floorPlane():null,
      objectPicking:()=>!this.author.pointToolActive()&&['navigation','interior','decoration','city'].includes(this.family),tool:()=>this.family==='terrain'?this.landscape.spatialTool:'select',navigation:e=>this.camera.navigationRequested(e),panning:()=>this.camera.panning,
      refresh:()=>this.regions.refreshSpatialSource(),redraw:()=>this.redrawSpatial(),error:e=>this.error(e),recovered:message=>this.recoverPresentation(message),selection:()=>this.landscape.spatialSelection,
    });
    this.terrainAnalysis=new TerrainAnalysisUI(this.canvas,{
      token:()=>this.owner?.token,revision:()=>this.regions.data?.revision??-1,hasDraft:()=>this.cameraDraftPending(),
      point:e=>this.camera.ready?this.camera.point(e):null,error:e=>this.error(e),
    });
    get('atlas-entrance-height').onclick=()=>{const roomId=this.author.selection?.kind==='room'?this.author.selection.id:null;
      void this.entranceHeight(this.regions.data?.entrances.filter(e=>e.roomId===roomId)??[]);
    };
    this.updateHexLabels();
    this.canvas.addEventListener("keydown", (e) => {
      if(e.code==="Space"){e.preventDefault();this.spacePan=true;return;}
      if(e.defaultPrevented)return;
      if(this.output.exportOpen){if(e.key==="Escape")this.cancel();return;}
      if(this.family==="terrain")return;
      if(e.key==="Backspace"){e.preventDefault();if(this.family==="city")atlasCityUndoPoint();else{this.author.draft.pop();atlasDrawingUndoPoint();this.render();}return;}
      if (e.key === "Enter") {
        e.preventDefault();
        get(this.family === "city" ? "city-finish" : "drawing-finish").click();
      }
      if (e.key === "Escape") this.cancel();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        void this.history(e.shiftKey ? "redo" : "undo");
      }
    });
    window.addEventListener("keyup",e=>{if(e.code==="Space"){this.spacePan=false;e.preventDefault();}});
    window.addEventListener("blur",()=>{this.spacePan=false;});
    document.addEventListener("atlas-written", (e) => {
      const a = (e as CustomEvent<AtlasRenderView>).detail;
      if (a?.workspace.token !== this.owner?.token) return;
      this.landscape.invalidate(a.revision);
      this.regions.loadedRegionQuery=null;
      if(!this.root.hidden)void this.regions.refresh();
    });
    document.addEventListener('atlas-invalidated',e=>{
      const detail=(e as CustomEvent<{campaignId:string;token?:string;revision?:number}>).detail;
      if(detail?.campaignId!==this.owner?.campaign.id||detail.token&&detail.token!==this.owner?.token)return;
      this.regions.loadedRegionQuery=null;if(detail.revision!==undefined)this.landscape.invalidate(detail.revision);
      if(!this.busy&&!this.root.hidden)void this.regions.refresh();
    });
    document.addEventListener("atlas-draft", () => this.scheduleRender());
    document.addEventListener("atlas-runtime", () => {
      if (this.root.hidden) return;this.regions.loadedRegionQuery=null;
      if(this.liveDocked){this.regions.request++;this.journey.previewRequest++;this.journey.localPreview=null;this.journey.travelReadState='loading';this.journey.playback.stop();this.journey.renderTravel();}
      if(this.refreshTimer)return;
      this.refreshTimer = setTimeout(() => {
        this.refreshTimer = null;
        void this.regions.refresh();
      }, 100);
    });
  }
  private recoverPresentation(message:string){
    // A recovered renderer owns only its own failure, never an unrelated write.
    const local=get('atlas-save-status'),global=get('status'),text='Atlaskamera wieder verfügbar';
    if(local.dataset.error==='true'&&local.textContent===message){local.textContent=text;local.dataset.error='false';}
    if(global.dataset.error==='true'&&global.textContent===message)this.opts.status(text,false);
  }
  private error(e: unknown) {
    const text = (e as Error).message;
    get("atlas-save-status").textContent = text;
    get("atlas-save-status").dataset.error = "true";
    this.opts.status(text, true);
  }
  private redrawSpatial(){
    this.scheduleRender();
    // A redraw is not a new source. While loading, compare the requested
    // representation: refresh deliberately clears the last loaded query.
    const query=this.regions.regionReading===this.regions.request?this.regions.regionReadingQuery:this.regions.loadedRegionQuery;
    if(this.regions.data&&query&&query.terrainRaster!==this.regions.regionQuery().terrainRaster)this.regions.scheduleRegion();
  }
  private scheduleRender() {
    if (this.root.hidden || this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      this.render();
    });
  }
  get insertionPoint() {
    return this.author.lastPoint;
  }
  get liveDocked(){return !!this.livePortal?.mounted;}
  liveSurface(){
    return this.livePortal??=new LiveAtlasPortal(this.root,this.canvas,visible=>{
      if(this.liveVisible===visible&&this.root.hidden===!visible)return;
      this.liveVisible=visible;
      if(!visible){this.hide();return;}
      this.family='travel';this.landscape.setActive(false);
      void this.open().catch(error=>this.error(error));
    },factor=>this.camera.zoom(factor),mounted=>{if(mounted)void openDungeon().catch(error=>this.error(error));else stopDungeonPlayback();});
  }
  hide() {
    this.regions.openingSurface=null;
    this.terrainAnalysis?.cancel();
    this.terrainPresentation?.stop();this.terrainPresentation=null;
    this.spatial?.setActive(false);
    this.regions.cancel();
    this.output.cancel();
    this.hitVersion++;this.hitDialog.close();
    this.journey.invalidatePreview();
    this.root.hidden = true;
    this.layout?.setActive(false);
  }
  activate(w: WorkspaceGeometry) {
    this.regions.openingSurface=null;
    this.terrainPresentation?.stop();this.terrainPresentation=null;this.terrainAuthor=null;
    this.regions.cancel();
    this.hitVersion++;this.hitDialog.close();
    this.journey.activate();
    this.root.dataset.regionState='loading';this.canvas.setAttribute('aria-busy','true');
    this.author.entranceDraft = null;
    this.bindingDirty = false;
    this.output.reset();
    this.spatial?.setActive(false);
    this.owner = w;
    this.searchRequest++;get('atlas-search-results').replaceChildren();
    this.reference.close();
    this.landscape.context(w.token);
    this.regions.data = null;this.drawing.baseGeometry=null;this.panelKey=null;this.floorOptionsKey='';
    this.author.selection = null;
    this.creation=null;delete this.root.dataset.placing;this.root.dataset.panMode="false";
    this.cityId = null;
    this.scopeId = null;
    this.author.draft = [];
    this.root.dataset.roomDraw = "false";
    this.drawing.labelLayout=new MapLabelLayout();
    this.camera.context(w.campaign.id, {
      x: -15000,
      y: -10000,
      width: 30000,
      height: 20000,
    });
    try {
      const p = JSON.parse(
        localStorage.getItem("atlas-camera:" + w.campaign.id) ?? "null",
      );
      if (
        p &&
        ["x", "y", "width", "height"].every((k) => Number.isFinite(p[k])) &&
        p.width > 0 &&
        p.height > 0
      )
        this.camera.set(p, false);
    } catch {
      /* local view preference */
    }
  }
  async open() {
    if(!this.liveDocked&&this.family==='travel')this.family='terrain';
    this.root.hidden=false;this.layout?.setActive(!this.liveDocked);const owner=this.owner;if(!owner)return;
    if(this.opening?.owner===owner)return this.opening.task;
    const task=(async()=>{await this.regions.openTerrain(owner);if(this.owner!==owner||this.root.hidden)return;await this.regions.refresh();if(this.owner!==owner||this.root.hidden)return;await this.setFamily(this.family,false);})();
    this.opening={owner,task};
    try{await task;}finally{if(this.opening?.task===task)this.opening=null;}
  }
  private remember() {
    if (!this.owner) return;
    try {
      localStorage.setItem(
        "atlas-camera:" + this.owner.campaign.id,
        JSON.stringify(this.camera.view),
      );
    } catch {
      /* author saving remains independent */
    }
  }
  refresh(keepScene=false) { return this.regions.refresh(keepScene); }

  async flush() {
    this.journey.playback.stop();
    await this.journey.playback.settled();
    if (
      this.busy ||
      this.journey.pendingTravel ||
      (this.owner && pendingAtlasWrite(this.owner.token))
    )
      return false;
    if (
      this.landscape.hasDraft() || this.territories.hasDraft() ||
      this.bindingDirty ||
      this.author.draft.length ||
      this.author.brushId !== null ||
      this.author.drag ||
      this.author.vertexDrag ||
      this.author.pathDrag ||
      this.author.partyDrag ||
      this.author.entranceDraft ||
      this.author.placeIntent
    ) {
      this.error(new Error("Begonnenen Atlaszug abschließen oder verwerfen."));
      return false;
    }
    return true;
  }
  private entranceHeight(entrances:import('./atlas-travel-contracts').AtlasEntrance[]){
    const owner=this.owner;if(!owner||this.busy)return;
    const valid=()=>{if(this.owner!==owner)throw Error('Atlas inzwischen gewechselt. Eingang erneut öffnen.');};
    return editEntranceHeight(entrances,async entrance=>{valid();const result=await this.write({kind:'entrance',entrance},false,true);if(!result)throw Error('Eingang nicht gespeichert. Offene Bearbeitung abschließen.');},async id=>{valid();await this.navigate('room',id);},e=>this.error(e));
  }
  private async terrainGesture(active:boolean){
    if(active){
      this.spatial?.gesture(true);
      const owner=this.owner!,query=this.spatial?.liveQuery()??{kind:'top' as const,query:this.regions.regionQuery(true)};
      this.terrainAuthor=null;
      this.terrainPresentation=new TerrainPresentation(async(source,base,refinement=false)=>{
        const end=terrainTraceStart('terrain.frame');
        let frame=this.spatial?.liveQuery(box=>this.landscape.terrainDetail(box))??(query.kind==='top'?{...query,detail:this.landscape.terrainDetail(query.query.box)}:query);
        // Keep the requested fine dimensions independent of the last displayed coarse pass.
        if(frame.kind==='tilted'&&query.kind==='tilted')frame={...frame,query:{...frame.query,width:query.query.width,height:query.query.height}};
        if(!refinement)frame=interactiveTerrainFrame(frame);
        const reply=await window.campaign.atlasTerrainFrame(owner.token,{source,frame,base,refinement}).finally(end);
        if(!reply.ok)throw Error(reply.error);return reply.value;
      },(frame,refined)=>{
        if(this.owner!==owner)return;
        if(frame.view==='tilted'){if(!this.spatial?.presentLive({...frame.projection,identity:frame.target},refined))return;}
        else this.landscape.presentTerrain(frame.layer);
        this.canvas.dataset.terrainRevision=String(frame.target.revision);
      },error=>{if(this.owner===owner)this.opts.status('Gespeichert. Geländeanzeige folgt beim Abschluss: '+(error as Error).message,true);},query.kind==='tilted');
      return;
    }
    const presentation=this.terrainPresentation,owner=this.owner;
    await presentation?.finish();
    if(this.owner!==owner||this.terrainPresentation!==presentation)return;
    this.terrainPresentation=null;
    const end=terrainTraceStart('atlas.refresh',this.terrainAuthor?.revision);
    try{await this.regions.refresh();}finally{end();this.spatial?.gesture(false);}
  }
  private async write(action: AtlasAction, applyWorkspace = false, propagateError = false, terrain?:import("./terrain-live-stroke").TerrainLiveContext) {
    const w = this.owner;
    if (!w || this.busy) return null;
    this.busy = true;
    get("atlas-save-status").textContent = "Wird gespeichert…";
    try {
      const commandId = crypto.randomUUID(),
        a = structuredClone(action);
      if (a.kind === "city" || a.kind === "world" || a.kind === "drawing")
        a.command.commandId = commandId;
      if (a.kind === "room-edit") a.edit.commandId = commandId;
      const command={commandId,token:w.token,campaignId:w.campaign.id,action:a,...(this.regions.data?.region?{sourceFence:this.regions.data.region.fence}:{})};
      const endCommit=terrainTraceStart("commit.roundtrip",terrain?.expectedRevision);
      const ack=await writeAtlasCommit(terrain?{...command,sourceFence:terrain.sourceFence,terrainStroke:{id:terrain.id,expectedRevision:terrain.expectedRevision}}:command);
      endCommit();
      if(this.owner!==w)return null;if(!ack.ok)throw new Error(ack.error);
      get('atlas-save-status').textContent='Gespeichert';get('atlas-save-status').dataset.error='false';this.opts.status('Gespeichert');
      this.journey.playback.stop();this.journey.localPreview=null;
      if(terrain){
        if(!ack.value.sourceFence)throw Error('Speicherbestätigung des Pinselzugs unvollständig. Speicherstand klären.');
        this.terrainAuthor={revision:ack.value.revision,fence:ack.value.sourceFence};
        this.canvas.dataset.terrainAuthorRevision=String(ack.value.revision);
        this.terrainPresentation?.update(this.terrainAuthor);
        return{atlas:this.regions.data!,result:ack.value.result??null,ack:ack.value};
      }
      this.regions.loadedRegionQuery=null;
      if(this.regions.data)this.regions.data={...this.regions.data,revision:ack.value.revision,canUndo:ack.value.canUndo,canRedo:ack.value.canRedo};
      try{
        if(applyWorkspace){const initial=await window.campaign.workspaceInitial(w.token);if(!initial.ok)throw new Error(initial.error);await this.opts.updated(initial.value);}
        const endRefresh=terrainTraceStart("atlas.refresh",ack.value.revision);
        const loaded=await this.regions.refresh().finally(endRefresh);if(!loaded&&this.owner===w){get('atlas-save-status').textContent='Gespeichert. Kartenansicht erneut laden.';this.opts.status('Gespeichert. Kartenansicht erneut laden.',true);}
        if(a.kind==='city'&&(this.author.selection?.kind==='building'||this.author.selection?.kind==='city-unit'))await openCityReference(a.command.cityId,this.author.selection.id,true,true);
      }catch(error){if(this.owner===w)this.opts.status('Gespeichert. Kartenansicht erneut laden: '+(error as Error).message,true);}
      return{atlas:this.regions.data!,result:ack.value.result??null,ack:ack.value};
    } catch (e) {
      if (this.owner === w) this.error(e);
      if (propagateError) throw e;
      return null;
    } finally {
      if (this.owner === w) {
        this.busy = false;
        this.render();
      }
    }
  }
  private async history(kind: "undo" | "redo") {
    if(this.landscape.livePainting)return;
    if(this.landscape.routeHistory(kind))return;
    if (!(await this.opts.flush())) return;
    const result = await this.write({ kind }, true);
    if (result && this.cityId) await openCityReference(this.cityId,this.author.selection?.kind==='building'||this.author.selection?.kind==='city-unit'?this.author.selection.id:undefined,true,true);
  }
  private selectedGroupBinding(){const s=this.author.selection,scope=s?.kind==='building'||s?.kind==='scope'?s.id:s?.kind==='room'?(this.regions.data?.workspace.rooms.find(r=>r.id===s.id)??(this.opts.roomDraft()?.id===s.id?this.opts.roomDraft():null))?.scopeId:null;return this.regions.data?.bindings.find(b=>b.kind==='dungeon'&&b.ownerId===scope);}
  private selectedBinding() {
    const s = this.author.selection;
    return s?.kind === "city"
      ? this.regions.data?.bindings.find((b) => b.kind === "city" && b.ownerId === s.id)
      : s?.kind === "scope"
        ? this.regions.data?.bindings.find(
            (b) =>
              b.kind === "dungeon" &&
              b.ownerId === s.id &&
              b.parent === "world",
          )
        : null;
  }
  private chooseScope(id: string) {
    const b = this.regions.data?.bindings.find(
      (b) => b.kind === "dungeon" && b.ownerId === id,
    );
    if (!b) return;
    this.scopeId = id;
    this.floorId =
      this.regions.data!.workspace.floors.find((f) => f.scopeId === id)?.id ?? "ground";
    this.author.selection = { kind: "scope", id };
    void this.setFamily("interior", false).then(() => {
      this.syncDrawingFloor();
      const box=regionValue(this.regions.data?.region?.scopeBounds,id);this.focus(box?localToAtlas({x:box.x+box.width/2,y:box.y+box.height/2},atlasFrame(this.regions.data!,b)):atlasFrame(this.regions.data!,b),50);
    });
  }
  private frame(scopeId: string) {
    const b = this.regions.data?.bindings.find(
        (b) => b.kind === "dungeon" && b.ownerId === scopeId,
      ),
      f = b ? atlasFrame(this.regions.data!, b) : null;
    if(!f)throw new Error("Räumliche Einordnung wird geladen. Ausschnitt erneut laden.");
    if (
      b?.parent === "building" &&
      this.author.drag?.selection?.kind === "building" &&
      b.parentId === this.author.drag.selection.id
    ) {
      f.x += this.author.drag.last.x - this.author.drag.start.x;
      f.y += this.author.drag.last.y - this.author.drag.start.y;
    }
    return f;
  }
  private point(e: MouseEvent) {
    return this.camera.point(e);
  }
  private cancel() {
    this.camera.stopZoom();
    if(this.reference.active){this.reference.close();return;}
    this.creation=null;delete this.root.dataset.placing;
    if(this.output.exportOpen){this.output.exportDrag=null;this.output.exportCorner=null;this.output.exportChoosing=false;this.output.exportAreaStatus();this.render();return;}
    this.bindingDirty = false;
    this.author.brushId = null;
    this.author.vertexDrag = null;
    this.author.pathDrag = null;
    this.author.roomDrag = null;
    this.author.partyDrag = null;
    if (this.family === "interior" || this.family === "decoration")
      get("drawing-cancel").click();
    if (this.family === "city") get("city-cancel-path").click();
    this.author.entranceDraft = null;
    this.author.draft = [];
    this.author.drag = null;
    this.root.dataset.roomDraw = "false";
    get("atlas-draft-cancel").hidden = true;
    this.render();
  }
  private async setNavigationMode(pan:boolean){
    // Hand mode only changes camera input. The released stroke retains its writer
    // and tool until settlement; changing author families still requires flush.
    if(pan && this.landscape.livePainting && !this.landscape.blocksNavigation()){
      this.root.dataset.panMode='true';this.landscape.setActive(false);this.layout.sync();this.camera.redrawOverlay();return;
    }
    if(!await this.flush()||!await this.opts.flush())return;
    await this.setFamily('navigation',false);
    this.root.dataset.panMode=String(pan);this.layout.sync();
  }
  private async setFamily(f: Family, flush = true) {
    this.camera.stopZoom();
    if(this.reference.active)this.reference.close();
    if (flush && !(await this.opts.flush())) return;
    if (this.root.dataset.roomDraw === "true" && (this.author.draft.length || this.author.roomDrag)) { this.opts.status("Raumzug zuerst abschließen oder abbrechen.",true); return; }
    if (this.landscape.hasDraft()||this.territories.hasDraft()) { this.opts.status("Landschaftszug zuerst abschließen oder abbrechen.",true); return; }
    // An idle rectangle cursor is not a draft and must not capture the next tool's clicks.
    this.root.dataset.roomDraw="false";
    this.creation=null;delete this.root.dataset.placing;this.root.dataset.panMode="false";
    this.layout?.beforeTool();
    this.family = f;
    // Layout sync remembers matching tools; publish the accepted mode before it runs.
    this.root.dataset.family = f;
    this.landscape.setActive(!this.output.exportOpen&&f==="terrain");
    for (const b of get("atlas-families").querySelectorAll<HTMLButtonElement>(
      "button",
    ))
      b.setAttribute("aria-pressed", String(b.dataset.family === (f==='decoration'?'interior':f==='navigation'?this.root.dataset.editorSection:f)));
    get("atlas-tool-fields").dataset.family = f;
    this.dockDrawingTools(f === "interior" || f === "decoration" || (f === "navigation" && this.root.dataset.editorSection === "interior"));
    this.layout?.setFamily(f);
    if(f==='interior'||f==='decoration')await reloadDrawing();
    if (f === "city" && this.cityId) await openCityReference(this.cityId,undefined,true);
    if (f === "travel") {
      await this.regions.refresh();
      await openWorld();
      await openDungeon();
    }
    this.render();this.regions.scheduleRegion();
  }
  private dockDrawingTools(active: boolean) {
    if (!this.drawingDock.length) for (const id of ['map-hint', 'drawing-toolbar', 'drawing-path-status', 'drawing-tool-options']) {
      const node = get(id);
      this.drawingDock.push({node, parent: node.parentElement!, next: node.nextSibling});
    }
    const target = get('atlas-drawing-tools');
    target.hidden = !active;
    for (const saved of active ? this.drawingDock : [...this.drawingDock].reverse()) {
      if (active) target.append(saved.node);
      else saved.parent.insertBefore(saved.node, saved.next?.parentNode === saved.parent ? saved.next : null);
    }
  }
  private floorPlane(scopeId=this.scopeId,floorId=this.floorId):AtlasWorkplane|null {
    if(!this.regions.data||!scopeId)return null;
    const binding=this.regions.data.bindings.find(b=>b.kind==='dungeon'&&b.ownerId===scopeId);
    if(!binding)return null;
    const frame=atlasFrame(this.regions.data,binding);
    return {scopeId,elevationM:this.regions.data.geometry.floors?.find(f=>f.scopeId===scopeId&&f.id===floorId)?.elevation??0,anchor:{x:frame.x,y:frame.y}};
  }
  private syncDrawingFloor() {
    if (!this.scopeId) return;
    const select = get<HTMLSelectElement>("floors"),
      v = JSON.stringify([this.scopeId, this.floorId]);
    if ([...select.options].some((o) => o.value === v)) {
      if(select.value!==v){select.value = v;select.dispatchEvent(new Event("change"));}
    }
  }
  async navigateLocation(id:string,sectionId?:string){await this.regions.refresh();await this.setFamily('terrain',false);const p=await this.landscape.openLocation(id,sectionId);if(p)this.focus(p,15000);}
  async navigate(kind:"city"|"room",id:string,unitId?:string){
    const owner=this.owner;if(!owner)return;
    if(!await this.opts.flush()||this.owner!==owner)return;
    this.regions.request++;
    const request=++this.searchRequest,result=await window.campaign.atlasObjectFocus(owner.token,unitId?'building':kind,unitId??id);
    if(this.owner!==owner||request!==this.searchRequest)return;if(!result.ok)throw new Error(result.error);
    const target=result.value;
    if(kind==='city'){
      get<HTMLSelectElement>("city-tool").value="select";
      this.cityId=id;this.scopeId=target.interiorScopeId??null;this.floorId='ground';this.author.selection=unitId?{kind:target.kind==='building'?'building':'city-unit',id:unitId,cityId:id}:{kind:'city',id};
      await this.setFamily('city',false);if(this.owner!==owner)return;await openCityReference(id,unitId,true);
    }else{
      get<HTMLSelectElement>('drawing-tool').value='select';
      this.author.selection={kind:'room',id};this.scopeId=target.scopeId!;this.floorId=target.floorId!;
      await this.opts.selectRoom(id);if(this.owner!==owner)return;await this.setFamily('interior',false);this.syncDrawingFloor();
    }
    if(this.owner!==owner||request!==this.searchRequest)return;
    this.focus(target.point,Math.max(kind==='city'&&!unitId?60:30,target.box.width*1.4),Math.max(kind==='city'&&!unitId?60:30,target.box.height*1.4));
    await this.regions.refresh();this.layout?.showPane('selection');
  }
  private async navigateScope(id:string){
    const owner=this.owner;if(!owner||!await this.opts.flush())return;
    const r=await window.campaign.atlasObjectFocus(owner.token,'scope',id);if(this.owner!==owner)return;if(!r.ok)throw new Error(r.error);
    this.scopeId=id;this.floorId=r.value.floorId!;this.author.selection={kind:'scope',id};await this.setFamily('interior',false);this.syncDrawingFloor();
    this.focus(r.value.point,Math.max(50,r.value.box.width*1.4),Math.max(50,r.value.box.height*1.4));await this.regions.refresh();
  }
  private async navigateElement(id:string,focus=true){
    const owner=this.owner;if(!owner||!await this.opts.flush())return;
    const r=await window.campaign.atlasObjectFocus(owner.token,'element',id);if(this.owner!==owner)return;if(!r.ok)throw new Error(r.error);
    this.scopeId=r.value.scopeId!;this.floorId=r.value.floorId!;
    const exact=await window.campaign.drawingElement(owner.token,id);if(this.owner!==owner)return;if(!exact.ok)throw new Error(exact.error);
    if(exact.value.roomId)await this.opts.selectRoom(exact.value.roomId);if(this.owner!==owner)return;
    await this.setFamily(exact.value.kind==='path'?'interior':'decoration',false);this.syncDrawingFloor();await selectElement(id);
    this.author.selection={kind:'element',id};
    if(focus)this.focus(r.value.point,Math.max(30,r.value.box.width*2),Math.max(30,r.value.box.height*2));
    await this.regions.refresh();this.layout?.showPane('selection');this.root.querySelector('#atlas-secondary-content')?.scrollTo?.(0,0);
  }
  private focus(p: Point, width: number, height=width) {
    const ratio = Math.max(1,this.canvas.clientHeight) / Math.max(1, this.canvas.clientWidth);
    width=Math.max(width,height/ratio);
    this.camera.set(
      {
        x: p.x - width / 2,
        y: p.y - (width * ratio) / 2,
        width,
        height: width * ratio,
      },
      true,
    );
  }
  private overview() {
    const b=this.camera.view;this.camera.set(earthView(this.canvas.clientWidth/Math.max(1,this.canvas.clientHeight),{x:b.x+b.width/2,y:b.y+b.height/2}),true);
  }
  private toParty() {
    const p = this.regions.data?.geometry.position;
    if (p) {
      this.scopeId = p.scopeId;
      this.floorId = p.floorId;
      this.focus(localToAtlas(p, this.frame(p.scopeId)), 50);
    } else if (this.regions.data?.scene) {
      this.focus(
        atlasPartyPoint(this.regions.data)!,
        this.regions.data.scene.position.city || this.regions.data.scene.position.outdoor
          ? 80
          : this.regions.data.terrain.hexMeters * 5,
      );
    }
    this.render();
  }
  private search() {
    const request=++this.searchRequest;
    const root = get("atlas-search-results");
    root.replaceChildren();
    const text = get<HTMLInputElement>("atlas-search").value.trim()
      .toLocaleLowerCase("de");
    if (!text || !this.owner) return;
    const add = (name: string, fn: () => void) => {
      const b = document.createElement("button");
      b.textContent = name;
      b.onclick = () => {
        root.replaceChildren();
        fn();
      };
      root.append(b);
    };
    const token=this.owner!.token;

    const current=()=>request===this.searchRequest&&this.owner?.token===token&&get<HTMLInputElement>('atlas-search').value.trim().toLocaleLowerCase('de')===text;
    const more=(title:string,load:()=>Promise<void>)=>{const b=document.createElement('button');b.textContent=title;b.onclick=()=>{b.remove();void load().catch(e=>{if(current())this.error(e);});};root.append(b);};
    const page=async(kind:'landscape'|'scope',cursor?:import('./campaign-atlas-contracts').AtlasObjectQuery['cursor'])=>{
      const result=await window.campaign.atlasObjects(token,{kind,text,limit:40,cursor});if(!current())return;if(!result.ok)throw new Error(result.error);
      for(const item of result.value.items)add(item.name,()=>void (kind==='landscape'?this.navigateLandscape(item.id).catch(e=>this.error(e)):this.navigateScope(item.id).catch(e=>this.error(e))));
      if(result.value.next)more(kind==='scope'?'Weitere Dungeons':'Weitere Landschaftsobjekte',()=>page(kind,result.value.next!));
    };
    const rooms=async(cursor?:import('./contracts').RoomDirectoryQuery['cursor'])=>{
      const result=await window.campaign.roomDirectory(token,{text,limit:40,...(cursor?{cursor}: {})},'atlas');if(!current())return;if(!result.ok)throw new Error(result.error);
      for(const item of result.value.items)add(item.number+' · '+item.name,()=>void this.navigate('room',item.id));
      if(result.value.unreadable){const warning=document.createElement('p');warning.setAttribute('role','alert');warning.textContent=result.value.unreadable+' Raumtexte konnten nicht durchsucht werden.';root.append(warning);}
      if(result.value.next)more('Weitere Räume',()=>rooms(result.value.next!));
    };
    const areas=async()=>{const result=await window.campaign.atlasTerritories(token);if(!current())return;if(!result.ok)throw Error(result.error);for(const area of result.value.territories.filter(t=>t.polygons.length&&t.name.toLocaleLowerCase('de').includes(text)))add('Gebiet · '+area.name,()=>void this.navigateTerritory(area.id).catch(e=>this.error(e)));};
    const buildings=async(offset=0)=>{const result=await window.campaign.cityBuildings(token,{text,offset});if(!current())return;if(!result.ok)throw new Error(result.error);for(const item of result.value.items)add('Haus · '+item.title,()=>void this.navigate('city',item.cityId,item.unitId));if(result.value.next!==null)more('Weitere Häuser',()=>buildings(result.value.next!));};
    for(const task of [rooms(),areas(),page('landscape'),page('scope'),buildings()])void task.catch(e=>{if(current())this.error(e);});

  }

  private async navigateTerritory(id:string){
    const owner=this.owner;if(!owner||!await this.flush()||!await this.opts.flush()||owner!==this.owner)return;
    await this.setFamily('terrain',false);this.author.selection=null;get<HTMLSelectElement>('land-tool').value='territory';this.territories.sync(owner.token);await this.territories.select(id);this.layout?.showPane('tool');this.render();
  }

  private async navigateLandscape(id:string) {
    const owner=this.owner;if(!owner||!await this.flush()||!await this.opts.flush()||this.owner!==owner)return;
    const result=await window.campaign.atlasLandscapeObject(owner.token,id);
    if(this.owner!==owner)return;
    if(!result.ok){this.error(new Error(result.error));return;}
    const record=result.value;
    await this.setFamily('terrain',false);if(this.owner!==owner)return;
    if(record.points[0])this.focus(record.points[0],15000);
    await this.landscape.selectId(record.id);
  }

  private beginPlacement(kind:"city"|"dungeon"){
    this.creation=kind;this.root.dataset.placing=kind;this.layout.showPane('tool');
    get('atlas-hint').textContent=(kind==='city'?'Stadt':'Dungeon')+' auf der Karte platzieren. Name links einstellen. Escape bricht ab.';this.render();this.canvas.focus();
  }
  private async createCity() {
    const r = await this.write({
      kind: "city-create",
      name: get<HTMLInputElement>("atlas-new-name").value || "Neue Stadt",
      x: this.author.lastPoint.x,
      y: this.author.lastPoint.y,
      width: 500,
      height: 500,
    });
    if (r) {
      const id = (r.result as { id: string }).id;
      await this.navigate("city", id);
    }
  }
  private async createRoomGroup(mode:'interior'|'building'='interior') {
    const owner=this.owner,at={...this.author.lastPoint};
    const building=mode==='building';
    const recipe=await chooseRoomGroup({version:1,profile:building?'Wohnhaus':'Gewölbe',width:18,depth:20,seed:crypto.randomUUID().slice(0,8)},!building);
    if(!recipe||this.owner!==owner)return;

    const r = await this.write(
      {
        ...(recipe==='empty'?{kind:"dungeon-create" as const}:{kind:"group-generate" as const,recipe}),
        name: get<HTMLInputElement>("atlas-new-name").value || (recipe==='empty'?'Neue Raumgruppe':recipe.profile),
        x: at.x,
        y: at.y,
      },
      true,
    );
    if (r && this.owner===owner) {
      if(building){
        this.author.selection={kind:'scope',id:(r.result as {id:string}).id};
        this.render();
        return;
      }
      this.scopeId = (r.result as { id: string }).id;
      this.floorId = "ground";
      this.author.selection = { kind: "scope", id: this.scopeId };
      await this.setFamily("interior", false);
      this.syncDrawingFloor();
      this.focus(this.author.lastPoint, 50);
    }
  }
  private async chooseAt(point:Point,layer:'geometry'|'landscape'|'all'='all',visualElementId?:string){
    const owner=this.owner,query=this.regions.loadedRegionQuery,fence=this.regions.data?.region?.fence,version=++this.hitVersion;
    if(!owner||!query||!fence||!this.regions.geometryCurrent())return;
    const valid=()=>this.owner===owner&&this.regions.data?.region?.fence===fence&&this.hitVersion===version&&this.regions.geometryCurrent();
    const choose=async(hit:import('./atlas-region-contracts').AtlasHit)=>{
      if(!valid())return;this.hitDialog.close();
      if(hit.kind==='landscape'){await this.setFamily('terrain');if(this.owner===owner&&this.regions.data?.region?.fence===fence)await this.landscape.selectId(hit.id);}
      else if(hit.kind==='element')await this.navigateElement(hit.id,false);
      else if(hit.kind==='scope')await this.navigateScope(hit.id);
      else await this.navigate(hit.kind==='room'?'room':'city',hit.cityId??hit.id,hit.cityId?hit.id:undefined);
    };
    const page=async(offset:number)=>{
      const reply=await window.campaign.atlasRegionCandidates(owner.token,query,point,fence,offset,layer,visualElementId);
      if(!valid())return;if(!reply.ok)throw new Error(reply.error);const result=reply.value;
      const unavailable=[...new Set([...(result.unavailable??[]),...(layer!=='geometry'&&this.regions.data?.region?.landscape?.state==='error'?['landscape' as const]:[])])],incomplete=!!unavailable.length;
      if(result.total===1&&offset===0&&!incomplete){await choose(result.items[0]!);return;}
      if(!result.items.length){this.opts.status(incomplete?'Auswahl unvollständig: Eine Kartenebene ist nicht verfügbar. Ansicht erneut laden.':'Hier ist kein passendes Objekt.',incomplete);return;}
      this.hitDialog.replaceChildren();const title=document.createElement('h2');title.textContent='Objekt an dieser Stelle auswählen';this.hitDialog.append(title);
      const count=document.createElement('p');count.textContent=result.total+' Treffer · '+(offset+1)+'–'+(offset+result.items.length);this.hitDialog.append(count);
      if(incomplete){const warning=document.createElement('p');warning.setAttribute('role','alert');warning.textContent='Auswahl unvollständig: '+unavailable.map(layer=>layer==='landscape'?'Landschaft':'Raum-/Stadtgeometrie').join(', ')+' nicht verfügbar. Verfügbare Treffer können geöffnet werden; Ansicht erneut laden.';this.hitDialog.append(warning);}
      for(const hit of result.items){const button=document.createElement('button');button.type='button';button.textContent=({landscape:'Landschaft',room:'Raum',building:'Haus',element:'Objekt',scope:'Dungeon',city:'Stadt','city-unit':'Stadtelement'}[hit.kind])+': '+hit.name;button.onclick=()=>void choose(hit).catch(e=>this.error(e));this.hitDialog.append(button);}
      if(offset>0){const back=document.createElement('button');back.textContent='Vorige Treffer';back.onclick=()=>void page(Math.max(0,offset-40)).catch(e=>this.error(e));this.hitDialog.append(back);}
      if(result.next!==null){const next=document.createElement('button');next.textContent='Weitere Treffer';next.onclick=()=>void page(result.next!).catch(e=>this.error(e));this.hitDialog.append(next);}
      const cancel=document.createElement('button');cancel.textContent='Abbrechen';cancel.onclick=()=>this.hitDialog.close();this.hitDialog.append(cancel);if(!this.hitDialog.open)this.hitDialog.showModal();
    };await page(0);
  }
  private async doorRoomAt(p:Point) {
    const owner=this.owner,query=this.regions.loadedRegionQuery,fence=this.regions.data?.region?.fence,scope=this.scopeId,floor=this.floorId;
    const valid=()=>this.owner===owner&&this.regions.data?.region?.fence===fence&&this.scopeId===scope&&this.floorId===floor&&this.regions.geometryCurrent();
    if(!owner||!query||!fence||!scope||!valid())throw new Error('Karte zuerst laden.');
    const response=await window.campaign.atlasRegionCandidates(owner.token,query,p,fence,0,'geometry');
    if(!valid())throw new Error('Kartenausschnitt inzwischen geändert. Tür erneut platzieren.');
    if(!response.ok)throw new Error(response.error);
    if(response.value.unavailable?.includes('geometry'))throw new Error('Raumgeometrie nicht verfügbar. Ansicht erneut laden.');
    const hits=response.value.items.filter(h=>h.kind==='room'&&h.scopeId===scope&&h.floorId===floor);
    const selected=this.opts.roomDraft(),preferred=hits.find(h=>h.id===selected?.id);
    if(hits.length>2&&!preferred)throw new Error('Mehrere überlagerte Räume. Gewünschten Raum zuerst auswählen.');
    const ids=preferred?[preferred.id]:hits.length?hits.map(h=>h.id):selected?.scopeId===scope&&selected.floorId===floor?[selected.id]:[];
    const local=atlasToLocal(p,this.frame(scope)),maxDistance=this.camera.view.width/Math.max(1,this.canvas.clientWidth)*8;
    const candidates=[];
    for(const id of ids){
      const r=await window.campaign.atlasRoom(owner.token,id);
      if(!valid())throw new Error('Kartenausschnitt inzwischen geändert. Tür erneut platzieren.');
      if(!r.ok)throw new Error(r.error);
      const anchor=nearestAnchor(local,r.value);
      if(anchor&&anchor.distance<=maxDistance)candidates.push({room:r.value,anchor});
    }
    candidates.sort((a,b)=>a.anchor.distance-b.anchor.distance);
    const target=candidates[0];if(!target)throw new Error('Tür an einer Raumwand platzieren.');
    // A shared boundary may bind to either room. Distinct overlapping walls require a GM choice.
    const other=candidates[1];
    if(other&&Math.abs(other.anchor.distance-target.anchor.distance)<1e-6){
      const segment=(c:typeof target)=>{const ring=c.room.polygons[c.anchor.polygon]!.outer,a=ring[c.anchor.edge]!,b=ring[(c.anchor.edge+1)%ring.length]!,dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),center={x:a.x+dx*c.anchor.t,y:a.y+dy*c.anchor.t};return[{x:center.x-dx/length,y:center.y-dy/length},{x:center.x+dx/length,y:center.y+dy/length}];};
      const a=segment(target),b=segment(other),same=(p:Point,q:Point)=>Math.hypot(p.x-q.x,p.y-q.y)<1e-6;
      if(!((same(a[0]!,b[0]!)&&same(a[1]!,b[1]!))||(same(a[0]!,b[1]!)&&same(a[1]!,b[0]!))))throw new Error('Mehrere Wände an dieser Stelle. Gewünschten Raum zuerst auswählen.');
    }
    return{room:target.room,maxDistance};
  }
  private renderPanel(data:AtlasRenderView){
    this.terrainAnalysis?.sync(this.owner!.token,data.revision);
    const key=[data,this.landscape.selectionId,selectedDrawingElementId(),this.owner?.token,this.family,this.author.selection?.kind,this.author.selection?.id,this.scopeId,this.floorId,this.busy,this.landscape.livePainting,this.journey.pendingTravel,pendingAtlasWrite(this.owner?.token??''),this.bindingDirty,get('atlas-placement').contains(document.activeElement),this.opts.roomDraft()?.name,get<HTMLSelectElement>('drawing-tool').value];
    if(this.panelKey?.length===key.length&&this.panelKey.every((v,i)=>v===key[i]))return;
    this.panelKey=key;
    get("atlas-recover").hidden =
      !this.journey.pendingTravel &&
      (!this.owner || !pendingAtlasWrite(this.owner.token));
    const selectedBinding = this.selectedBinding();
    get("atlas-placement").hidden = !selectedBinding&&!this.selectedGroupBinding();
    get("atlas-binding-pose").hidden=!selectedBinding;
    get("atlas-group-size").hidden=!this.selectedGroupBinding();
    get("atlas-split-controls").hidden=this.author.selection?.kind!=="room";
    if (
      selectedBinding &&
      !this.bindingDirty &&
      !get("atlas-placement").contains(document.activeElement)
    ) {
      setAtlasFieldValue(get<HTMLInputElement>("atlas-binding-x"), String(
        selectedBinding.x,
      ));
      setAtlasFieldValue(get<HTMLInputElement>("atlas-binding-y"), String(
        selectedBinding.y,
      ));
      get<HTMLInputElement>("atlas-binding-angle").value=String(
        (selectedBinding.angle * 180) / Math.PI,
      );
    }
    get<HTMLButtonElement>("atlas-undo").disabled = this.busy || this.landscape.livePainting || !data.canUndo;
    get<HTMLButtonElement>("atlas-redo").disabled = this.busy || this.landscape.livePainting || !data.canRedo;
    get("atlas-connect-entrance").hidden =
      this.author.selection?.kind !== "room" || this.family !== "interior" || get<HTMLSelectElement>("drawing-tool").value === "door";
    get("atlas-local-console").hidden = this.family !== "travel";
    get("atlas-create-tools").hidden = this.family !== "navigation";
    const nameLabel = get("atlas-name-label");
    if (nameLabel) nameLabel.textContent = this.family === "interior" ? "Name für neuen Raum" : "Name";
    const roomView = get("atlas-room-view");
    if (roomView) roomView.hidden = false;
    get("atlas-floor-field").hidden = !this.scopeId;
    get("atlas-room-draw").hidden = !this.scopeId || !["interior","decoration"].includes(this.family);
    for (const id of ["atlas-slice-enabled", "atlas-slice", "atlas-roofs"])
      get(id).closest<HTMLElement>("label")!.hidden = !this.scopeId;

    const title =
      this.author.selection?.kind === 'element'
        ? atlasDrawingDraft().element?.name || (atlasDrawingDraft().element?.kind==='path'?'Pfad':'Element')
      : this.author.selection?.kind === "room"
        ? (this.opts.roomDraft()?.id===this.author.selection.id?this.opts.roomDraft()?.name:null) ?? data.workspace.rooms.find((r) => r.id === this.author.selection!.id)?.name
        : this.author.selection?.kind === "building" ||
            this.author.selection?.kind === "city-unit"
          ? data.cities
              .find(
                (c) =>
                  c.header.id === (this.author.selection as { cityId: string }).cityId,
              )
              ?.units.find((u) => u.id === this.author.selection!.id)?.name
          : this.author.selection?.kind === "city"
            ? data.cities.find((c) => c.header.id === this.author.selection!.id)
                ?.header.name
            : null;
    get("atlas-selection-title").textContent = get<HTMLSelectElement>("drawing-tool").value === "door" && ["interior","decoration"].includes(this.family) ? "Türen setzen" : title || "Deine Kampagnenwelt";
    if(this.output.exportOpen&&!this.output.exporting)this.output.exportAreaStatus();
    this.root.dataset.citySelected=String(!!this.cityId);
    this.root.dataset.elementSelected=String(this.author.selection?.kind==='element');
    const elementId=['interior','decoration'].includes(this.family)?selectedDrawingElementId():null;
    const selectedKey=this.family==='terrain'?(this.landscape.selectionId?'landscape:'+this.landscape.selectionId:null):elementId?'element:'+elementId:this.author.selection?this.author.selection.kind+':'+this.author.selection.id:null;
    this.layout?.selectionChanged(selectedKey,false,!this.author.rectangleCommit);
    get("atlas-create-dungeon").hidden=!["navigation","interior","decoration"].includes(this.family);
    get("atlas-create-city").hidden=!["navigation","city"].includes(this.family);
    const floor = get<HTMLSelectElement>("atlas-floor"),
      floors = data.workspace.floors.filter((f) => f.scopeId === this.scopeId);
    const floorKey=JSON.stringify([atlasUnits(),this.scopeId,floors.map(f=>[f.id,f.name,f.sourceElevation])]);
    if(this.floorOptionsKey!==floorKey){
      this.floorOptionsKey=floorKey;floor.replaceChildren();
      for(const f of floors){const option=document.createElement('option');option.value=f.id;option.textContent=f.name+' · '+lengthLabel(f.sourceElevation);floor.append(option);}
    }
    if(floors.some(f=>f.id===this.floorId))floor.value=this.floorId;
  }
  private updateHexLabels(){
    const select=get<HTMLSelectElement>('atlas-hex-level');
    for(const option of Array.from(select.options)){const preset=travelHexSizes.find(p=>p.id===option.value);if(preset)option.textContent=`${preset.label} · ${lengthLabel(preset.meters)} Kante zu Kante`;}
    for(const option of Array.from(get<HTMLSelectElement>('atlas-floor').options)){const floor=this.regions.data?.workspace.floors.find(f=>f.id===option.value&&f.scopeId===this.scopeId);if(floor)option.textContent=floor.name+' · '+lengthLabel(floor.sourceElevation);}
  }
  private brushControls=new Map<string,BrushSizeControl>();
  private cameraDraftPending(navigation=false){
    const land=navigation?this.landscape.blocksNavigation(false):this.landscape.hasDraft(false);
    return !!(this.busy&&!(navigation&&this.landscape.livePainting)||land||this.territories.hasDraft()||
      this.author.draft.length||this.author.brushId!==null||this.author.drag||this.author.vertexDrag||this.author.pathDrag||
      this.author.roomDrag||this.author.partyDrag||this.author.entranceDraft||this.author.placeIntent||this.output.exportDrag||
      this.output.exportCorner||atlasCityState()||atlasDrawingHasDraft());
  }
  private brushDraftPending(navigation=false){
    const land=!!(navigation?this.landscape?.blocksNavigation():this.landscape?.hasDraft())&&['height','smooth','color','property','freshwater','hex','reset','vegetation','vegetation-clear','vegetation-thin','vegetation-dense','vegetation-line'].includes(get<HTMLSelectElement>('land-tool').value);
    const drawing=['interior','decoration'].includes(this.family)&&['room-cave','room-erase','scatter'].includes(get<HTMLSelectElement>('drawing-tool').value)&&atlasDrawingDraft().path.length>0;
    return land||!!this.landscape?.routeGesture||!!this.territories?.hasDraft()||this.author.brushId!==null||drawing;
  }
  private syncBrushSizes(scale?:number){
    if(!this.camera)return;
    // Drawing already owns the current viewport measurement. Only immediate
    // input boundaries need a fresh DOM read before the next painted frame.
    if(scale===undefined){const b=this.camera.view,r=this.canvas.getBoundingClientRect();scale=Math.max(b.width/Math.max(1,r.width),b.height/Math.max(1,r.height));}
    const locked=this.brushDraftPending();
    for(const [id,c]of this.brushControls){
      let tool=id==='drawing-brush'?get<HTMLSelectElement>('drawing-tool').value:id==='territory-radius'?'territory':get<HTMLSelectElement>('land-tool').value;
      if(id==='land-radius'&&tool==='color')tool+=':'+get<HTMLSelectElement>('land-color-target').value+':'+get<HTMLSelectElement>('land-color-operation').value;
      if(id==='land-radius'&&tool==='freshwater')tool+=':'+get<HTMLSelectElement>('land-freshwater-operation').value;
      c.sync(id+':'+tool,scale,locked);
    }
  }
  private render(preview=false) {
    const data=this.regions.data;
    if(this.root.hidden)return;
    if(!data){
      const opening=this.regions.openingSurface;
      if(opening?.owner===this.owner&&opening.revision!==undefined)this.spatial?.sync(this.owner!.token,this.camera.view,opening.revision,[],this.landscape.contours());
      return;
    }
    this.renderPanel(data);this.journey.renderTravel();this.layout?.sync();this.territories.sync(this.owner?.token??'');
    // During a direct GPU gesture TerrainPresentation owns confirmed frames
    // and the spatial view owns the draft. Save-state notifications only need
    // controls/HUD here. Finish clears the presentation before refreshing the
    // author scene; the Canvas fallback still needs its ordinary scene rebuild.
    // Radius controls share the ensuing frame measurement. Do not schedule an
    // additional old-scene frame when the ordinary scene is being rebuilt below.
    if(this.landscape.livePainting&&this.terrainPresentation&&this.spatial?.active){this.camera.redrawOverlay();return;}
    const box = this.camera.view;
    get('atlas-entrance-height').hidden=!(this.author.selection?.kind==='room'&&data.entrances.some(e=>e.roomId===this.author.selection!.id));
    this.spatial?.sync(this.owner!.token,box,data.revision,data.region?.landscape?.records??[],this.landscape.contours(),data,{mpp:box.width/Math.max(1,this.canvas.clientWidth),roofs:get<HTMLInputElement>('atlas-roofs').checked,scopeId:this.scopeId});
    this.canvas.dataset.atlasOriginX = String(box.x);
    this.canvas.dataset.atlasOriginY = String(box.y);
    const mpp = box.width / Math.max(1, this.canvas.clientWidth);
    // Keep the last confirmed scene intact while a new filter/source is loading.
    // In particular, never interpret old contours under new floor/roof/slice controls.
    if(!this.regions.geometryCurrent()&&!(preview&&this.regions.geometryCoversView())){this.camera.redrawOverlay();return;}
    this.camera.render((root) => {
      this.drawing.drawTerrain(root, box, mpp);
      this.landscape.draw(root,box,mpp);
      const draft=this.opts.roomDraft(),cacheable=!this.author.drag&&!atlasCityState()&&!atlasDungeonState().preview&&!get<HTMLInputElement>('atlas-perception').checked;
      const key=[data,this.scopeId,this.floorId,this.family,this.author.selection?.kind,this.author.selection?.id,get<HTMLInputElement>('atlas-roofs').checked,get<HTMLInputElement>('atlas-slice-enabled').checked,atlasFieldValue(get<HTMLInputElement>('atlas-slice')),get<HTMLInputElement>('atlas-perception').checked,mpp,draft?.id,draft?.name,draft?.number,draft?.polygons];
      let base=this.drawing.baseGeometry;
      if(!cacheable||!base||!base.key.every((v,i)=>v===key[i])){
        const root=shape('group',{retainGeometry:true,data:{mapScene:'true'}});
      for (const citySaved of data.cities) {
        const binding = data.bindings.find(
          (b) => b.kind === "city" && b.ownerId === citySaved.header.id,
        );
        if (!binding) continue;
        const preview = atlasCityState(),
          city =
            preview?.view.header.id === citySaved.header.id &&
            preview.view.header.revision >= citySaved.header.revision
              ? preview.view
              : citySaved,
          f = atlasFrame(data, binding),
          g = shape("group", {matrix: frameMatrix(this.drawing.relative(f))});
        let shownCity = city;
        if (
          this.author.drag?.selection?.kind === "building" &&
          this.author.drag.selection.cityId === city.header.id
        ) {
          const drag = this.author.drag,
            a = atlasToLocal(drag.start, f),
            b = atlasToLocal(drag.last, f);
          shownCity = {
            ...city,
            units: city.units.map((u) =>
              u.id === drag.selection!.id && u.position
                ? {
                    ...u,
                    position: {
                      x: u.position.x + b.x - a.x,
                      y: u.position.y + b.y - a.y,
                    },
                  }
                : u,
            ),
          };
        }
        const coverage=data.region?.box??box;
        const corners = [
            { x: coverage.x, y: coverage.y },
            { x: coverage.x + coverage.width, y: coverage.y },
            { x: coverage.x, y: coverage.y + coverage.height },
            { x: coverage.x + coverage.width, y: coverage.y + coverage.height },
          ].map((p) => atlasToLocal(p, f)),
          xmin = Math.min(...corners.map((p) => p.x)),
          xmax = Math.max(...corners.map((p) => p.x)),
          ymin = Math.min(...corners.map((p) => p.y)),
          ymax = Math.max(...corners.map((p) => p.y));
        const visibleUnits = shownCity.units.filter((u) => {
          if (u.kind === "node") return true;
          const pts =
            u.kind === "building"
              ? posedFootprint(u).flatMap(p=>p.outer)
              : ["road", "wall"].includes(u.kind)
                ? roadPoints(u, shownCity.units)
                : (u.outline ?? []);
          if (
            u.kind === "building" &&
            pts.length &&
            Math.max(
              Math.max(...pts.map((p) => p.x)) -
                Math.min(...pts.map((p) => p.x)),
              Math.max(...pts.map((p) => p.y)) -
                Math.min(...pts.map((p) => p.y)),
            ) <
              mpp * 2
          )
            return false;
          return (
            pts.length &&
            Math.max(...pts.map((p) => p.x)) >= xmin &&
            Math.min(...pts.map((p) => p.x)) <= xmax &&
            Math.max(...pts.map((p) => p.y)) >= ymin &&
            Math.min(...pts.map((p) => p.y)) <= ymax
          );
        });
        const cityScene = cityObjectsPaint({ ...shownCity, units: visibleUnits }, false,mpp);
        for (const c of cityScene.children) {
          const uid = c.data.cityUnit,
            interior = data.bindings.find(
              (b) => b.parent === "building" && b.parentId === uid,
            )??(uid&&regionValue(data.region?.interiors,uid)?{ownerId:regionValue(data.region?.interiors,uid)!}:null);
          if (
            interior &&
            (!get<HTMLInputElement>("atlas-roofs").checked ||
              mpp <= 0.4 ||
              interior.ownerId === this.scopeId)
          ) {
            for (const p of c.children.filter(child => ["polygon","polygons"].includes(child.kind))) {
              p.style.fill=null;
              p.style.stroke="#624337";
              p.style.lineWidth=Math.max(.15,mpp);
              if (
                interior.ownerId === this.scopeId &&
                this.floorId !== "ground"
              )
                p.geometry.hidden=true;
            }
          }
          for (const text of [
            c,
            ...c.children.filter(child => child.kind === "text"),
          ].filter((n) => n.kind === "text"))
            text.style.fontSize=Math.min(text.style.fontSize??6,12*mpp);
          g.append(c);
        }
        for (const u of visibleUnits
          .filter((u) => u.kind !== "node")
          .sort(
            (a, b) =>
              Number(a.kind === "building") - Number(b.kind === "building"),
          )) {
          const line = ["road", "wall"].includes(u.kind),
            points =
              u.kind === "building"
                ? posedFootprint(u).flatMap(p=>p.outer)
                : line
                  ? roadPoints(u, shownCity.units)
                  : (u.outline ?? []),
            path = shape(line ? "polyline" : u.kind==='building'?"polygons":"polygon", {
              ...(u.kind==='building'?{polygons:posedFootprint(u)}:{points}),style:{fill:line?null:"transparent",stroke:this.author.selection?.id===u.id?"#b85525":"transparent",lineWidth:line?Math.max(u.width??6,mpp*8):2*mpp},
            });
          path.data.atlasObject = "true";
          path.data.kind = u.kind === "building" ? "building" : "city-unit";
          path.data.id = u.id;
          path.data.cityId = city.header.id;
          g.append(path);
        }
        if (preview?.view.header.id === city.header.id && preview.path.length)
          g.append(
            shape("polyline", {points:preview.path, style: {fill: null, stroke: "#c65d28", lineWidth: 2 * mpp}}),
          );
        root.append(g);
      }
      for (const binding of data.bindings.filter((b) => b.kind === "dungeon"))
        if(!data.region?.raster)this.drawing.drawInterior(root, binding, box, mpp);
      if(data.region?.raster){const r=data.region.raster;const image=shape("image", {x: r.box.x-box.x, y: r.box.y-box.y, width: r.box.width, height: r.box.height, source: r.data});image.geometry.pointer=false;root.append(image);for(const b of data.bindings.filter(b=>b.kind==='dungeon')){const floor=data.geometry.position?.scopeId===b.ownerId?data.geometry.position.floorId:b.ownerId===this.scopeId?this.floorId:'ground',g=shape("group", {matrix: frameMatrix(this.drawing.relative(atlasFrame(data,b)))});this.drawing.drawInteriorRuntime(g,b,floor,mpp,[]);root.append(g);}}
        base={key,node:root,origin:{x:box.x,y:box.y},authorSlot:this.drawing.authorFaceSlot(root)};
        this.drawing.baseGeometry=cacheable?base:null;
      }
      const retained=shape('group',{matrix:[1,0,0,1,base.origin.x-box.x,base.origin.y-box.y],data:{atlasBase:'true'}});
      retained.append(base.authorSlot?this.drawing.withAuthorFace(base.node,base.authorSlot,mpp):base.node);root.append(retained);
      if (this.author.roomDrag?.moved) {
        const f=this.frame(this.author.roomDrag.scopeId),a=atlasDrawingSnapPoint(atlasToLocal(this.author.roomDrag.start,f)),b=atlasDrawingSnapPoint(atlasToLocal(this.author.roomDrag.last,f));
        root.append(shape("polygon", {polygons:[{outer:[a,{x:b.x,y:a.y},b,{x:a.x,y:b.y}].map(p=>this.drawing.relativePoint(localToAtlas(p,f))),holes:[]}],style:{fill:"#ead9a5",stroke:"#c65d28",lineWidth:2*mpp},data:{editorOnly:"true",...atlasWorkplaneData(this.floorPlane(this.author.roomDrag.scopeId))}}));
      }
      if (this.author.draft.length && this.scopeId) {
        const f = this.frame(this.scopeId),
          p = localToAtlas(this.author.draft[0]!, f);
        root.append(
          shape("circle", {x: p.x - box.x, y: p.y - box.y, radius: mpp * 4, style: {fill: "#c65d28"},data:atlasWorkplaneData(this.floorPlane())}),
        );
      }

      if(!get<HTMLInputElement>('atlas-perception').checked){const raster=data.region?.territoryRaster;if(raster)root.append(shape('image',{source:raster.data,x:raster.box.x-box.x,y:raster.box.y-box.y,width:raster.box.width,height:raster.box.height,pointer:false}));const state=data.region?.territories;if(state)drawTerritories(root,state,box,mpp);const candidates=[...(data.region?.labels??[]),...(data.region?.landscape?.labels??[])];const selected=this.territories.selectedLabel??this.landscape.selectedLabel??(this.author.selection?(['building','city-unit'].includes(this.author.selection.kind)?'unit':this.author.selection.kind)+':'+this.author.selection.id:undefined);paintMapLabels(root,this.drawing.labelLayout.layout(candidates,box,mpp,measureMapText,selected, !this.spatial?.active&&!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches),box,mpp,{candidates,selected});if(this.drawing.labelLayout.animating)this.scheduleRender();}
      if(!this.output.exportOpen){this.drawing.drawInteriorAuthor(root,mpp);this.territories.draw(root,box,mpp);}
      if(this.output.exportOpen){
        const b=this.output.exportDrag?.moved?this.output.exportRectangle(this.output.exportDrag.start,this.output.exportDrag.last):this.output.exportDungeon?this.output.dungeonOutputBox():this.output.exportBox;
        if(b)root.append(shape('rect',{x:b.x-box.x,y:b.y-box.y,width:b.width,height:b.height,pointer:false,style:{fill:null,stroke:'#a84720',lineWidth:2*mpp,lineDash:[8*mpp,5*mpp]},data:{editorOnly:'true'}}));
      }
      const travel = atlasWorldTravelState(),
        route = atlasWorldRoute(data,travel.preview);
      if (route.length)
        root.append(
          shape("polyline", {points: route
              .map((p) => {
                const h = atlasHexPoint(p.q, p.r, data.terrain.hexMeters);
                return {x:h.x-box.x,y:h.y-box.y};
              }), style: {fill: null, stroke: "#be5939", lineWidth: mpp * 3}}),
        );
      for (const e of data.entrances) {
        const binding = data.bindings.find(
          (b) => b.kind === "dungeon" && b.ownerId === e.scopeId,
        );
        if (!binding) continue;
        const f = atlasFrame(data, binding),
          out = localToAtlas(e.outside, f),
          at = localToAtlas(e.inside, f);
        root.append(
          shape("line", {x: out.x - box.x, y: out.y - box.y, x2: at.x - box.x, y2: at.y - box.y, style: {stroke: "#27635a", lineWidth: mpp * 2}}),
        );
        const marker = shape("circle", {x: out.x - box.x, y: out.y - box.y, radius: mpp * 5, style: {fill: "#39766a", stroke: "white", lineWidth: mpp}});
        marker.data.atlasObject = "true";
        marker.data.kind = "entrance";
        marker.data.id = e.id;
        root.append(marker);
      }
      const localRoute = this.journey.localPreview?.route ?? (data.localJourney&&['active','paused'].includes(data.localJourney.status)?data.localJourney.route:[]);
      if (localRoute?.length)
        root.append(
          shape("polyline", {points: localRoute
              .map(p=>({x:p.x-box.x,y:p.y-box.y})), style: {fill: null, stroke: "#b05d32", lineWidth: mpp * 2}}),
        );
      this.drawing.drawParty(root, mpp);
    });
  }
}
