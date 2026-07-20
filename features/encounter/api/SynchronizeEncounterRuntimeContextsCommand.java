package features.encounter.api;

import java.util.List;

/** Complete Scene-owned context set at one monotonically increasing source revision. */
public record SynchronizeEncounterRuntimeContextsCommand(
        long sourceRevision,
        EncounterRuntimeContextId focusedContextId,
        List<EncounterRuntimeContextSpec> contexts
) {

    public SynchronizeEncounterRuntimeContextsCommand {
        sourceRevision = Math.max(0L, sourceRevision);
        contexts = contexts == null ? List.of() : List.copyOf(contexts);
        if (focusedContextId == null) {
            throw new IllegalArgumentException("focusedContextId is required");
        }
    }
}
