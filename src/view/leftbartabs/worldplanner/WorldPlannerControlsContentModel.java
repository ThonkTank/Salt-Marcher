package src.view.leftbartabs.worldplanner;

import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.worldplanner.published.WorldPlannerSnapshot;

final class WorldPlannerControlsContentModel {

    private final ReadOnlyObjectWrapper<Projection> projection =
            new ReadOnlyObjectWrapper<>(Projection.empty());
    private int activeModuleIndex;

    ReadOnlyObjectProperty<Projection> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    void activate(int moduleIndex) {
        activeModuleIndex = Math.max(0, moduleIndex);
        refreshProjection();
    }

    void applySnapshot(WorldPlannerSnapshot nextSnapshot) {
        refreshProjection();
    }

    private void refreshProjection() {
        projection.set(new Projection(activeModuleIndex));
    }

    record Projection(
            int activeModuleIndex
    ) {

        Projection {
            activeModuleIndex = Math.max(0, activeModuleIndex);
        }

        static Projection empty() {
            return new Projection(0);
        }
    }
}
