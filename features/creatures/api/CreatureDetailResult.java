package features.creatures.api;

import org.jspecify.annotations.Nullable;

public record CreatureDetailResult(
        CreatureLookupStatus status,
        @Nullable CreatureDetail detail
) {
}
