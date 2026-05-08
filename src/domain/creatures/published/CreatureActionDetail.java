package src.domain.creatures.published;

import org.jspecify.annotations.Nullable;

public record CreatureActionDetail(
        String actionType,
        String name,
        String description,
        @Nullable Integer toHitBonus
) {

    public CreatureActionDetail {
        actionType = actionType == null ? "" : actionType;
        name = name == null ? "" : name;
        description = description == null ? "" : description;
    }
}
