package shell.api;

import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Predicate;
import java.util.function.Supplier;
import org.jspecify.annotations.Nullable;

/**
 * Runtime shell ports that a feature root may pass into its internal view wiring.
 */
public final class ShellRuntimeContext {

    private static final int FIRST_ARGUMENT = 0;
    private static final String PUSH_METHOD = "push";
    private static final String CLEAR_METHOD = "clear";
    private static final String IS_SHOWING_METHOD = "isShowing";
    private static final String TO_STRING_METHOD = "toString";
    private static final String HASH_CODE_METHOD = "hashCode";
    private static final String EQUALS_METHOD = "equals";

    private final Consumer<InspectorEntrySpec> inspectorPush;
    private final Runnable inspectorClear;
    private final Predicate<Object> inspectorShowing;
    private final ServiceRegistry services;
    private final Map<Class<?>, Object> sessions = new LinkedHashMap<>();

    public ShellRuntimeContext(InspectorSink inspector, ServiceRegistry services) {
        InspectorSink inspectorSink = Objects.requireNonNull(inspector, "inspector");
        this.inspectorPush = inspectorSink::push;
        this.inspectorClear = inspectorSink::clear;
        this.inspectorShowing = inspectorSink::isShowing;
        this.services = Objects.requireNonNull(services, "services");
    }

    public InspectorSink inspector() {
        return (InspectorSink) Proxy.newProxyInstance(
                InspectorSink.class.getClassLoader(),
                new Class<?>[] {InspectorSink.class},
                this::invokeInspector);
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

    @SuppressWarnings("PMD.CompareObjectsWithEquals")
    private @Nullable Object invokeInspector(Object proxy, Method method, Object[] arguments) {
        String methodName = method.getName();
        if (PUSH_METHOD.equals(methodName)) {
            inspectorPush.accept((InspectorEntrySpec) arguments[FIRST_ARGUMENT]);
            return null;
        }
        if (CLEAR_METHOD.equals(methodName)) {
            inspectorClear.run();
            return null;
        }
        if (IS_SHOWING_METHOD.equals(methodName)) {
            return inspectorShowing.test(arguments[FIRST_ARGUMENT]);
        }
        if (TO_STRING_METHOD.equals(methodName)) {
            return "ShellRuntimeContext.inspector()";
        }
        if (HASH_CODE_METHOD.equals(methodName)) {
            return System.identityHashCode(proxy);
        }
        if (EQUALS_METHOD.equals(methodName)) {
            return proxy == arguments[FIRST_ARGUMENT];
        }
        throw new UnsupportedOperationException("Unsupported InspectorSink method: " + methodName);
    }
}
