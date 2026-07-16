package features.encounter.application;

import java.util.List;
import features.encounter.api.EncounterRuntimeContextId;
import features.encounter.api.EncounterRuntimeContextSpec;
import features.encounter.domain.session.EncounterSessionMemento;

public interface EncounterRuntimeContextRepository {

    StoredRuntimeContexts load();

    void replace(StoredRuntimeContexts contexts);

    record StoredRuntimeContexts(
            long sourceRevision,
            EncounterRuntimeContextId focusedContextId,
            List<StoredRuntimeContext> contexts
    ) {

        public StoredRuntimeContexts {
            sourceRevision = Math.max(0L, sourceRevision);
            contexts = contexts == null ? List.of() : List.copyOf(contexts);
        }

        public static StoredRuntimeContexts empty() {
            return new StoredRuntimeContexts(0L, null, List.of());
        }
    }

    record StoredRuntimeContext(
            EncounterRuntimeContextSpec specification,
            EncounterSessionMemento session
    ) {

        public StoredRuntimeContext {
            if (specification == null || session == null) {
                throw new IllegalArgumentException("Runtime context requires specification and session.");
            }
        }
    }
}
