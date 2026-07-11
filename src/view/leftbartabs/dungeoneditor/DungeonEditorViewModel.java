package src.view.leftbartabs.dungeoneditor;

import java.util.Objects;
import src.features.dungeon.runtime.DungeonEditorRenderFrame;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsContentModel;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsViewInputEvent;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapViewInputEvent;

final class DungeonEditorViewModel {
    private final DungeonEditorControlsPanelModel controlsPanelModel;
    private final DungeonEditorStatePanelModel statePanelModel;
    private final CatalogCrudControlsContentModel catalogContentModel;
    private final DungeonMapContentModel mapContentModel;
    private final DungeonEditorContributionModel legacyContributionModel;
    private final DungeonEditorIntentHandler legacyIntentHandler;

    DungeonEditorViewModel(
            DungeonEditorControlsPanelModel controlsPanelModel,
            DungeonEditorStatePanelModel statePanelModel,
            CatalogCrudControlsContentModel catalogContentModel,
            DungeonMapContentModel mapContentModel,
            DungeonEditorRuntimeOperations operations
    ) {
        this.controlsPanelModel = Objects.requireNonNull(controlsPanelModel, "controlsPanelModel");
        this.statePanelModel = Objects.requireNonNull(statePanelModel, "statePanelModel");
        this.catalogContentModel = Objects.requireNonNull(catalogContentModel, "catalogContentModel");
        this.mapContentModel = Objects.requireNonNull(mapContentModel, "mapContentModel");
        legacyContributionModel = new DungeonEditorContributionModel(statePanelModel.legacyContentModel());
        legacyIntentHandler = new DungeonEditorIntentHandler(
                legacyContributionModel,
                controlsPanelModel.legacyContentModel(),
                this.catalogContentModel,
                statePanelModel.legacyContentModel(),
                this.mapContentModel,
                Objects.requireNonNull(operations, "operations"));
    }

    void bindPanelModels() {
        legacyContributionModel.bindControlsContentModel(controlsPanelModel.legacyContentModel());
        legacyContributionModel.bindMapCatalogContentModel(
                controlsPanelModel.legacyContentModel(),
                catalogContentModel);
    }

    void applyFrame(DungeonEditorRenderFrame frame) {
        legacyContributionModel.applyFrame(frame);
        mapContentModel.applyEditorRenderFrame(frame);
    }

    void consume(DungeonMapViewInputEvent event) {
        legacyIntentHandler.consume(event);
    }

    void consume(DungeonEditorControlsInput input) {
        DungeonEditorControlsInput safeInput = input == null
                ? DungeonEditorControlsInput.fromLegacy(null)
                : input;
        legacyIntentHandler.consume(safeInput.toLegacyEvent());
    }

    void consume(CatalogCrudControlsViewInputEvent event) {
        legacyIntentHandler.consume(event);
    }

    void consume(DungeonEditorStateInput input) {
        DungeonEditorStateInput safeInput = input == null
                ? DungeonEditorStateInput.fromLegacy(null)
                : input;
        legacyIntentHandler.consume(safeInput.toLegacyEvent());
    }
}
