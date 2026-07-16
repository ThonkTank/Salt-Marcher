package features.creatures.adapter.sqlite.model;

import org.jspecify.annotations.Nullable;

public record CreatureActionRecord(
        String actionType,
        String name,
        String description,
        @Nullable Integer toHitBonus
) {
}
