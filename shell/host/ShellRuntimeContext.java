package shell.host;

import java.util.Objects;

/**
 * Runtime shell ports that a feature root may pass into its internal view wiring.
 */
public final class ShellRuntimeContext {

    private final InspectorSink inspector;
    private final RuntimeServiceRegistry services;

    public ShellRuntimeContext(InspectorSink inspector, RuntimeServiceRegistry services) {
        this.inspector = Objects.requireNonNull(inspector, "inspector");
        this.services = Objects.requireNonNull(services, "services");
    }

    public InspectorSink inspector() {
        return inspector;
    }

    public RuntimeServiceRegistry services() {
        return services;
    }
}
