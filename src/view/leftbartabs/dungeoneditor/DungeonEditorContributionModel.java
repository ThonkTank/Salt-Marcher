package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Objects;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.dungeon.published.DungeonEditorControlsSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.features.dungeon.runtime.DungeonEditorInlineLabelEditSession;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts;
import src.features.dungeon.runtime.DungeonEditorRenderFrame;
import src.features.dungeon.runtime.DungeonEditorRuntimePointerTarget;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsContentModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;

public final class DungeonEditorContributionModel {

    private final ReadOnlyObjectWrapper<ControlsProjection> controlsProjection =
            new ReadOnlyObjectWrapper<>(ControlsProjection.initial());
    private final DungeonEditorStateContentModel stateContentModel;

    private InteractionState interactionState = InteractionState.empty();
    private DungeonMapContentModel.MapInteractionFrame mapInteractionFrame =
            DungeonMapContentModel.MapInteractionFrame.empty();
    private DungeonEditorPreparedFrameFacts.MapInteractionFrame runtimeMapInteractionFrame =
            DungeonEditorPreparedFrameFacts.MapInteractionFrame.empty();

    DungeonEditorContributionModel(DungeonEditorStateContentModel stateContentModel) {
        this.stateContentModel = Objects.requireNonNull(stateContentModel, "stateContentModel");
    }

    public void applyFrame(DungeonEditorRenderFrame frame) {
        DungeonEditorRenderFrame safeFrame = safeFrame(frame);
        DungeonEditorPreparedFrameFacts facts = safeFrame.preparedFacts();
        interactionState = InteractionState.from(facts);
        mapInteractionFrame = mapInteractionFrame(facts.mapInteractionFrame());
        controlsProjection.set(ControlsProjection.from(facts));
        stateContentModel.apply(safeFrame.state(), stateContext(safeFrame));
    }

    InteractionState currentInteractionState() {
        return interactionState;
    }

    DungeonMapContentModel.MapInteractionFrame currentMapInteractionFrame() {
        return mapInteractionFrame;
    }

    private DungeonMapContentModel.MapInteractionFrame mapInteractionFrame(
            DungeonEditorPreparedFrameFacts.MapInteractionFrame frame
    ) {
        DungeonEditorPreparedFrameFacts.MapInteractionFrame safeFrame = frame == null
                ? DungeonEditorPreparedFrameFacts.MapInteractionFrame.empty()
                : frame;
        if (safeFrame == runtimeMapInteractionFrame) {
            return mapInteractionFrame;
        }
        runtimeMapInteractionFrame = safeFrame;
        return new DungeonMapContentModel.MapInteractionFrame(
                neutralPointerTargets(safeFrame.pointerTargets()),
                safeFrame.previewHandleHitRefs());
    }

    private static java.util.Map<String, DungeonMapContentModel.PointerTarget> neutralPointerTargets(
            java.util.Map<String, DungeonEditorRuntimePointerTarget> targets
    ) {
        if (targets == null || targets.isEmpty()) {
            return java.util.Map.of();
        }
        java.util.Map<String, DungeonMapContentModel.PointerTarget> neutralTargets = new java.util.LinkedHashMap<>();
        for (java.util.Map.Entry<String, DungeonEditorRuntimePointerTarget> entry : targets.entrySet()) {
            neutralTargets.put(entry.getKey(), neutralPointerTarget(entry.getValue()));
        }
        return java.util.Map.copyOf(neutralTargets);
    }

    static DungeonEditorRuntimePointerTarget runtimePointerTarget(
            DungeonMapContentModel.PointerTarget target,
            int projectionLevel
    ) {
        DungeonMapContentModel.PointerTarget safeTarget = target == null
                ? DungeonMapContentModel.PointerTarget.empty()
                : target;
        return new DungeonEditorRuntimePointerTarget(
                DungeonEditorRuntimePointerTarget.TargetKind.fromLegacy(safeTarget.targetKind().name()),
                DungeonEditorRuntimePointerTarget.LabelKind.fromLegacy(safeTarget.labelKind()),
                DungeonEditorRuntimePointerTarget.ElementKind.fromLegacy(safeTarget.elementKind()),
                safeTarget.ownerId(),
                safeTarget.clusterId(),
                DungeonEditorRuntimePointerTarget.TopologyKind.fromLegacy(safeTarget.topologyKind()),
                safeTarget.topologyId(),
                safeTarget.handleRef(),
                runtimeBoundaryTarget(safeTarget.boundaryRef()),
                DungeonEditorRuntimePointerTarget.SyntheticHoverKind.fromLegacy(safeTarget.syntheticHoverKind()),
                DungeonEditorRuntimePointerTarget.CellTarget.empty(),
                runtimeVertexTarget(safeTarget, projectionLevel));
    }

    private static DungeonEditorRuntimePointerTarget.BoundaryTarget runtimeBoundaryTarget(
            DungeonMapContentModel.BoundaryTarget boundary
    ) {
        DungeonMapContentModel.BoundaryTarget safeBoundary = boundary == null
                ? DungeonMapContentModel.BoundaryTarget.empty()
                : boundary;
        return new DungeonEditorRuntimePointerTarget.BoundaryTarget(
                DungeonEditorRuntimePointerTarget.BoundaryKind.fromLegacy(safeBoundary.boundaryKind().legacyName()),
                safeBoundary.key(),
                safeBoundary.ownerId(),
                DungeonEditorRuntimePointerTarget.TopologyKind.fromLegacy(safeBoundary.topologyKind()),
                safeBoundary.topologyId(),
                safeBoundary.startQ(),
                safeBoundary.startR(),
                safeBoundary.startLevel(),
                safeBoundary.endQ(),
                safeBoundary.endR(),
                safeBoundary.endLevel());
    }

    private static DungeonEditorRuntimePointerTarget.VertexTarget runtimeVertexTarget(
            DungeonMapContentModel.PointerTarget target,
            int projectionLevel
    ) {
        DungeonMapContentModel.PointerTarget safeTarget = target == null
                ? DungeonMapContentModel.PointerTarget.empty()
                : target;
        if (!safeTarget.isVertexTarget()) {
            return DungeonEditorRuntimePointerTarget.VertexTarget.empty();
        }
        return new DungeonEditorRuntimePointerTarget.VertexTarget(
                true,
                safeTarget.vertexQ(),
                safeTarget.vertexR(),
                projectionLevel);
    }

    static DungeonMapContentModel.PointerTarget neutralPointerTarget(DungeonEditorRuntimePointerTarget target) {
        DungeonEditorRuntimePointerTarget safeTarget = target == null
                ? DungeonEditorRuntimePointerTarget.empty()
                : target;
        if (safeTarget.isSyntheticCellHover() && safeTarget.cell().exact()) {
            return DungeonMapContentModel.PointerTarget.syntheticCell(
                    safeTarget.elementKind().legacyName(),
                    safeTarget.cellQ(),
                    safeTarget.cellR(),
                    safeTarget.cellLevel());
        }
        if (safeTarget.isVertexTarget() && safeTarget.vertex().exact()) {
            return DungeonMapContentModel.PointerTarget.syntheticVertex(
                    safeTarget.vertexQ(),
                    safeTarget.vertexR(),
                    safeTarget.vertexLevel());
        }
        return DungeonMapContentModel.PointerTarget.target(
                safeTarget.targetKind().name(),
                safeTarget.labelKind().legacyName(),
                safeTarget.elementKind().legacyName(),
                safeTarget.ownerId(),
                safeTarget.clusterId(),
                safeTarget.topologyKind().legacyName(),
                safeTarget.topologyId(),
                safeTarget.handleRef(),
                neutralBoundaryTarget(safeTarget.boundary()),
                safeTarget.syntheticHoverKind().name());
    }

    private static DungeonMapContentModel.BoundaryTarget neutralBoundaryTarget(
            DungeonEditorRuntimePointerTarget.BoundaryTarget boundary
    ) {
        DungeonEditorRuntimePointerTarget.BoundaryTarget safeBoundary = boundary == null
                ? DungeonEditorRuntimePointerTarget.BoundaryTarget.empty()
                : boundary;
        return new DungeonMapContentModel.BoundaryTarget(
                safeBoundary.boundaryKind().legacyName(),
                safeBoundary.key(),
                safeBoundary.ownerId(),
                safeBoundary.topologyKind().legacyName(),
                safeBoundary.topologyId(),
                safeBoundary.startQ(),
                safeBoundary.startR(),
                safeBoundary.startLevel(),
                safeBoundary.endQ(),
                safeBoundary.endR(),
                safeBoundary.endLevel());
    }

    void bindControlsContentModel(DungeonEditorControlsContentModel contentModel) {
        if (contentModel == null) {
            return;
        }
        controlsProjection.addListener((ignored, before, after) -> applyControlsProjection(after, contentModel));
        applyControlsProjection(controlsProjection.get(), contentModel);
    }

    void bindMapCatalogContentModel(
            DungeonEditorControlsContentModel controlsContentModel,
            CatalogCrudControlsContentModel catalogContentModel
    ) {
        if (controlsContentModel == null || catalogContentModel == null) {
            return;
        }
        Runnable refresh = () -> applyMapCatalogProjection(
                controlsProjection.get(),
                controlsContentModel.currentMapEditorUiState(),
                catalogContentModel);
        controlsProjection.addListener((ignored, before, after) -> refresh.run());
        controlsContentModel.mapEditorProperty().addListener((ignored, before, after) -> refresh.run());
        refresh.run();
    }

    private static void applyControlsProjection(
            ControlsProjection projection,
            DungeonEditorControlsContentModel contentModel
    ) {
        ControlsProjection safeProjection = projection == null
                ? ControlsProjection.initial()
                : projection;
        contentModel.showControls(
                safeProjection.mapEntries().stream()
                        .map(entry -> new DungeonEditorControlsContentModel.MapItem(
                                entry.key(),
                                entry.mapIdValue(),
                                entry.mapName(),
                                entry.revision()))
                        .toList(),
                safeProjection.selectedMapKey(),
                safeProjection.reachableLevels(),
                safeProjection.busy(),
                safeProjection.statusText(),
                safeProjection.viewModeLabel(),
                safeProjection.overlaySettings(),
                safeProjection.projectionLevel(),
                safeProjection.selectedToolLabel());
    }

    private static void applyMapCatalogProjection(
            ControlsProjection projection,
            DungeonEditorControlsContentModel.MapEditorUiState mapEditor,
            CatalogCrudControlsContentModel catalogContentModel
    ) {
        ControlsProjection safeProjection = projection == null
                ? ControlsProjection.initial()
                : projection;
        catalogContentModel.showCatalog(new CatalogCrudControlsContentModel.CatalogState(
                "Dungeon Maps",
                "Dungeon auswählen",
                "Keine Dungeon Maps verfuegbar.",
                safeProjection.selectedMapKey(),
                safeProjection.mapEntries().stream()
                        .map(DungeonEditorContributionModel::toCatalogItem)
                        .toList(),
                new CatalogCrudControlsContentModel.Actions(true, true, true, true),
                safeProjection.busy(),
                safeProjection.statusText()));
        applyCatalogEditorState(mapEditor, catalogContentModel);
    }

    private static CatalogCrudControlsContentModel.Item toCatalogItem(MapListEntry entry) {
        return new CatalogCrudControlsContentModel.Item(
                Long.toString(entry.mapIdValue()),
                entry.mapName(),
                "",
                0L,
                true);
    }

    private static void applyCatalogEditorState(
            DungeonEditorControlsContentModel.MapEditorUiState mapEditor,
            CatalogCrudControlsContentModel catalogContentModel
    ) {
        DungeonEditorControlsContentModel.MapEditorUiState safeEditor =
                DungeonEditorControlsContentModel.MapEditorUiState.resolve(mapEditor);
        if (!safeEditor.visible()) {
            catalogContentModel.closeOperation();
            return;
        }
        if (safeEditor.isCreateMode()) {
            catalogContentModel.openCreate();
        } else if (safeEditor.isRenameMode()) {
            catalogContentModel.openRename(Long.toString(safeEditor.mapIdValue()));
        } else if (safeEditor.isDeleteMode()) {
            catalogContentModel.openDelete(Long.toString(safeEditor.mapIdValue()));
        }
        catalogContentModel.updateDraft(safeEditor.draftName());
        catalogContentModel.showValidationError(safeEditor.errorText());
    }

    private static DungeonEditorStateContentModel.StateProjectionContext stateContext(DungeonEditorRenderFrame frame) {
        DungeonEditorRenderFrame safeFrame = safeFrame(frame);
        DungeonEditorPreparedFrameFacts safeFacts = safeFrame.preparedFacts();
        return new DungeonEditorStateContentModel.StateProjectionContext(
                safeFacts.selectedMapIdValue(),
                safeFacts.statusText(),
                safeFacts.busy(),
                safeFacts.selectedToolLabel(),
                safeFacts.selectedToolKey(),
                safeFacts.viewModeLabel(),
                safeFacts.projectionLevel(),
                safeFacts.overlay().overlayLabel(),
                safeFrame.statePanelRoomNarrationDrafts(),
                safeFrame.statePanelLabelNameDraft(),
                safeFrame.statePanelCorridorPointDraft(),
                safeFrame.statePanelTransitionDescriptionDraft(),
                safeFrame.statePanelTransitionDestinationDraft(),
                safeFrame.statePanelStairGeometryDraft());
    }

    private static DungeonEditorRenderFrame safeFrame(DungeonEditorRenderFrame frame) {
        return frame == null ? emptyFrame() : frame;
    }

    private static DungeonEditorRenderFrame emptyFrame() {
        return new DungeonEditorRenderFrame(
                DungeonEditorControlsSnapshot.empty(""),
                DungeonEditorMapSurfaceSnapshot.empty(),
                DungeonEditorStateSnapshot.empty(""),
                DungeonEditorPreparedFrameFacts.empty(),
                null,
                null,
                null,
                null,
                null,
                null,
                DungeonEditorInlineLabelEditSession.inactive());
    }

    record ControlsProjection(
            List<MapListEntry> mapEntries,
            String selectedMapKey,
            List<Integer> reachableLevels,
            boolean busy,
            String statusText,
            String viewModeLabel,
            DungeonOverlaySettings overlaySettings,
            int projectionLevel,
            String selectedToolLabel
    ) {
        ControlsProjection {
            mapEntries = mapEntries == null ? List.of() : List.copyOf(mapEntries);
            selectedMapKey = selectedMapKey == null ? "" : selectedMapKey;
            reachableLevels = reachableLevels == null ? List.of(0) : List.copyOf(reachableLevels);
            statusText = statusText == null ? "" : statusText;
            viewModeLabel = DungeonEditorControlsContentModel.normalizeViewModeKey(viewModeLabel);
            overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
            selectedToolLabel = selectedToolLabel == null
                    ? DungeonEditorControlsContentModel.defaultToolLabel()
                    : selectedToolLabel;
        }

        static ControlsProjection initial() {
            return new ControlsProjection(
                    List.of(),
                    "",
                    List.of(0),
                    false,
                    "",
                    DungeonEditorControlsContentModel.gridViewLabel(),
                    DungeonOverlaySettings.defaults(),
                    0,
                    DungeonEditorControlsContentModel.defaultToolLabel());
        }

        static ControlsProjection from(DungeonEditorPreparedFrameFacts facts) {
            DungeonEditorPreparedFrameFacts safeFacts =
                    facts == null ? DungeonEditorPreparedFrameFacts.empty() : facts;
            return new ControlsProjection(
                    safeFacts.mapEntries().stream()
                            .map(entry -> new MapListEntry(
                                    entry.key(),
                                    entry.mapIdValue(),
                                    entry.mapName(),
                                    entry.revision()))
                            .toList(),
                    safeFacts.selectedMapKey(),
                    safeFacts.reachableLevels(),
                    safeFacts.busy(),
                    safeFacts.statusText(),
                    safeFacts.viewModeLabel(),
                    safeFacts.overlaySettings(),
                    safeFacts.projectionLevel(),
                    safeFacts.selectedToolLabel());
        }
    }

    record InteractionState(
            long currentSelectedMapIdValue,
            String currentViewModeKey,
            String currentSelectedToolLabel,
            String currentSelectedToolKey,
            int currentProjectionLevel,
            DungeonEditorPreparedFrameFacts.OverlayFrame currentOverlayProjection
    ) {
        InteractionState {
            currentSelectedMapIdValue = Math.max(0L, currentSelectedMapIdValue);
            currentViewModeKey = DungeonEditorControlsContentModel.normalizeViewModeKey(currentViewModeKey);
            currentSelectedToolLabel = currentSelectedToolLabel == null
                    ? DungeonEditorControlsContentModel.defaultToolLabel()
                    : currentSelectedToolLabel;
            currentSelectedToolKey = currentSelectedToolKey == null || currentSelectedToolKey.isBlank()
                    ? "SELECT"
                    : currentSelectedToolKey;
            currentOverlayProjection = currentOverlayProjection == null
                    ? DungeonEditorPreparedFrameFacts.OverlayFrame.from(DungeonOverlaySettings.defaults())
                    : currentOverlayProjection;
        }

        static InteractionState empty() {
            return new InteractionState(
                    0L,
                    DungeonEditorControlsContentModel.gridViewLabel(),
                    DungeonEditorControlsContentModel.defaultToolLabel(),
                    "SELECT",
                    0,
                    DungeonEditorPreparedFrameFacts.OverlayFrame.from(DungeonOverlaySettings.defaults()));
        }

        static InteractionState from(DungeonEditorPreparedFrameFacts facts) {
            DungeonEditorPreparedFrameFacts safeFacts =
                    facts == null ? DungeonEditorPreparedFrameFacts.empty() : facts;
            return new InteractionState(
                    safeFacts.selectedMapIdValue(),
                    safeFacts.viewModeLabel(),
                    safeFacts.selectedToolLabel(),
                    safeFacts.selectedToolKey(),
                    safeFacts.projectionLevel(),
                    safeFacts.overlay());
        }
    }

    record MapListEntry(
            String key,
            long mapIdValue,
            String mapName,
            long revision
    ) {
        MapListEntry {
            key = key == null ? "" : key;
            mapIdValue = Math.max(0L, mapIdValue);
            mapName = mapName == null || mapName.isBlank() ? defaultMapName() : mapName;
            revision = Math.max(0L, revision);
        }

    }

    private static String defaultMapName() {
        return "Dungeon Map";
    }

}
