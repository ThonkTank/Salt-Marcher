package features.party.api;

import org.jspecify.annotations.Nullable;

public record PartyMemberSummary(
        Long id,
        String name,
        @Nullable Integer level
) {
}
