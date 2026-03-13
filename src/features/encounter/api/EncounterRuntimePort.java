package features.encounter.api;

import java.util.List;

/**
 * Narrow runtime entrypoint for cross-feature encounter triggers.
 */
public interface EncounterRuntimePort {

    boolean launchEncounterFromTables(List<Long> tableIds);
}
