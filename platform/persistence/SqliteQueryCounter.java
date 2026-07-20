package platform.persistence;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicInteger;

/** Counts the actual prepared statements created through one SQLite connection. */
public final class SqliteQueryCounter {

    private final AtomicInteger queries = new AtomicInteger();
    private final Connection connection;

    public SqliteQueryCounter(Connection delegate) {
        Connection safeDelegate = Objects.requireNonNull(delegate, "delegate");
        connection = (Connection) Proxy.newProxyInstance(
                Connection.class.getClassLoader(),
                new Class<?>[] {Connection.class},
                (proxy, method, arguments) -> {
                    if (method.getName().equals("prepareStatement")) {
                        queries.incrementAndGet();
                    }
                    try {
                        return method.invoke(safeDelegate, arguments);
                    } catch (InvocationTargetException failure) {
                        throw failure.getCause();
                    }
                });
    }

    public Connection connection() {
        return connection;
    }

    public int queryCount() {
        return queries.get();
    }
}
