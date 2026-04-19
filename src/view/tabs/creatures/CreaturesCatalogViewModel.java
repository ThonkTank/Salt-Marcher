package src.view.tabs.creatures;

import java.util.Objects;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import src.domain.creatures.CreaturesApplicationService;

public final class CreaturesCatalogViewModel {

    private final CreaturesApplicationService creatures;
    private final ReadOnlyStringWrapper summary = new ReadOnlyStringWrapper("");

    public CreaturesCatalogViewModel(CreaturesApplicationService creatures) {
        this.creatures = Objects.requireNonNull(creatures, "creatures");
    }

    public ReadOnlyStringProperty summaryProperty() {
        return summary.getReadOnlyProperty();
    }

    public void load() {
        summary.set(String.valueOf(creatures.loadFilterOptions()));
    }
}
