package shell.host;

import java.util.Objects;

/**
 * Runtime shell ports that a feature root may pass into its internal view wiring.
 */
public final class ShellRuntimeContext {

    private final InspectorSink inspector;
    private final PersistenceRegistry persistence;

    public ShellRuntimeContext(InspectorSink inspector, PersistenceRegistry persistence) {
        this.inspector = Objects.requireNonNull(inspector, "inspector");
        this.persistence = Objects.requireNonNull(persistence, "persistence");
    }

    public InspectorSink inspector() {
        return inspector;
    }

    public PersistenceRegistry persistence() {
        return persistence;
    }
}
