package src.view.leftbartabs.hexmap;

import java.util.List;
import src.domain.hex.published.HexEditorSnapshot;
import src.domain.hex.published.HexTravelSnapshot;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsContentModel;

final class HexMapViewModel {

    private final HexMapControlsContentModel controlsContentModel = new HexMapControlsContentModel();
    private final CatalogCrudControlsContentModel mapCatalogContentModel = new CatalogCrudControlsContentModel();
    private final HexMapMainContentModel mainContentModel = new HexMapMainContentModel();
    private final HexMapStateContentModel stateContentModel = new HexMapStateContentModel();
    private final HexMapContributionModel contributionModel = new HexMapContributionModel(
            controlsContentModel,
            mainContentModel,
            stateContentModel);

    HexMapViewModel() {
        contributionModel.bindMapCatalogContentModel(mapCatalogContentModel);
    }

    HexMapControlsContentModel controlsContentModel() {
        return controlsContentModel;
    }

    CatalogCrudControlsContentModel mapCatalogContentModel() {
        return mapCatalogContentModel;
    }

    HexMapMainContentModel mainContentModel() {
        return mainContentModel;
    }

    HexMapStateContentModel stateContentModel() {
        return stateContentModel;
    }

    void applySnapshot(HexEditorSnapshot snapshot) {
        contributionModel.applySnapshot(snapshot);
    }

    void applyTravelSnapshot(HexTravelSnapshot snapshot) {
        contributionModel.applyTravelSnapshot(snapshot);
    }

    void showLocalFailure(String failureText) {
        contributionModel.showLocalFailure(failureText);
    }

    List<Long> partyTokenCharacterIds() {
        return contributionModel.partyTokenCharacterIds();
    }

}
