package features.encounter.api;

import java.util.List;

/** Foreign facts for one context. Runtime-owned builder/combat state is never overwritten by sync. */
public record EncounterRuntimeContextSpec(
        EncounterRuntimeContextId contextId,
        List<Long> partyMemberIds,
        long locationId,
        long initialEncounterPlanId,
        List<EncounterRuntimeNpcSpec> npcs
) {

    public EncounterRuntimeContextSpec {
        if (contextId == null) {
            throw new IllegalArgumentException("contextId is required");
        }
        partyMemberIds = partyMemberIds == null ? List.of() : partyMemberIds.stream()
                .filter(id -> id != null && id.longValue() > 0L)
                .distinct()
                .toList();
        locationId = Math.max(0L, locationId);
        initialEncounterPlanId = Math.max(0L, initialEncounterPlanId);
        npcs = npcs == null ? List.of() : List.copyOf(npcs);
    }
}
