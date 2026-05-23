package shell.api;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;

/**
 * Typed lookup registry for runtime services assembled during bootstrap.
 */
public final class ServiceRegistry {

    private final Map<Class<?>, Object> services;
    private final Map<Class<?>, Function<ServiceRegistry, ?>> factories;
    private final Set<Class<?>> resolving = new LinkedHashSet<>();

    private ServiceRegistry(Map<Class<?>, Object> services) {
        this(services, Map.of(), true);
    }

    private ServiceRegistry(
            Map<Class<?>, Object> services,
            Map<Class<?>, Function<ServiceRegistry, ?>> factories,
            boolean immutable
    ) {
        this.services = immutable ? Map.copyOf(services) : services;
        this.factories = immutable ? Map.copyOf(factories) : factories;
    }

    public static ServiceRegistry empty() {
        return new ServiceRegistry(Map.of());
    }

    public <T> Optional<T> find(Class<T> serviceType) {
        Objects.requireNonNull(serviceType, "serviceType");
        Object service = service(serviceType);
        return service == null ? Optional.empty() : Optional.of(serviceType.cast(service));
    }

    public <T> T require(Class<T> serviceType) {
        return find(serviceType)
                .orElseThrow(() -> new IllegalStateException("Runtime service not registered: " + serviceType.getName()));
    }

    private Object service(Class<?> serviceType) {
        Object service = services.get(serviceType);
        if (service != null || !factories.containsKey(serviceType)) {
            return service;
        }
        if (!resolving.add(serviceType)) {
            throw new IllegalStateException("Runtime service factory cycle: " + resolving);
        }
        try {
            Function<ServiceRegistry, ?> factory = factories.get(serviceType);
            Object created = Objects.requireNonNull(
                    factory.apply(this),
                    () -> "Runtime service factory returned null: " + serviceType.getName());
            services.put(serviceType, created);
            return created;
        } finally {
            resolving.remove(serviceType);
        }
    }

    public static final class Builder {

        private final Map<Class<?>, Object> services = new LinkedHashMap<>();
        private final Map<Class<?>, Function<ServiceRegistry, ?>> factories = new LinkedHashMap<>();

        public <T> Builder register(Class<T> serviceType, T service) {
            Objects.requireNonNull(serviceType, "serviceType");
            Objects.requireNonNull(service, "service");
            if (factories.containsKey(serviceType)) {
                throw new IllegalStateException("Runtime service already registered: " + serviceType.getName());
            }
            Object previous = services.putIfAbsent(serviceType, service);
            if (previous != null) {
                throw new IllegalStateException("Runtime service already registered: " + serviceType.getName());
            }
            return this;
        }

        public <T> Builder registerFactory(Class<T> serviceType, Function<ServiceRegistry, T> factory) {
            Objects.requireNonNull(serviceType, "serviceType");
            Objects.requireNonNull(factory, "factory");
            if (services.containsKey(serviceType) || factories.containsKey(serviceType)) {
                throw new IllegalStateException("Runtime service already registered: " + serviceType.getName());
            }
            factories.put(serviceType, factory);
            return this;
        }

        public ServiceRegistry build() {
            ServiceRegistry registry = new ServiceRegistry(
                    new LinkedHashMap<>(services),
                    new LinkedHashMap<>(factories),
                    false);
            for (Class<?> serviceType : factories.keySet()) {
                registry.require(serviceType);
            }
            return new ServiceRegistry(registry.services);
        }
    }
}
