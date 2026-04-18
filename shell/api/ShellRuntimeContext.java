package shell.api;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;

/**
 * Runtime shell ports that a feature root may pass into its internal view wiring.
 */
public final class ShellRuntimeContext {

    private final InspectorSink inspector;
    private final ServiceRegistry services;
    private final Map<Class<?>, Object> sessions = new LinkedHashMap<>();

    public ShellRuntimeContext(InspectorSink inspector, ServiceRegistry services) {
        this.inspector = Objects.requireNonNull(inspector, "inspector");
        this.services = Objects.requireNonNull(services, "services");
    }

    public InspectorSink inspector() {
        return inspector;
    }

    public ServiceRegistry services() {
        return services;
    }

    public synchronized <T> T session(Class<T> sessionType, Supplier<? extends T> factory) {
        Objects.requireNonNull(sessionType, "sessionType");
        Objects.requireNonNull(factory, "factory");
        Object existing = sessions.get(sessionType);
        if (existing != null) {
            return sessionType.cast(existing);
        }
        T created = Objects.requireNonNull(factory.get(), "factory returned null");
        sessions.put(sessionType, created);
        return created;
    }
}
