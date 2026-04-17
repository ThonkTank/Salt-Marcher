package shell.host;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * Typed lookup registry for persistence capabilities assembled during bootstrap.
 */
public final class PersistenceRegistry {

    private final Map<Class<?>, Object> services;

    private PersistenceRegistry(Map<Class<?>, Object> services) {
        this.services = Map.copyOf(services);
    }

    public static PersistenceRegistry empty() {
        return new PersistenceRegistry(Map.of());
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

        public PersistenceRegistry build() {
            return new PersistenceRegistry(services);
        }
    }
}
