package shell.host;

import java.util.Objects;

/**
 * Runtime shell ports that a feature root may pass into its internal view wiring.
 */
public final class ShellRuntimeContext {

    private final InspectorSink inspector;

    public ShellRuntimeContext(InspectorSink inspector) {
        this.inspector = Objects.requireNonNull(inspector, "inspector");
    }

    public InspectorSink inspector() {
        return inspector;
    }
}
