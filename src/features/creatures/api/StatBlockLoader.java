package features.creatures.api;

import features.creatures.model.Creature;
import javafx.beans.value.ObservableIntegerValue;
import javafx.concurrent.Task;
import javafx.scene.layout.VBox;

public final class StatBlockLoader {
    private StatBlockLoader() {
        throw new AssertionError("No instances");
    }

    public static Task<CreatureCatalogService.ServiceResult<Creature>> loadAsync(Long creatureId, VBox container) {
        return features.creatures.ui.shared.statblock.StatBlockLoader.loadAsync(creatureId, container);
    }

    public static Task<CreatureCatalogService.ServiceResult<Creature>> loadAsync(StatBlockRequest request, VBox container) {
        return features.creatures.ui.shared.statblock.StatBlockLoader.loadAsync(request, container);
    }

    public static Task<CreatureCatalogService.ServiceResult<Creature>> loadAsync(
            StatBlockRequest request,
            VBox container,
            ObservableIntegerValue targetAcInput) {
        return features.creatures.ui.shared.statblock.StatBlockLoader.loadAsync(request, container, targetAcInput);
    }
}
