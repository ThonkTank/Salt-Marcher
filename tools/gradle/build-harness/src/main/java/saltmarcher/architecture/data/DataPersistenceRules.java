package saltmarcher.architecture.data;

import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;

public final class DataPersistenceRules implements ArchitectureRule {

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        // Generic data feature root topology moved to the dedicated data-layer bundle.
    }
}
