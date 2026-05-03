package src.view.slotcontent.main.dungeonmap;

import java.util.ArrayList;
import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAreaKind;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonBoundaryKind;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorSnapshot;
import src.domain.dungeon.published.DungeonFeatureKind;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonMapMode;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeon.published.DungeonSurfacePayload;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonTopologyElementKind;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.domain.dungeon.published.DungeonTopologyKind;
import src.domain.dungeon.published.DungeonTravelHeading;
import src.domain.travel.published.TravelDungeonArea;
import src.domain.travel.published.TravelDungeonBoundary;
import src.domain.travel.published.TravelDungeonCell;
import src.domain.travel.published.TravelDungeonFeature;
import src.domain.travel.published.TravelDungeonMapSnapshot;
import src.domain.travel.published.TravelDungeonPosition;
import src.domain.travel.published.TravelDungeonSnapshot;
import src.domain.travel.published.TravelDungeonSurface;
import src.domain.travel.published.TravelOverlaySettings;

public final class DungeonMapContentModel {

    private final String placeholderTitle;
    private final boolean editorMode;
    private final ReadOnlyObjectWrapper<RenderState> renderState;
    private @Nullable DungeonSnapshot snapshot;
    private @Nullable DungeonSnapshot previewSnapshot;
    private RenderState.ViewMode viewMode = RenderState.ViewMode.GRID;
    private RenderState.LevelOverlaySettings overlaySettings =
            RenderState.LevelOverlaySettings.defaults();
    private int projectionLevel;
    private String selectedTool = "Auswahl";
    private RenderState.@Nullable PartyToken partyToken;
    private RenderState.@Nullable Selection selection;
    private RenderState.@Nullable EditorPreview editorPreview;

    public DungeonMapContentModel(String placeholderTitle, boolean editorMode) {
        this.placeholderTitle = placeholderTitle == null || placeholderTitle.isBlank()
                ? "Dungeon Map"
                : placeholderTitle;
        this.editorMode = editorMode;
        renderState = new ReadOnlyObjectWrapper<>(RenderState.empty(this.placeholderTitle));
    }

    public ReadOnlyObjectProperty<RenderState> renderStateProperty() {
        return renderState.getReadOnlyProperty();
    }

    public void showSnapshot(DungeonSnapshot nextSnapshot) {
        snapshot = nextSnapshot;
        rebuildRenderState();
    }

    public void showSurface(@Nullable DungeonSurfacePayload nextSurface) {
        if (nextSurface == null) {
            snapshot = null;
            previewSnapshot = null;
            rebuildRenderState();
            return;
        }
        snapshot = new DungeonSnapshot(
                nextSurface.mapName(),
                nextSurface.mode(),
                nextSurface.map(),
                nextSurface.aggregateSummaries(),
                nextSurface.relationSummaries(),
                nextSurface.revision());
        previewSnapshot = nextSurface.previewMap() == null
                ? null
                : new DungeonSnapshot(
                        nextSurface.mapName(),
                        nextSurface.mode(),
                        nextSurface.previewMap(),
                        nextSurface.aggregateSummaries(),
                        nextSurface.relationSummaries(),
                        nextSurface.revision());
        rebuildRenderState();
    }

    public void showPreviewSnapshot(@Nullable DungeonSnapshot nextPreviewSnapshot) {
        previewSnapshot = nextPreviewSnapshot;
        rebuildRenderState();
    }

    public void selectViewMode(RenderState.ViewMode nextViewMode) {
        viewMode = nextViewMode == null ? RenderState.ViewMode.GRID : nextViewMode;
        rebuildRenderState();
    }

    public void selectOverlayMode(RenderState.OverlayMode nextOverlayMode) {
        overlaySettings = new RenderState.LevelOverlaySettings(
                nextOverlayMode,
                overlaySettings.levelRange(),
                overlaySettings.opacity(),
                overlaySettings.selectedLevels());
        rebuildRenderState();
    }

    public void showOverlaySettings(RenderState.LevelOverlaySettings nextOverlaySettings) {
        overlaySettings = nextOverlaySettings == null
                ? RenderState.LevelOverlaySettings.off()
                : nextOverlaySettings;
        rebuildRenderState();
    }

    public void showProjectionLevel(int nextProjectionLevel) {
        projectionLevel = nextProjectionLevel;
        rebuildRenderState();
    }

    public void showPartyToken(RenderState.@Nullable PartyToken nextPartyToken) {
        partyToken = nextPartyToken;
        rebuildRenderState();
    }

    public void showSelectedTool(String nextSelectedTool) {
        selectedTool = nextSelectedTool == null || nextSelectedTool.isBlank() ? "Auswahl" : nextSelectedTool;
        rebuildRenderState();
    }

    public void showSelection(RenderState.@Nullable Selection nextSelection) {
        selection = nextSelection;
        rebuildRenderState();
    }

    public void showPendingTopologyEdit(RenderState.@Nullable EditorPreview nextEditorPreview) {
        editorPreview = nextEditorPreview;
        rebuildRenderState();
    }

    public void applyEditorSnapshot(DungeonEditorSnapshot editorSnapshot) {
        DungeonEditorSnapshot safeSnapshot = editorSnapshot == null
                ? DungeonEditorSnapshot.empty("")
                : editorSnapshot;
        DungeonSurfacePayload surfacePayload = safeSnapshot.surface();
        snapshot = toCommittedSnapshot(surfacePayload);
        previewSnapshot = toPreviewSnapshot(surfacePayload);
        viewMode = toViewMode(safeSnapshot.viewModeKey());
        overlaySettings = toOverlaySettings(safeSnapshot.overlaySettings());
        projectionLevel = safeSnapshot.projectionLevel();
        selectedTool = normalizeTool(safeSnapshot.selectedTool());
        RenderState.Selection nextSelection = toSelection(
                safeSnapshot.selection(),
                surfacePayload == null ? null : surfacePayload.inspector());
        selection = nextSelection;
        editorPreview = toEditorPreview(safeSnapshot.preview(), nextSelection);
        partyToken = null;
        rebuildRenderState();
    }

    public void applyTravelSnapshot(TravelDungeonSnapshot travelSnapshot) {
        TravelDungeonSnapshot safeSnapshot = travelSnapshot == null
                ? TravelDungeonSnapshot.empty()
                : travelSnapshot;
        TravelDungeonSurface surface = safeSnapshot.surface();
        snapshot = surface != null && surface.contextKind() == TravelDungeonSurface.ContextKind.DUNGEON
                ? toCommittedTravelSnapshot(surface)
                : null;
        previewSnapshot = null;
        viewMode = RenderState.ViewMode.GRID;
        overlaySettings = toOverlaySettings(safeSnapshot.overlaySettings());
        projectionLevel = safeSnapshot.projectionLevel();
        selectedTool = "Auswahl";
        selection = null;
        editorPreview = null;
        partyToken = toPartyToken(surface == null ? null : surface.position(), surface);
        rebuildRenderState();
    }

    private void rebuildRenderState() {
        renderState.set(RenderState.fromDungeonSnapshot(
                snapshot,
                previewSnapshot,
                placeholderTitle,
                editorMode,
                viewMode,
                overlaySettings,
                projectionLevel,
                selectedTool,
                selection,
                editorPreview,
                partyToken));
    }

    private static @Nullable DungeonSnapshot toCommittedSnapshot(@Nullable DungeonSurfacePayload payload) {
        if (payload == null) {
            return null;
        }
        return new DungeonSnapshot(
                payload.mapName(),
                payload.mode(),
                payload.map(),
                payload.aggregateSummaries(),
                payload.relationSummaries(),
                payload.revision());
    }

    private static @Nullable DungeonSnapshot toPreviewSnapshot(@Nullable DungeonSurfacePayload payload) {
        if (payload == null || payload.previewMap() == null) {
            return null;
        }
        return new DungeonSnapshot(
                payload.mapName(),
                payload.mode(),
                payload.previewMap(),
                payload.aggregateSummaries(),
                payload.relationSummaries(),
                payload.revision());
    }

    private static @Nullable DungeonSnapshot toCommittedTravelSnapshot(@Nullable TravelDungeonSurface surface) {
        if (surface == null || surface.contextKind() != TravelDungeonSurface.ContextKind.DUNGEON) {
            return null;
        }
        return new DungeonSnapshot(
                surface.mapName(),
                DungeonMapMode.TRAVEL,
                toDungeonMapSnapshot(surface.map()),
                List.of(),
                List.of(),
                surface.revision());
    }

    private static RenderState.ViewMode toViewMode(String viewModeKey) {
        return "GRAPH".equalsIgnoreCase(viewModeKey)
                ? RenderState.ViewMode.GRAPH
                : RenderState.ViewMode.GRID;
    }

    private static String normalizeTool(String selectedTool) {
        return selectedTool == null || selectedTool.isBlank() ? "Auswahl" : selectedTool;
    }

    private static RenderState.LevelOverlaySettings toOverlaySettings(
            DungeonOverlaySettings overlaySettings
    ) {
        DungeonOverlaySettings safeOverlay =
                overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
        return new RenderState.LevelOverlaySettings(
                toOverlayMode(safeOverlay.modeKey()),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    private static RenderState.LevelOverlaySettings toOverlaySettings(
            TravelOverlaySettings overlaySettings
    ) {
        TravelOverlaySettings safeOverlay =
                overlaySettings == null ? TravelOverlaySettings.defaults() : overlaySettings;
        return new RenderState.LevelOverlaySettings(
                toOverlayMode(safeOverlay.modeKey()),
                safeOverlay.levelRange(),
                safeOverlay.opacity(),
                safeOverlay.selectedLevels());
    }

    private static RenderState.OverlayMode toOverlayMode(String modeKey) {
        if ("NEARBY".equalsIgnoreCase(modeKey)) {
            return RenderState.OverlayMode.NEARBY;
        }
        if ("SELECTED".equalsIgnoreCase(modeKey)) {
            return RenderState.OverlayMode.SELECTED;
        }
        return RenderState.OverlayMode.OFF;
    }

    private static RenderState.@Nullable Selection toSelection(
            DungeonEditorSnapshot.Selection selection,
            @Nullable DungeonInspectorSnapshot inspector
    ) {
        if (selection == null || selection.topologyRef().kind() == DungeonTopologyElementKind.EMPTY) {
            return null;
        }
        String label = inspector == null ? selection.topologyRef().kind().name() : inspector.title();
        long ownerId = selection.handleRef() != null && selection.handleRef().ownerId() > 0L
                ? selection.handleRef().ownerId()
                : selection.topologyRef().id();
        return new RenderState.Selection(
                ownerId,
                selection.clusterId(),
                label,
                new RenderState.TopologyRef(selection.topologyRef().kind().name(), selection.topologyRef().id()),
                selection.clusterSelection(),
                selection.handleRef() == null ? emptyHandleRef(ownerId, selection.clusterId()) : selection.handleRef());
    }

    private static RenderState.@Nullable EditorPreview toEditorPreview(
            DungeonEditorPreview preview,
            RenderState.@Nullable Selection selection
    ) {
        if (preview == null || preview instanceof DungeonEditorPreview.NonePreview) {
            return null;
        }
        return switch (preview) {
            case DungeonEditorPreview.RoomRectanglePreview room ->
                    new RenderState.EditorPreview.RoomRectangle(
                            room.start().q(),
                            room.start().r(),
                            room.end().q(),
                            room.end().r(),
                            room.start().level(),
                            room.deleteMode());
            case DungeonEditorPreview.ClusterBoundariesPreview boundaries ->
                    new RenderState.EditorPreview.BoundaryEdges(
                            boundaries.clusterId(),
                            boundaries.edges(),
                            boundaries.boundaryKind(),
                            boundaries.deleteMode());
            case DungeonEditorPreview.MoveHandlePreview moveHandle ->
                    new RenderState.EditorPreview.MoveHandleOrCluster(
                            moveHandle.handleRef().clusterId(),
                            moveHandle.deltaQ(),
                            moveHandle.deltaR(),
                            moveHandle.deltaLevel(),
                            moveHandle.handleRef(),
                            selection == null ? "" : selection.label());
            case DungeonEditorPreview.MoveBoundaryStretchPreview stretch ->
                    new RenderState.EditorPreview.BoundaryStretchMove(
                            stretch.clusterId(),
                            stretch.sourceEdges(),
                            stretch.deltaQ(),
                            stretch.deltaR(),
                            stretch.deltaLevel(),
                            selection == null ? "" : selection.label());
            case DungeonEditorPreview.NonePreview ignored -> null;
        };
    }

    private static RenderState.@Nullable PartyToken toPartyToken(
            @Nullable TravelDungeonPosition position,
            @Nullable TravelDungeonSurface travel
    ) {
        if (position == null || travel == null || travel.contextKind() != TravelDungeonSurface.ContextKind.DUNGEON) {
            return null;
        }
        return new RenderState.PartyToken(
                position.tile().q() + 0.5,
                position.tile().r() + 0.5,
                position.tile().level(),
                toHeading(position.heading()),
                true);
    }

    private static RenderState.Heading toHeading(DungeonTravelHeading heading) {
        return switch (heading == null ? DungeonTravelHeading.defaultHeading() : heading) {
            case NORTH -> RenderState.Heading.NORTH;
            case EAST -> RenderState.Heading.EAST;
            case SOUTH -> RenderState.Heading.SOUTH;
            case WEST -> RenderState.Heading.WEST;
        };
    }

    private static RenderState.Heading toHeading(TravelDungeonPosition.Heading heading) {
        return switch (heading == null ? TravelDungeonPosition.Heading.SOUTH : heading) {
            case NORTH -> RenderState.Heading.NORTH;
            case EAST -> RenderState.Heading.EAST;
            case SOUTH -> RenderState.Heading.SOUTH;
            case WEST -> RenderState.Heading.WEST;
        };
    }

    private static DungeonMapSnapshot toDungeonMapSnapshot(TravelDungeonMapSnapshot map) {
        TravelDungeonMapSnapshot safeMap = map == null ? TravelDungeonMapSnapshot.empty() : map;
        return new DungeonMapSnapshot(
                DungeonTopologyKind.valueOf(safeMap.topology().name()),
                safeMap.width(),
                safeMap.height(),
                safeMap.areas().stream().map(DungeonMapContentModel::toDungeonAreaSnapshot).toList(),
                safeMap.boundaries().stream().map(DungeonMapContentModel::toDungeonBoundarySnapshot).toList(),
                safeMap.features().stream().map(DungeonMapContentModel::toDungeonFeatureSnapshot).toList(),
                List.of());
    }

    private static DungeonAreaSnapshot toDungeonAreaSnapshot(TravelDungeonArea area) {
        TravelDungeonArea safeArea = area == null
                ? new TravelDungeonArea(TravelDungeonArea.Kind.ROOM, 1L, "ROOM", List.of())
                : area;
        return new DungeonAreaSnapshot(
                DungeonAreaKind.valueOf(safeArea.kind().name()),
                safeArea.id(),
                safeArea.label(),
                safeArea.cells().stream().map(DungeonMapContentModel::toDungeonCellRef).toList());
    }

    private static DungeonBoundarySnapshot toDungeonBoundarySnapshot(TravelDungeonBoundary boundary) {
        TravelDungeonBoundary safeBoundary = boundary == null
                ? new TravelDungeonBoundary("wall", 1L, "wall", new src.domain.travel.published.TravelDungeonEdge(
                        new TravelDungeonCell(0, 0, 0),
                        new TravelDungeonCell(0, 0, 0)))
                : boundary;
        return new DungeonBoundarySnapshot(
                safeBoundary.kind(),
                safeBoundary.id(),
                safeBoundary.label(),
                new DungeonEdgeRef(
                        toDungeonCellRef(safeBoundary.edge().from()),
                        toDungeonCellRef(safeBoundary.edge().to())));
    }

    private static DungeonFeatureSnapshot toDungeonFeatureSnapshot(TravelDungeonFeature feature) {
        TravelDungeonFeature safeFeature = feature == null
                ? new TravelDungeonFeature(TravelDungeonFeature.Kind.STAIR, 1L, "STAIR", List.of(), "", "")
                : feature;
        return new DungeonFeatureSnapshot(
                DungeonFeatureKind.valueOf(safeFeature.kind().name()),
                safeFeature.id(),
                safeFeature.label(),
                safeFeature.cells().stream().map(DungeonMapContentModel::toDungeonCellRef).toList(),
                safeFeature.description(),
                safeFeature.destinationLabel());
    }

    private static DungeonCellRef toDungeonCellRef(TravelDungeonCell cell) {
        TravelDungeonCell safeCell = cell == null ? new TravelDungeonCell(0, 0, 0) : cell;
        return new DungeonCellRef(safeCell.q(), safeCell.r(), safeCell.level());
    }

    private static DungeonEditorHandleRef emptyHandleRef(long ownerId, long clusterId) {
        return new DungeonEditorHandleRef(
                DungeonEditorHandleKind.CLUSTER_LABEL,
                new DungeonTopologyElementRef(DungeonTopologyElementKind.EMPTY, 0L),
                ownerId,
                clusterId,
                0L,
                0L,
                0,
                new DungeonCellRef(0, 0, 0),
                "");
    }

    public static record RenderState(
            String title,
            String subtitle,
            String modeLabel,
            String statusLabel,
            String summaryLabel,
            boolean mapLoaded,
            String overlayMessage,
            RenderTopology topology,
            ViewMode viewMode,
            LevelOverlaySettings overlaySettings,
            int projectionLevel,
            boolean editorMode,
            String selectedTool,
            @Nullable Selection selection,
            @Nullable EditorPreview editorPreview,
            List<RenderCell> cells,
            List<RenderEdge> edges,
            List<RenderLabel> labels,
            List<RenderMarker> markers,
            List<GraphNode> graphNodes,
            List<GraphLink> graphLinks,
            @Nullable PartyToken partyToken
    ) {

                    public RenderState {
            title = title == null || title.isBlank() ? "Dungeon Map" : title;
            subtitle = subtitle == null ? "" : subtitle;
            modeLabel = modeLabel == null ? "" : modeLabel;
            statusLabel = statusLabel == null ? "" : statusLabel;
            summaryLabel = summaryLabel == null ? "" : summaryLabel;
            overlayMessage = overlayMessage == null ? "" : overlayMessage;
            topology = topology == null ? RenderTopology.SQUARE : topology;
            viewMode = viewMode == null ? ViewMode.GRID : viewMode;
            overlaySettings = overlaySettings == null ? LevelOverlaySettings.defaults() : overlaySettings;
            selectedTool = selectedTool == null || selectedTool.isBlank() ? "Auswahl" : selectedTool;
            cells = cells == null ? List.of() : List.copyOf(cells);
            edges = edges == null ? List.of() : List.copyOf(edges);
            labels = labels == null ? List.of() : List.copyOf(labels);
            markers = markers == null ? List.of() : List.copyOf(markers);
            graphNodes = graphNodes == null ? List.of() : List.copyOf(graphNodes);
            graphLinks = graphLinks == null ? List.of() : List.copyOf(graphLinks);
        }

        public OverlayMode overlayMode() {
            return overlaySettings.mode();
        }

        public static RenderState empty() {
            return empty("Dungeon Map");
        }

        public static RenderState empty(String title) {
            return new RenderState(
                    title,
                    "",
                    "Grid",
                    "",
                    "",
                    false,
                    "No dungeon map loaded.",
                    RenderTopology.SQUARE,
                    ViewMode.GRID,
                    LevelOverlaySettings.off(),
                    0,
                    true,
                    "Auswahl",
                    null,
                    null,
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    null);
        }

        public static RenderState fromDungeonSnapshot(
                @Nullable DungeonSnapshot snapshot,
                String placeholderTitle,
                boolean editorMode,
                ViewMode viewMode,
                OverlayMode overlayMode,
                int projectionLevel,
                String selectedTool
        ) {
            return fromDungeonSnapshot(
                    snapshot,
                    null,
                    placeholderTitle,
                    editorMode,
                    viewMode,
                    LevelOverlaySettings.of(overlayMode),
                    projectionLevel,
                    selectedTool,
                    null);
        }

        public static RenderState fromDungeonSnapshot(
                @Nullable DungeonSnapshot snapshot,
                String placeholderTitle,
                boolean editorMode,
                ViewMode viewMode,
                OverlayMode overlayMode,
                int projectionLevel,
                String selectedTool,
                @Nullable PartyToken runtimePartyToken
        ) {
            return fromDungeonSnapshot(
                    snapshot,
                    null,
                    placeholderTitle,
                    editorMode,
                    viewMode,
                    LevelOverlaySettings.of(overlayMode),
                    projectionLevel,
                    selectedTool,
                    null,
                    null,
                    runtimePartyToken);
        }

        public static RenderState fromDungeonSnapshot(
                @Nullable DungeonSnapshot snapshot,
                @Nullable DungeonSnapshot previewSnapshot,
                String placeholderTitle,
                boolean editorMode,
                ViewMode viewMode,
                LevelOverlaySettings overlaySettings,
                int projectionLevel,
                String selectedTool,
                @Nullable PartyToken runtimePartyToken
        ) {
            return fromDungeonSnapshot(
                    snapshot,
                    previewSnapshot,
                    placeholderTitle,
                    editorMode,
                    viewMode,
                    overlaySettings,
                    projectionLevel,
                    selectedTool,
                    null,
                    null,
                    runtimePartyToken);
        }

        public static RenderState fromDungeonSnapshot(
                @Nullable DungeonSnapshot snapshot,
                String placeholderTitle,
                boolean editorMode,
                ViewMode viewMode,
                LevelOverlaySettings overlaySettings,
                int projectionLevel,
                String selectedTool,
                @Nullable Selection selection,
                @Nullable EditorPreview editorPreview,
                @Nullable PartyToken runtimePartyToken
        ) {
            return fromDungeonSnapshot(
                    snapshot,
                    null,
                    placeholderTitle,
                    editorMode,
                    viewMode,
                    overlaySettings,
                    projectionLevel,
                    selectedTool,
                    selection,
                    editorPreview,
                    runtimePartyToken);
        }

        public static RenderState fromDungeonSnapshot(
                @Nullable DungeonSnapshot snapshot,
                @Nullable DungeonSnapshot previewSnapshot,
                String placeholderTitle,
                boolean editorMode,
                ViewMode viewMode,
                LevelOverlaySettings overlaySettings,
                int projectionLevel,
                String selectedTool,
                @Nullable Selection selection,
                @Nullable EditorPreview editorPreview,
                @Nullable PartyToken runtimePartyToken
        ) {
            if (snapshot == null) {
                return empty(placeholderTitle);
            }
            LevelOverlaySettings resolvedOverlay = overlaySettings == null
                    ? LevelOverlaySettings.defaults()
                    : overlaySettings;
            DungeonMapSnapshot map = snapshot.map();
            List<RenderCell> renderedCells = new ArrayList<>();
            List<RenderEdge> renderedEdges = new ArrayList<>();
            List<RenderLabel> renderedLabels = new ArrayList<>();
            List<RenderMarker> renderedMarkers = new ArrayList<>();
            List<GraphNode> graphNodes = new ArrayList<>();
            List<GraphLink> graphLinks = new ArrayList<>();
            renderAreas(map, selection, renderedCells, renderedLabels, graphNodes);
            addPreviewAndBoundaries(
                    map,
                    selection,
                    editorPreview,
                    previewSnapshot,
                    renderedCells,
                    renderedEdges,
                    renderedLabels);
            renderFeatures(map, selection, renderedCells, renderedLabels, renderedMarkers);
            renderHandles(map, selection, editorPreview, renderedMarkers);
            addFallbackGraphLinks(graphNodes, graphLinks);
            boolean mapLoaded = !renderedCells.isEmpty();
            return new RenderState(
                    snapshot.mapName(),
                    map.width() + " x " + map.height() + " squares · z=" + projectionLevel,
                    viewMode.label(),
                    editorMode ? selectedTool : "Token auf der Karte ziehen",
                    renderedCells.size() + " cells, " + renderedEdges.size() + " edges · "
                            + resolvedOverlay.mode().label(),
                    mapLoaded,
                    mapLoaded ? "" : "No dungeon map geometry available.",
                    topology(map.topology()),
                    viewMode,
                    resolvedOverlay,
                    projectionLevel,
                    editorMode,
                    selectedTool,
                    selection,
                    editorPreview,
                    renderedCells,
                    renderedEdges,
                    renderedLabels,
                    renderedMarkers,
                    graphNodes,
                    graphLinks,
                    editorMode ? null : runtimePartyToken);
        }

        private static void renderAreas(
                DungeonMapSnapshot map,
                @Nullable Selection selection,
                List<RenderCell> renderedCells,
                List<RenderLabel> renderedLabels,
                List<GraphNode> graphNodes
        ) {
            for (DungeonAreaSnapshot area : map.areas()) {
                boolean selected = selectedArea(area, selection);
                List<RenderCell> areaCells = area.cells().stream()
                        .map(cell -> renderCell(area, cell, selected, false, 0, 0))
                        .toList();
                renderedCells.addAll(areaCells);
                if (areaCells.isEmpty()) {
                    continue;
                }
                CellCenter center = centerOf(areaCells);
                renderedLabels.add(new RenderLabel(
                        area.label(),
                        center.x(),
                        center.y(),
                        areaCells.getFirst().z(),
                        area.id(),
                        area.clusterId(),
                        topologyRef(area.topologyRef()),
                        selected));
                graphNodes.add(new GraphNode(area.id(), area.clusterId(), area.label(), center.x(), center.y(), selected));
            }
        }

        private static void addPreviewAndBoundaries(
                DungeonMapSnapshot map,
                @Nullable Selection selection,
                @Nullable EditorPreview editorPreview,
                @Nullable DungeonSnapshot previewSnapshot,
                List<RenderCell> renderedCells,
                List<RenderEdge> renderedEdges,
                List<RenderLabel> renderedLabels
        ) {
            addEditorPreview(
                    renderedCells,
                    renderedEdges,
                    renderedLabels,
                    map.areas(),
                    map.boundaries(),
                    selection,
                    editorPreview,
                    previewSnapshot);
            for (DungeonBoundarySnapshot boundary : map.boundaries()) {
                if (boundary.edge() == null || boundary.edge().from() == null || boundary.edge().to() == null) {
                    continue;
                }
                renderedEdges.add(renderEdge(boundary));
            }
        }

        private static void renderFeatures(
                DungeonMapSnapshot map,
                @Nullable Selection selection,
                List<RenderCell> renderedCells,
                List<RenderLabel> renderedLabels,
                List<RenderMarker> renderedMarkers
        ) {
            for (DungeonFeatureSnapshot feature : map.features()) {
                List<RenderCell> featureCells = feature.cells().stream()
                        .map(cell -> renderFeatureCell(feature, cell, selection))
                        .toList();
                renderedCells.addAll(featureCells);
                if (featureCells.isEmpty()) {
                    continue;
                }
                CellCenter center = centerOf(featureCells);
                boolean selected = selectedFeature(feature, selection);
                renderedLabels.add(new RenderLabel(
                        feature.label(),
                        center.x(),
                        center.y(),
                        featureCells.getFirst().z(),
                        feature.id(),
                        0L,
                        topologyRef(feature.topologyRef()),
                        selected));
                renderedMarkers.add(markerForFeature(feature, center, featureCells.getFirst().z(), selected));
            }
        }

        private static void renderHandles(
                DungeonMapSnapshot map,
                @Nullable Selection selection,
                @Nullable EditorPreview editorPreview,
                List<RenderMarker> renderedMarkers
        ) {
            for (DungeonEditorHandleSnapshot handle : map.editorHandles()) {
                if (handle.ref().kind() == DungeonEditorHandleKind.CLUSTER_LABEL) {
                    continue;
                }
                renderedMarkers.add(markerForHandle(handle, selection));
            }
            addHandleMovePreview(renderedMarkers, editorPreview);
        }

        private static void addFallbackGraphLinks(
                List<GraphNode> graphNodes,
                List<GraphLink> graphLinks
        ) {
            if (!graphLinks.isEmpty() || graphNodes.size() <= 1) {
                return;
            }
            for (int index = 1; index < graphNodes.size(); index++) {
                graphLinks.add(new GraphLink(graphNodes.get(index - 1).id(), graphNodes.get(index).id(), false));
            }
        }

        private static RenderCell renderCell(
                DungeonAreaSnapshot area,
                DungeonCellRef cell,
                boolean selected,
                boolean preview,
                int deltaQ,
                int deltaR
        ) {
            return renderCell(area, cell, selected, preview, deltaQ, deltaR, 0);
        }

        private static RenderCell renderCell(
                DungeonAreaSnapshot area,
                DungeonCellRef cell,
                boolean selected,
                boolean preview,
                int deltaQ,
                int deltaR,
                int deltaLevel
        ) {
            CellKind kind = area.kind() == DungeonAreaKind.CORRIDOR ? CellKind.CORRIDOR : CellKind.ROOM;
            return new RenderCell(
                    cell.q() + deltaQ,
                    cell.r() + deltaR,
                    cell.level() + deltaLevel,
                    area.label(),
                    kind,
                    area.id(),
                    area.clusterId(),
                    topologyRef(area.topologyRef()),
                    selected,
                    false,
                    preview,
                    false);
        }

        private static RenderCell renderFeatureCell(
                DungeonFeatureSnapshot feature,
                DungeonCellRef cell,
                @Nullable Selection selection
        ) {
            CellKind kind = feature.kind() == DungeonFeatureKind.TRANSITION ? CellKind.TRANSITION : CellKind.STAIR;
            return new RenderCell(
                    cell.q(),
                    cell.r(),
                    cell.level(),
                    feature.label(),
                    kind,
                    feature.id(),
                    0L,
                    topologyRef(feature.topologyRef()),
                    selectedFeature(feature, selection),
                    false,
                    false,
                    false);
        }

        private static void addEditorPreview(
                List<RenderCell> renderedCells,
                List<RenderEdge> renderedEdges,
                List<RenderLabel> renderedLabels,
                List<DungeonAreaSnapshot> areas,
                List<DungeonBoundarySnapshot> boundaries,
                @Nullable Selection selection,
                @Nullable EditorPreview editorPreview,
                @Nullable DungeonSnapshot previewSnapshot
        ) {
            if (editorPreview == null || !editorPreview.active()) {
                return;
            }
            if (editorPreview instanceof EditorPreview.MoveHandleOrCluster movePreview) {
                addClusterMovePreview(renderedCells, renderedEdges, renderedLabels, areas, boundaries, selection, movePreview);
            } else if (editorPreview instanceof EditorPreview.RoomRectangle roomRectangle) {
                addRoomRectanglePreview(renderedCells, roomRectangle);
            } else if (editorPreview instanceof EditorPreview.BoundaryEdges boundaryEdges) {
                addBoundaryEdgesPreview(renderedEdges, boundaryEdges);
            } else if (editorPreview instanceof EditorPreview.BoundaryStretchMove boundaryStretchMove) {
                addBoundaryStretchPreview(renderedCells, renderedEdges, renderedLabels, selection, previewSnapshot, boundaryStretchMove);
            }
        }

        private static void addBoundaryStretchPreview(
                List<RenderCell> renderedCells,
                List<RenderEdge> renderedEdges,
                List<RenderLabel> renderedLabels,
                @Nullable Selection selection,
                @Nullable DungeonSnapshot previewSnapshot,
                EditorPreview.BoundaryStretchMove movePreview
        ) {
            if (previewSnapshot == null || previewSnapshot.map() == null) {
                return;
            }
            List<DungeonAreaSnapshot> previewAreas = previewSnapshot.map().areas().stream()
                    .filter(area -> area.kind() == DungeonAreaKind.ROOM && area.clusterId() == movePreview.clusterId())
                    .toList();
            if (previewAreas.isEmpty()) {
                return;
            }
            List<DungeonCellRef> previewClusterCells = previewAreas.stream()
                    .flatMap(area -> area.cells().stream())
                    .toList();
            for (DungeonAreaSnapshot area : previewAreas) {
                List<RenderCell> previewCells = area.cells().stream()
                        .map(cell -> renderCell(area, cell, selectedArea(area, selection), true, 0, 0))
                        .toList();
                renderedCells.addAll(previewCells);
                if (previewCells.isEmpty()) {
                    continue;
                }
                CellCenter center = centerOf(previewCells);
                renderedLabels.add(new RenderLabel(
                        area.label(),
                        center.x(),
                        center.y(),
                        previewCells.getFirst().z(),
                        area.id(),
                        area.clusterId(),
                        topologyRef(area.topologyRef()),
                        selectedArea(area, selection),
                        true));
            }
            for (DungeonBoundarySnapshot boundary : previewSnapshot.map().boundaries()) {
                if (boundary.edge() == null
                        || boundary.edge().from() == null
                        || boundary.edge().to() == null
                        || !edgeTouchesAnyCell(boundary.edge(), previewClusterCells)) {
                    continue;
                }
                renderedEdges.add(renderEdge(boundary, 0, 0, 0, true));
            }
        }

        private static void addRoomRectanglePreview(List<RenderCell> renderedCells, EditorPreview.RoomRectangle roomRectangle) {
            int minQ = Math.min(roomRectangle.startQ(), roomRectangle.endQ());
            int maxQ = Math.max(roomRectangle.startQ(), roomRectangle.endQ());
            int minR = Math.min(roomRectangle.startR(), roomRectangle.endR());
            int maxR = Math.max(roomRectangle.startR(), roomRectangle.endR());
            for (int q = minQ; q <= maxQ; q++) {
                for (int r = minR; r <= maxR; r++) {
                    renderedCells.add(new RenderCell(
                            q,
                            r,
                            roomRectangle.level(),
                            roomRectangle.deleteMode() ? "Delete preview" : "Paint preview",
                            CellKind.ROOM,
                            0L,
                            0L,
                            TopologyRef.empty(),
                            false,
                            false,
                            true,
                            roomRectangle.deleteMode()));
                }
            }
        }

        private static void addClusterMovePreview(
                List<RenderCell> renderedCells,
                List<RenderEdge> renderedEdges,
                List<RenderLabel> renderedLabels,
                List<DungeonAreaSnapshot> areas,
                List<DungeonBoundarySnapshot> boundaries,
                @Nullable Selection selection,
                EditorPreview.MoveHandleOrCluster movePreview
        ) {
            if (!movePreview.active()
                    || movePreview.handleRef().kind() != DungeonEditorHandleKind.CLUSTER_LABEL) {
                return;
            }
            List<DungeonCellRef> draggedCells = new ArrayList<>();
            for (DungeonAreaSnapshot area : areas) {
                if (!draggedClusterArea(area, selection, movePreview)) {
                    continue;
                }
                List<RenderCell> previewCells = area.cells().stream()
                        .map(cell -> renderCell(
                                area,
                                cell,
                                true,
                                true,
                                movePreview.deltaQ(),
                                movePreview.deltaR(),
                                movePreview.deltaLevel()))
                        .toList();
                renderedCells.addAll(previewCells);
                draggedCells.addAll(area.cells());
                if (previewCells.isEmpty()) {
                    continue;
                }
                CellCenter center = centerOf(previewCells);
                String label = movePreview.label().isBlank() ? area.label() : movePreview.label();
                renderedLabels.add(new RenderLabel(
                        label,
                        center.x(),
                        center.y(),
                        previewCells.getFirst().z(),
                        area.id(),
                        area.clusterId(),
                        topologyRef(area.topologyRef()),
                        true,
                        true));
            }
            addClusterBoundaryMovePreview(renderedEdges, boundaries, draggedCells, movePreview);
        }

        private static void addClusterBoundaryMovePreview(
                List<RenderEdge> renderedEdges,
                List<DungeonBoundarySnapshot> boundaries,
                List<DungeonCellRef> draggedCells,
                EditorPreview.MoveHandleOrCluster movePreview
        ) {
            if (draggedCells.isEmpty()) {
                return;
            }
            for (DungeonBoundarySnapshot boundary : boundaries) {
                if (boundary.edge() == null
                        || boundary.edge().from() == null
                        || boundary.edge().to() == null
                        || !edgeTouchesAnyCell(boundary.edge(), draggedCells)) {
                    continue;
                }
                renderedEdges.add(renderEdge(
                        boundary,
                        movePreview.deltaQ(),
                        movePreview.deltaR(),
                        movePreview.deltaLevel(),
                        true));
            }
        }

        private static void addHandleMovePreview(List<RenderMarker> renderedMarkers, @Nullable EditorPreview editorPreview) {
            if (!(editorPreview instanceof EditorPreview.MoveHandleOrCluster movePreview)
                    || !movePreview.active()
                    || movePreview.handleRef().kind() == DungeonEditorHandleKind.CLUSTER_LABEL) {
                return;
            }
            DungeonEditorHandleRef ref = movePreview.handleRef();
            DungeonCellRef cell = ref.cell();
            DungeonCellRef movedCell = new DungeonCellRef(
                    cell.q() + movePreview.deltaQ(),
                    cell.r() + movePreview.deltaR(),
                    cell.level() + movePreview.deltaLevel());
            DungeonEditorHandleRef movedRef = new DungeonEditorHandleRef(
                    ref.kind(),
                    ref.topologyRef(),
                    ref.ownerId(),
                    ref.clusterId(),
                    ref.corridorId(),
                    ref.roomId(),
                    ref.index(),
                    movedCell,
                    ref.direction());
            renderedMarkers.add(new RenderMarker(
                    handleMarkerLabel(ref.kind()),
                    movedCell.q() + 0.5,
                    movedCell.r() + 0.5,
                    movedCell.level(),
                    handleMarkerKind(ref.kind()),
                    true,
                    movedRef,
                    true));
        }

        private static void addBoundaryEdgesPreview(
                List<RenderEdge> renderedEdges,
                EditorPreview.BoundaryEdges boundaryEdges
        ) {
            EdgeKind kind = boundaryEdges.kind() == DungeonBoundaryKind.DOOR ? EdgeKind.DOOR : EdgeKind.WALL;
            for (DungeonEdgeRef edge : boundaryEdges.edges()) {
                if (edge == null || edge.from() == null || edge.to() == null) {
                    continue;
                }
                renderedEdges.add(new RenderEdge(
                        edge.from().q(),
                        edge.from().r(),
                        edge.to().q(),
                        edge.to().r(),
                        edge.from().level(),
                        kind,
                        boundaryEdges.deleteMode() ? "Delete preview" : "Boundary preview",
                        boundaryEdges.clusterId(),
                        TopologyRef.empty(),
                        false,
                        true));
            }
        }

        private static RenderEdge renderEdge(DungeonBoundarySnapshot boundary) {
            return renderEdge(boundary, 0, 0, 0, false);
        }

        private static RenderEdge renderEdge(
                DungeonBoundarySnapshot boundary,
                int deltaQ,
                int deltaR,
                int deltaLevel,
                boolean preview
        ) {
            DungeonEdgeRef edge = boundary.edge();
            boolean door = "door".equalsIgnoreCase(boundary.kind());
            return new RenderEdge(
                    edge.from().q() + deltaQ,
                    edge.from().r() + deltaR,
                    edge.to().q() + deltaQ,
                    edge.to().r() + deltaR,
                    edge.from().level() + deltaLevel,
                    door ? EdgeKind.DOOR : EdgeKind.WALL,
                    boundary.label(),
                    boundary.id(),
                    topologyRef(boundary.topologyRef()),
                    false,
                    preview);
        }

        private static RenderMarker markerForFeature(
                DungeonFeatureSnapshot feature,
                CellCenter center,
                int level,
                boolean selected
        ) {
            MarkerKind kind = feature.kind() == DungeonFeatureKind.TRANSITION ? MarkerKind.TRANSITION : MarkerKind.STAIR;
            String label = feature.kind() == DungeonFeatureKind.TRANSITION ? "->" : "z";
            return new RenderMarker(label, center.x(), center.y(), level, kind, selected);
        }

        private static RenderMarker markerForHandle(DungeonEditorHandleSnapshot handle, @Nullable Selection selection) {
            DungeonEditorHandleRef ref = handle.ref();
            return new RenderMarker(
                    handleMarkerLabel(ref.kind()),
                    handle.cell().q() + 0.5,
                    handle.cell().r() + 0.5,
                    handle.cell().level(),
                    handleMarkerKind(ref.kind()),
                    selectedHandle(ref, selection),
                    ref);
        }

        private static MarkerKind handleMarkerKind(DungeonEditorHandleKind kind) {
            return switch (kind) {
                case DOOR -> MarkerKind.DOOR;
                case STAIR_ANCHOR -> MarkerKind.STAIR;
                case CORRIDOR_ANCHOR -> MarkerKind.WAYPOINT;
                case CORRIDOR_WAYPOINT -> MarkerKind.WAYPOINT;
                case CLUSTER_LABEL -> MarkerKind.CLUSTER;
            };
        }

        private static String handleMarkerLabel(DungeonEditorHandleKind kind) {
            return switch (kind) {
                case DOOR -> "D";
                case STAIR_ANCHOR -> "z";
                case CORRIDOR_ANCHOR -> "o";
                case CORRIDOR_WAYPOINT -> "•";
                case CLUSTER_LABEL -> "";
            };
        }

        private static boolean selectedArea(DungeonAreaSnapshot area, @Nullable Selection selection) {
            if (area == null || selection == null) {
                return false;
            }
            if (selection.clusterSelection()) {
                return area.kind() == DungeonAreaKind.ROOM && area.clusterId() == selection.clusterId();
            }
            return topologyRef(area.topologyRef()).equals(selection.topologyRef()) || area.id() == selection.areaId();
        }

        private static boolean selectedFeature(DungeonFeatureSnapshot feature, @Nullable Selection selection) {
            if (feature == null || selection == null) {
                return false;
            }
            return topologyRef(feature.topologyRef()).equals(selection.topologyRef());
        }

        private static boolean selectedHandle(DungeonEditorHandleRef ref, @Nullable Selection selection) {
            if (ref == null || selection == null || selection.handleRef() == null) {
                return false;
            }
            DungeonEditorHandleRef selected = selection.handleRef();
            return sameStableHandle(ref, selected);
        }

        private static boolean draggedClusterArea(
                DungeonAreaSnapshot area,
                @Nullable Selection selection,
                EditorPreview.MoveHandleOrCluster movePreview
        ) {
            if (area == null || !movePreview.active()
                    || movePreview.handleRef().kind() != DungeonEditorHandleKind.CLUSTER_LABEL) {
                return false;
            }
            long selectedClusterId = selection == null ? movePreview.clusterId() : selection.clusterId();
            return selectedClusterId > 0L
                    && area.kind() == DungeonAreaKind.ROOM
                    && area.clusterId() == selectedClusterId;
        }

        private static boolean sameStableHandle(DungeonEditorHandleRef left, DungeonEditorHandleRef right) {
            return left.kind() == right.kind()
                    && left.topologyRef().equals(right.topologyRef())
                    && left.ownerId() == right.ownerId()
                    && left.clusterId() == right.clusterId()
                    && left.corridorId() == right.corridorId()
                    && left.roomId() == right.roomId()
                    && left.index() == right.index();
        }

        private static boolean edgeTouchesAnyCell(DungeonEdgeRef edge, List<DungeonCellRef> cells) {
            for (DungeonCellRef touchingCell : touchingCells(edge)) {
                for (DungeonCellRef cell : cells) {
                    if (sameCell(touchingCell, cell)) {
                        return true;
                    }
                }
            }
            return false;
        }

        private static List<DungeonCellRef> touchingCells(DungeonEdgeRef edge) {
            DungeonCellRef from = edge.from();
            DungeonCellRef to = edge.to();
            if (from == null || to == null || from.level() != to.level()) {
                return List.of();
            }
            if (from.r() == to.r()) {
                return horizontalTouchingCells(from, to);
            }
            if (from.q() == to.q()) {
                return verticalTouchingCells(from, to);
            }
            return List.of();
        }

        private static List<DungeonCellRef> horizontalTouchingCells(DungeonCellRef from, DungeonCellRef to) {
            int minQ = Math.min(from.q(), to.q());
            int maxQ = Math.max(from.q(), to.q());
            List<DungeonCellRef> result = new ArrayList<>();
            for (int q = minQ; q < maxQ; q++) {
                result.add(new DungeonCellRef(q, from.r() - 1, from.level()));
                result.add(new DungeonCellRef(q, from.r(), from.level()));
            }
            return List.copyOf(result);
        }

        private static List<DungeonCellRef> verticalTouchingCells(DungeonCellRef from, DungeonCellRef to) {
            int minR = Math.min(from.r(), to.r());
            int maxR = Math.max(from.r(), to.r());
            List<DungeonCellRef> result = new ArrayList<>();
            for (int r = minR; r < maxR; r++) {
                result.add(new DungeonCellRef(from.q() - 1, r, from.level()));
                result.add(new DungeonCellRef(from.q(), r, from.level()));
            }
            return List.copyOf(result);
        }

        private static boolean sameCell(DungeonCellRef left, DungeonCellRef right) {
            return left.q() == right.q() && left.r() == right.r() && left.level() == right.level();
        }

        private static CellCenter centerOf(List<RenderCell> cells) {
            double x = 0.0;
            double y = 0.0;
            for (RenderCell cell : cells) {
                x += cell.q() + 0.5;
                y += cell.r() + 0.5;
            }
            int count = Math.max(1, cells.size());
            return new CellCenter(x / count, y / count);
        }

        private static RenderTopology topology(DungeonTopologyKind topology) {
            return topology == DungeonTopologyKind.HEX ? RenderTopology.HEX : RenderTopology.SQUARE;
        }

        private static TopologyRef topologyRef(DungeonTopologyElementRef ref) {
            if (ref == null) {
                return TopologyRef.empty();
            }
            return new TopologyRef(ref.kind().name(), ref.id());
        }

        public enum RenderTopology {
            SQUARE,
            HEX
        }

        public enum ViewMode {
            GRID("Grid"),
            GRAPH("Graph");

            private final String label;

            ViewMode(String label) {
                this.label = label;
            }

            public String label() {
                return label;
            }
        }

        public enum OverlayMode {
            OFF("Overlay: Aus"),
            NEARBY("Overlay: Nachbarn"),
            SELECTED("Overlay: Auswahl");

            private final String label;

            OverlayMode(String label) {
                this.label = label;
            }

            public String label() {
                return label;
            }
        }

        public record LevelOverlaySettings(
                OverlayMode mode,
                int levelRange,
                double opacity,
                List<Integer> selectedLevels
        ) {

            private static final int DEFAULT_LEVEL_RANGE = 2;
            private static final int MAX_LEVEL_RANGE = 6;
            private static final double DEFAULT_OPACITY = 0.35;

            public LevelOverlaySettings {
                mode = mode == null ? OverlayMode.OFF : mode;
                levelRange = Math.max(1, Math.min(MAX_LEVEL_RANGE, levelRange));
                opacity = Math.max(0.05, Math.min(0.95, opacity));
                selectedLevels = selectedLevels == null ? List.of() : selectedLevels.stream()
                        .filter(java.util.Objects::nonNull)
                        .distinct()
                        .sorted()
                        .toList();
            }

            public static LevelOverlaySettings defaults() {
                return new LevelOverlaySettings(OverlayMode.NEARBY, DEFAULT_LEVEL_RANGE, DEFAULT_OPACITY, List.of());
            }

            public static LevelOverlaySettings off() {
                return new LevelOverlaySettings(OverlayMode.OFF, DEFAULT_LEVEL_RANGE, DEFAULT_OPACITY, List.of());
            }

            public static LevelOverlaySettings of(OverlayMode mode) {
                return new LevelOverlaySettings(mode, DEFAULT_LEVEL_RANGE, DEFAULT_OPACITY, List.of());
            }
        }

        public enum CellKind {
            ROOM,
            CORRIDOR,
            STAIR,
            TRANSITION
        }

        public enum EdgeKind {
            WALL,
            DOOR
        }

        public enum MarkerKind {
            DOOR,
            STAIR,
            TRANSITION,
            WAYPOINT,
            CLUSTER
        }

        public enum Heading {
            NORTH(0.0, -1.0),
            EAST(1.0, 0.0),
            SOUTH(0.0, 1.0),
            WEST(-1.0, 0.0);

            private final double dx;
            private final double dy;

            Heading(double dx, double dy) {
                this.dx = dx;
                this.dy = dy;
            }

            public double dx() {
                return dx;
            }

            public double dy() {
                return dy;
            }
        }

        public record RenderCell(
                int q,
                int r,
                int z,
                String label,
                CellKind kind,
                long ownerId,
                long clusterId,
                TopologyRef topologyRef,
                boolean selected,
                boolean overlay,
                boolean preview,
                boolean destructivePreview
        ) {

            public RenderCell {
                label = label == null ? "" : label;
                kind = kind == null ? CellKind.ROOM : kind;
                topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
            }
        }

        public record RenderEdge(
                double startQ,
                double startR,
                double endQ,
                double endR,
                int z,
                EdgeKind kind,
                String label,
                long ownerId,
                TopologyRef topologyRef,
                boolean selected,
                boolean preview
        ) {

            public RenderEdge(
                    double startQ,
                    double startR,
                    double endQ,
                    double endR,
                    int z,
                    EdgeKind kind,
                    String label,
                    long ownerId,
                    TopologyRef topologyRef,
                    boolean selected
            ) {
                this(startQ, startR, endQ, endR, z, kind, label, ownerId, topologyRef, selected, false);
            }

            public RenderEdge {
                kind = kind == null ? EdgeKind.WALL : kind;
                label = label == null ? "" : label;
                topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
            }
        }

        public record RenderLabel(
                String label,
                double q,
                double r,
                int z,
                long ownerId,
                long clusterId,
                TopologyRef topologyRef,
                boolean selected,
                boolean preview
        ) {

            public RenderLabel(
                    String label,
                    double q,
                    double r,
                    int z,
                    long ownerId,
                    long clusterId,
                    TopologyRef topologyRef,
                    boolean selected
            ) {
                this(label, q, r, z, ownerId, clusterId, topologyRef, selected, false);
            }

            public RenderLabel {
                label = label == null ? "" : label;
                topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
            }
        }

        public record RenderMarker(
                String label,
                double q,
                double r,
                int z,
                MarkerKind kind,
                boolean selected,
                DungeonEditorHandleRef handleRef,
                boolean preview
        ) {

            public RenderMarker(String label, double q, double r, int z, MarkerKind kind, boolean selected) {
                this(label, q, r, z, kind, selected, emptyHandleRef(0L, 0L), false);
            }

            public RenderMarker(
                    String label,
                    double q,
                    double r,
                    int z,
                    MarkerKind kind,
                    boolean selected,
                    DungeonEditorHandleRef handleRef
            ) {
                this(label, q, r, z, kind, selected, handleRef, false);
            }

            public RenderMarker {
                label = label == null ? "" : label;
                kind = kind == null ? MarkerKind.DOOR : kind;
                handleRef = handleRef == null ? emptyHandleRef(0L, 0L) : handleRef;
            }

            public String handleKind() {
                return handleRef.kind().name();
            }

            public long handleOwnerId() {
                return handleRef.ownerId();
            }

            public long handleClusterId() {
                return handleRef.clusterId();
            }

            public long handleCorridorId() {
                return handleRef.corridorId();
            }

            public long handleRoomId() {
                return handleRef.roomId();
            }

            public int handleIndex() {
                return handleRef.index();
            }

            public String handleDirection() {
                return handleRef.direction();
            }

            public String handleTopologyRefKind() {
                return handleRef.topologyRef().kind().name();
            }

            public long handleTopologyRefId() {
                return handleRef.topologyRef().id();
            }

            public int handleQ() {
                return handleRef.cell().q();
            }

            public int handleR() {
                return handleRef.cell().r();
            }

            public int handleLevel() {
                return handleRef.cell().level();
            }
        }

        public record GraphNode(long id, long clusterId, String label, double q, double r, boolean selected) {

            public GraphNode {
                label = label == null || label.isBlank() ? "Room" : label;
            }
        }

        public record GraphLink(long fromId, long toId, boolean selected) {
        }

        public record PartyToken(double q, double r, int z, Heading heading, boolean visible) {

            public PartyToken {
                heading = heading == null ? Heading.SOUTH : heading;
            }
        }

        public record Selection(
                long areaId,
                long clusterId,
                String label,
                TopologyRef topologyRef,
                boolean clusterSelection,
                DungeonEditorHandleRef handleRef
        ) {

            public Selection(long areaId, long clusterId, String label) {
                this(areaId, clusterId, label, new TopologyRef(DungeonTopologyElementKind.ROOM.name(), areaId), false);
            }

            public Selection(long areaId, long clusterId, String label, TopologyRef topologyRef) {
                this(areaId, clusterId, label, topologyRef, false);
            }

            public Selection(
                    long areaId,
                    long clusterId,
                    String label,
                    TopologyRef topologyRef,
                    boolean clusterSelection
            ) {
                this(areaId, clusterId, label, topologyRef, clusterSelection, emptyHandleRef(areaId, clusterId));
            }

            public Selection {
                areaId = Math.max(0L, areaId);
                clusterId = Math.max(0L, clusterId);
                label = label == null ? "" : label;
                topologyRef = topologyRef == null ? TopologyRef.empty() : topologyRef;
                handleRef = handleRef == null ? emptyHandleRef(areaId, clusterId) : handleRef;
            }
        }

        public record TopologyRef(String kind, long id) {

            public TopologyRef {
                kind = kind == null || kind.isBlank() ? "EMPTY" : kind.trim();
                id = Math.max(0L, id);
            }

            public static TopologyRef empty() {
                return new TopologyRef("EMPTY", 0L);
            }

            public DungeonTopologyElementRef toPublished() {
                return new DungeonTopologyElementRef(
                        src.domain.dungeon.published.DungeonTopologyElementKind.valueOf(kind),
                        id);
            }
        }

        public sealed interface EditorPreview permits
                EditorPreview.MoveHandleOrCluster,
                EditorPreview.RoomRectangle,
                EditorPreview.BoundaryEdges,
                EditorPreview.BoundaryStretchMove {

            boolean active();

            boolean destructive();

            record MoveHandleOrCluster(
                    long clusterId,
                    int deltaQ,
                    int deltaR,
                    int deltaLevel,
                    DungeonEditorHandleRef handleRef,
                    String label
            ) implements EditorPreview {

                public MoveHandleOrCluster(long clusterId, int deltaQ, int deltaR) {
                    this(clusterId, deltaQ, deltaR, 0);
                }

                public MoveHandleOrCluster(long clusterId, int deltaQ, int deltaR, int deltaLevel) {
                    this(clusterId, deltaQ, deltaR, deltaLevel, emptyHandleRef(0L, clusterId), "");
                }

                public MoveHandleOrCluster {
                    clusterId = Math.max(0L, clusterId);
                    handleRef = handleRef == null ? emptyHandleRef(0L, clusterId) : handleRef;
                    label = label == null ? "" : label;
                }

                @Override
                public boolean active() {
                    return (clusterId > 0L || handleRef.ownerId() > 0L)
                            && (deltaQ != 0 || deltaR != 0 || deltaLevel != 0);
                }

                @Override
                public boolean destructive() {
                    return false;
                }
            }

            record RoomRectangle(int startQ, int startR, int endQ, int endR, int level, boolean deleteMode)
                    implements EditorPreview {

                @Override
                public boolean active() {
                    return true;
                }

                @Override
                public boolean destructive() {
                    return deleteMode;
                }
            }

            record BoundaryEdges(long clusterId, List<DungeonEdgeRef> edges, DungeonBoundaryKind kind, boolean deleteMode)
                    implements EditorPreview {

                public BoundaryEdges {
                    clusterId = Math.max(0L, clusterId);
                    edges = edges == null ? List.of() : List.copyOf(edges);
                    kind = kind == null ? DungeonBoundaryKind.WALL : kind;
                }

                @Override
                public boolean active() {
                    return clusterId > 0L && !edges.isEmpty();
                }

                @Override
                public boolean destructive() {
                    return deleteMode;
                }
            }

            record BoundaryStretchMove(
                    long clusterId,
                    List<DungeonEdgeRef> sourceEdges,
                    int deltaQ,
                    int deltaR,
                    int deltaLevel,
                    String label
            ) implements EditorPreview {

                public BoundaryStretchMove {
                    clusterId = Math.max(0L, clusterId);
                    sourceEdges = sourceEdges == null ? List.of() : List.copyOf(sourceEdges);
                    label = label == null ? "" : label;
                }

                @Override
                public boolean active() {
                    return clusterId > 0L
                            && !sourceEdges.isEmpty()
                            && (deltaQ != 0 || deltaR != 0 || deltaLevel != 0);
                }

                @Override
                public boolean destructive() {
                    return false;
                }
            }
        }

        private static DungeonEditorHandleRef emptyHandleRef(long ownerId, long clusterId) {
            return new DungeonEditorHandleRef(
                    DungeonEditorHandleKind.CLUSTER_LABEL,
                    DungeonTopologyElementRef.empty(),
                    Math.max(0L, ownerId),
                    Math.max(0L, clusterId),
                    0L,
                    Math.max(0L, ownerId),
                    0,
                    new DungeonCellRef(0, 0, 0),
                    "");
        }
    }

    private record CellCenter(double x, double y) {
    }
}
