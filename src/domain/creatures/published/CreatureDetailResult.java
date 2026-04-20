package src.domain.creatures.published;

import org.jspecify.annotations.Nullable;

public record CreatureDetailResult(
        CreatureLookupStatus status,
        @Nullable CreatureDetail detail
) {
}
