// Lightweight prototype fixtures use the real controllers without mounting the full app.
// Flattened probe names keep existing assertions and fault injections intact as
// their state moves; production has no compatibility properties.
export function atlasFixture(Workbench){
 const ui=Object.create(Workbench.prototype);
 ui.output=ui.createAtlasOutput();
 ui.journey=ui.createAtlasJourney();
 ui.regions=ui.createAtlasRegions();
 ui.drawing=ui.createAtlasDrawing();
 ui.author=ui.createAtlasAuthor();
 for(const key of ["outputRun","exporting","exportOpen","exportChoosing","exportBox","exportDungeon","exportCorner","exportDrag","setOutput","saveEditableCampaign","dungeonOutputBox","frameOutput","outputBox","exportAreaStatus","exportRectangle","exportPNG"])Object.defineProperty(ui,key,{configurable:true,get(){const value=ui.output[key];return typeof value==='function'?value.bind(ui.output):value;},set(value){ui.output[key]=value;}});
 for(const key of ["pendingTravel","travelReadState","previewRequest","localPreview","entranceId","entranceOptions","playback","worldPreview","renderTravel","travel","travelControl"])Object.defineProperty(ui,key,{configurable:true,get(){const value=ui.journey[key];return typeof value==='function'?value.bind(ui.journey):value;},set(value){ui.journey[key]=value;}});
 for(const key of ["projection","data","request","regionTimer","loadedRegionQuery","regionReading","regionReadingQuery","openingSurface","regionQuery","scheduleRegion","geometryCoversView","regionQueryCovers","geometryCurrent","refresh","refreshSpatialSource","openTerrain"])Object.defineProperty(ui,key,{configurable:true,get(){const value=ui.regions[key];return typeof value==='function'?value.bind(ui.regions):value;},set(value){ui.regions[key]=value;}});
 for(const key of ["baseGeometry","labelLayout","drawAuthorMeasurements","relativePoint","relative","visible","label","drawTerrain","drawInterior","authorRoom","authorFaceSlot","withAuthorFace","drawRoomFace","pathPreview","drawInteriorAuthor","drawInteriorRuntime","drawParty"])Object.defineProperty(ui,key,{configurable:true,get(){const value=ui.drawing[key];return typeof value==='function'?value.bind(ui.drawing):value;},set(value){ui.drawing[key]=value;}});
 for(const key of ["selection","draft","measurementHover","lastPoint","drag","vertexDrag","pathDrag","rectangleCommit","roomDrag","brushId","brushQueue","ignoreClick","partyDrag","placeIntent","entranceDraft","lastBrushPoint","roomPreview","pointToolActive","click","createRoomRectangle","suppressClick","queueBrush","down","move","up"])Object.defineProperty(ui,key,{configurable:true,get(){const value=ui.author[key];return typeof value==='function'?value.bind(ui.author):value;},set(value){ui.author[key]=value;}});
 Object.defineProperty(ui,'svg',{configurable:true,get(){return ui.canvas;},set(value){ui.canvas=value;}});
 return ui;
}
export function landscapeFixture(Workbench){
 const ui=typeof Workbench==='function'?Object.create(Workbench.prototype):Workbench;
 if(typeof Workbench==='function'){
 ui.brush=ui.createLandscapeBrushSession();
 ui.routes=ui.createLandscapeRoutes();
 ui.details=ui.createLandscapeInspector();
 }
 for(const key of ["maskStroke","colorDraft","maskStart","maskGeneration","liveFrame","liveWriteRequested","maskTimer","live","liveColorCount","liveId","livePainting","liveFailureMessage","startLive","sampleHeight","sampleLive","tickLive","scheduleLive","endLiveInput","finishLive","clearMask"])Object.defineProperty(ui,key,{configurable:true,get(){const value=ui.brush[key];return typeof value==='function'?value.bind(ui.brush):value;},set(value){ui.brush[key]=value;}});
 for(const key of ["routeSession","routeOpening","routeGeneration","routeRecords","routeAnchors","routeGesture","routeHistory","planTerrainRoute","openRoute"])Object.defineProperty(ui,key,{configurable:true,get(){const value=ui.routes[key];return typeof value==='function'?value.bind(ui.routes):value;},set(value){ui.routes[key]=value;}});
 for(const key of ["selectionRecords","selected","vertex","dirty","doc","docRevision","vegetationInstance","selectionId","selectedLabel","selectAdditional","select","inspector","readInspector","selectVegetation","linkVegetation"])Object.defineProperty(ui,key,{configurable:true,get(){const value=ui.details[key];return typeof value==='function'?value.bind(ui.details):value;},set(value){ui.details[key]=value;}});
 Object.defineProperty(ui,'svg',{configurable:true,get(){return ui.canvas;},set(value){ui.canvas=value;}});
 return ui;
}
