package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Objects;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts;
import src.features.dungeon.runtime.DungeonEditorRenderFrame;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsContentModel;

public final class DungeonEditorContributionModel {

    private final ReadOnlyObjectWrapper<ControlsProjection> controlsProjection =
            new ReadOnlyObjectWrapper<>(ControlsProjection.initial());
    private final DungeonEditorStateContentModel stateContentModel;

    private InteractionState interactionState = InteractionState.empty();

    DungeonEditorContributionModel(DungeonEditorStateContentModel stateContentModel) {
        this.stateContentModel = Objects.requireNonNull(stateContentModel, "stateContentModel");
    }

    public void applyFrame(DungeonEditorRenderFrame frame) {
        DungeonEditorRenderFrame safeFrame = frame == null
                ? new DungeonEditorRenderFrame(
                        src.domain.dungeon.published.DungeonEditorControlsSnapshot.empty(""),
                        src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot.empty(),
                        DungeonEditorStateSnapshot.empty(""),
                        DungeonEditorPreparedFrameFacts.empty(),
                        null)
                : frame;
        DungeonEditorPreparedFrameFacts facts = safeFrame.preparedFacts();
        interactionState = InteractionState.from(facts);
        controlsProjection.set(ControlsProjection.from(facts));
        stateContentModel.apply(safeFrame.state(), stateContext(safeFrame));
    }

    InteractionState currentInteractionState() {
        return interactionState;
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
        DungeonEditorRenderFrame safeFrame = frame == null
                ? new DungeonEditorRenderFrame(
                        src.domain.dungeon.published.DungeonEditorControlsSnapshot.empty(""),
                        src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot.empty(),
                        DungeonEditorStateSnapshot.empty(""),
                        DungeonEditorPreparedFrameFacts.empty(),
                        null)
                : frame;
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
                safeFrame.statePanelLabelNameDraft());
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
            projectionLevel = Math.max(0, projectionLevel);
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
            currentProjectionLevel = Math.max(0, currentProjectionLevel);
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
