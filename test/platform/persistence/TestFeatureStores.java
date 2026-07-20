package platform.persistence;

import platform.diagnostics.NoopDiagnostics;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;

/** Test-only composition for owner-bound SQLite stores. */
public final class TestFeatureStores {

    private static final AtomicReference<TestResource> CURRENT = new AtomicReference<>();

    private TestFeatureStores() {}

    /** Opens the single default-database resource owned by the current test method. */
    public static TestResource openTestResource(List<FeatureStoreDefinition> definitions) {
        TestResource resource = new TestResource(definitions);
        if (!CURRENT.compareAndSet(null, resource)) {
            throw new IllegalStateException("a test feature-store resource is already active");
        }
        return resource;
    }

    /** Returns the resource installed for the current test method by {@code IsolatedDataExtension}. */
    public static TestResource current() {
        TestResource resource = CURRENT.get();
        if (resource == null) {
            throw new IllegalStateException("no test feature-store resource is active");
        }
        return resource;
    }

    public static FeatureStoreHandle store(
            SqliteDatabase database, FeatureStoreDefinition definition) {
        return stores(database, definition).get(definition.owner());
    }

    /** Convenience for synthetic persistence tests that still own and close their lifecycle. */
    public static FeatureStoreHandle store(
            SqliteDatabase database, String owner, SqliteMigration... migrations) {
        return store(database, FeatureStoreDefinition.validated(owner, connection -> { }, migrations));
    }

    /** Registers every requested owner before the test-owned lifecycle is prepared exactly once. */
    public static Map<String, FeatureStoreHandle> stores(
            SqliteDatabase database, FeatureStoreDefinition... definitions) {
        SqliteDatabase lifecycle = Objects.requireNonNull(database, "database");
        Map<String, FeatureStoreHandle> handles = register(lifecycle, List.of(definitions));
        lifecycle.prepareRegisteredStores();
        return Map.copyOf(handles);
    }

    private static Map<String, FeatureStoreHandle> register(
            SqliteDatabase database, List<FeatureStoreDefinition> definitions) {
        Map<String, FeatureStoreHandle> handles = new LinkedHashMap<>();
        for (FeatureStoreDefinition definition : definitions) {
            FeatureStoreDefinition required = Objects.requireNonNull(definition, "definition");
            if (handles.containsKey(required.owner())) {
                throw new IllegalArgumentException("duplicate test feature-store owner: " + required.owner());
            }
            handles.put(required.owner(), database.featureStore(required));
        }
        return handles;
    }

    /** One lazy SQLite lifecycle, complete owner manifest, and explicit close per test method. */
    public static final class TestResource implements AutoCloseable {
        private final List<FeatureStoreDefinition> definitions;
        private SqliteDatabase database;
        private Map<String, FeatureStoreHandle> handles = Map.of();
        private boolean closed;

        private TestResource(List<FeatureStoreDefinition> definitions) {
            this.definitions = List.copyOf(Objects.requireNonNull(definitions, "definitions"));
            if (this.definitions.isEmpty()) {
                throw new IllegalArgumentException("test feature-store manifest must not be empty");
            }
        }

        public synchronized FeatureStoreHandle store(FeatureStoreDefinition definition) {
            FeatureStoreDefinition required = Objects.requireNonNull(definition, "definition");
            prepare();
            FeatureStoreHandle handle = handles.get(required.owner());
            if (handle == null) {
                throw new IllegalArgumentException(
                        "feature store is absent from the test manifest: " + required.owner());
            }
            return handle;
        }

        private void prepare() {
            if (closed) {
                throw new IllegalStateException("test feature-store resource is closed");
            }
            if (database != null) {
                return;
            }
            SqliteDatabase created = SqliteDatabase.defaultDatabase(
                    SqliteDatabase.DEFAULT_DATABASE_FILE_NAME, NoopDiagnostics.INSTANCE);
            try {
                Map<String, FeatureStoreHandle> registered = register(created, definitions);
                created.prepareRegisteredStores();
                database = created;
                handles = Map.copyOf(registered);
            } catch (RuntimeException | Error failure) {
                created.close();
                throw failure;
            }
        }

        @Override
        public synchronized void close() {
            if (closed) {
                return;
            }
            try {
                if (database != null) {
                    database.close();
                    database = null;
                    handles = Map.of();
                }
            } finally {
                closed = true;
                CURRENT.compareAndSet(this, null);
            }
        }
    }
}
