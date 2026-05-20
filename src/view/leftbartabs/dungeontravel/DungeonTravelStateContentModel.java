package src.view.leftbartabs.dungeontravel;

import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;

final class DungeonTravelStateContentModel {

    private final ReadOnlyStringWrapper state = new ReadOnlyStringWrapper("");
    private final ReadOnlyObjectWrapper<List<DungeonTravelContributionModel.ActionProjection>> actions =
            new ReadOnlyObjectWrapper<>(List.of());

    ReadOnlyStringProperty stateProperty() {
        return state.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<List<DungeonTravelContributionModel.ActionProjection>> actionsProperty() {
        return actions.getReadOnlyProperty();
    }

    void bindTo(DungeonTravelContributionModel contributionModel) {
        if (contributionModel == null) {
            return;
        }
        contributionModel.stateProperty().addListener((ignored, before, after) -> state.set(after));
        contributionModel.actionsProperty().addListener((ignored, before, after) -> actions.set(after));
        state.set(contributionModel.stateProperty().get());
        actions.set(contributionModel.actionsProperty().get());
    }
}
