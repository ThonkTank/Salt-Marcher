package src.domain.creatures.api;

import org.jspecify.annotations.Nullable;

public record CreatureActionDetail(
        String actionType,
        String name,
        String description,
        @Nullable Integer toHitBonus
) {
}
