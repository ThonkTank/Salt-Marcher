package src.view.leftbartabs.sessionplanner;

import java.util.List;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.sessionplanner.published.SessionPlannerEncountersProjection;

public final class SessionPlannerLootMainContentModel {

    private final ReadOnlyObjectWrapper<Projection> projection =
            new ReadOnlyObjectWrapper<>(Projection.empty());

    ReadOnlyObjectProperty<Projection> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    void applyEncounters(SessionPlannerEncountersProjection encountersProjection) {
        projection.set(Projection.from(encountersProjection));
    }

    record Projection(List<LootModel> lootPlaceholders) {

        Projection {
            lootPlaceholders = lootPlaceholders == null ? List.of() : List.copyOf(lootPlaceholders);
        }

        static Projection empty() {
            return new Projection(List.of());
        }

        static Projection from(SessionPlannerEncountersProjection projection) {
            SessionPlannerEncountersProjection safe =
                    projection == null ? SessionPlannerEncountersProjection.empty() : projection;
            return new Projection(safe.lootPlaceholders().stream()
                    .map(loot -> new LootModel(loot.token(), loot.label()))
                    .toList());
        }

        record LootModel(
                long token,
                String label
        ) {

            LootModel {
                label = label == null ? "" : label;
            }
        }
    }
}
