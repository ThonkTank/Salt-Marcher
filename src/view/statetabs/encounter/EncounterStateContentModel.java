package src.view.statetabs.encounter;

import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;

final class EncounterStateContentModel {

    enum ActiveContent {
        BUILDER,
        INITIATIVE,
        COMBAT,
        RESULTS
    }

    private final ReadOnlyObjectWrapper<ActiveContent> activeContent =
            new ReadOnlyObjectWrapper<>(ActiveContent.BUILDER);

    ReadOnlyObjectProperty<ActiveContent> activeContentProperty() {
        return activeContent.getReadOnlyProperty();
    }

    void showContent(ActiveContent content) {
        activeContent.set(safeContent(content));
    }

    static ActiveContent safeContent(ActiveContent content) {
        return content == null ? ActiveContent.BUILDER : content;
    }
}
