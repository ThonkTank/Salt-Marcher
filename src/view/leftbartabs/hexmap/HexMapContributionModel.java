package src.view.leftbartabs.hexmap;

import java.util.List;
import java.util.Objects;
import src.domain.hex.published.HexEditorSnapshot;
import src.domain.hex.published.HexTravelSnapshot;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsContentModel;

public final class HexMapContributionModel {

    private static final CatalogCrudControlsContentModel.Actions HEX_MAP_ACTIONS =
            new CatalogCrudControlsContentModel.Actions(
                    true,
                    true,
                    false,
                    true,
                    true,
                    true,
                    false,
                    true);
    private final HexMapControlsContentModel controlsContentModel;
    private final HexMapMainContentModel mainContentModel;
    private final HexMapStateContentModel stateContentModel;
    private HexTravelSnapshot travelSnapshot = HexTravelSnapshot.empty("Keine Hex-Reiseposition ausgewaehlt.");
    private CatalogCrudControlsContentModel mapCatalogContentModel;
    private HexEditorSnapshot editorSnapshot = HexEditorSnapshot.empty("Keine Hex-Karte geladen.");

    HexMapContributionModel(
            HexMapControlsContentModel controlsContentModel,
            HexMapMainContentModel mainContentModel,
            HexMapStateContentModel stateContentModel
    ) {
        this.controlsContentModel = Objects.requireNonNull(
                controlsContentModel,
                "controlsContentModel");
        this.mainContentModel = Objects.requireNonNull(mainContentModel, "mainContentModel");
        this.stateContentModel = Objects.requireNonNull(stateContentModel, "stateContentModel");
    }

    void applySnapshot(HexEditorSnapshot snapshot) {
        HexEditorSnapshot safeSnapshot = snapshot == null
                ? HexEditorSnapshot.empty("Hex editor service is not registered.")
                : snapshot;
        editorSnapshot = safeSnapshot;
        controlsContentModel.applySnapshot(safeSnapshot);
        mainContentModel.applySnapshot(safeSnapshot);
        stateContentModel.applySnapshot(safeSnapshot);
        refreshMapCatalog();
    }

    void applyTravelSnapshot(HexTravelSnapshot snapshot) {
        travelSnapshot = snapshot == null
                ? HexTravelSnapshot.empty("Hex travel service is not registered.")
                : snapshot;
        mainContentModel.applyTravelSnapshot(travelSnapshot);
        stateContentModel.applyTravelSnapshot(travelSnapshot);
    }

    void showLocalFailure(String failureText) {
        stateContentModel.showLocalFailure(failureText);
    }

    HexMapControlsContentModel controlsContentModel() {
        return controlsContentModel;
    }

    HexMapMainContentModel mainContentModel() {
        return mainContentModel;
    }

    HexMapStateContentModel stateContentModel() {
        return stateContentModel;
    }

    void bindMapCatalogContentModel(CatalogCrudControlsContentModel contentModel) {
        mapCatalogContentModel = Objects.requireNonNull(contentModel, "contentModel");
        refreshMapCatalog();
    }

    List<Long> partyTokenCharacterIds() {
        return travelSnapshot.partyTokenCharacterIds();
    }

    private void refreshMapCatalog() {
        if (mapCatalogContentModel == null) {
            return;
        }
        String selectedMapId = editorSnapshot.selectedMap()
                .map(map -> Long.toString(map.mapId().value()))
                .orElse("");
        mapCatalogContentModel.showCatalog(new CatalogCrudControlsContentModel.CatalogState(
                "Hex-Karten",
                "Hex-Karte auswaehlen",
                "Keine Hex-Karten verfuegbar.",
                selectedMapId,
                editorSnapshot.catalog().stream()
                        .map(summary -> new CatalogCrudControlsContentModel.Item(
                                Long.toString(summary.mapId().value()),
                                summary.displayName(),
                                "Radius " + summary.radius(),
                                0L,
                                true))
                        .toList(),
                HEX_MAP_ACTIONS,
                false,
                editorSnapshot.statusText()));
    }
}
