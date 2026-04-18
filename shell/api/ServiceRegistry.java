package shell.api;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * Typed lookup registry for runtime services assembled during bootstrap.
 */
public final class ServiceRegistry {

    private final Map<Class<?>, Object> services;

    private ServiceRegistry(Map<Class<?>, Object> services) {
        this.services = Map.copyOf(services);
    }

    public static ServiceRegistry empty() {
        return new ServiceRegistry(Map.of());
    }

    public <T> Optional<T> find(Class<T> serviceType) {
        Objects.requireNonNull(serviceType, "serviceType");
        Object service = services.get(serviceType);
        return service == null ? Optional.empty() : Optional.of(serviceType.cast(service));
    }

    public <T> T require(Class<T> serviceType) {
        return find(serviceType)
                .orElseThrow(() -> new IllegalStateException("Runtime service not registered: " + serviceType.getName()));
    }

    public static final class Builder {

        private final Map<Class<?>, Object> services = new LinkedHashMap<>();

        public <T> Builder register(Class<T> serviceType, T service) {
            Objects.requireNonNull(serviceType, "serviceType");
            Objects.requireNonNull(service, "service");
            Object previous = services.putIfAbsent(serviceType, service);
            if (previous != null) {
                throw new IllegalStateException("Runtime service already registered: " + serviceType.getName());
            }
            return this;
        }

        public ServiceRegistry build() {
            return new ServiceRegistry(services);
        }
    }
}
