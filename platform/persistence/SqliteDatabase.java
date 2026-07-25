package platform.persistence;

import org.sqlite.SQLiteConfig;

import platform.diagnostics.DiagnosticId;
import platform.diagnostics.Diagnostics;
import java.io.IOException;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.channels.OverlappingFileLockException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.nio.file.attribute.PosixFilePermissions;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class SqliteDatabase implements AutoCloseable {

    public enum OpenMode {
        CREATE_OR_OPEN,
        RESERVED_NEW,
        EXISTING_ONLY
    }

    private static final int PLATFORM_SCHEMA_VERSION = 1;
    private static final int BUSY_TIMEOUT_MILLIS = 5_000;
    private static final String APP_DATA_DIR_NAME = "salt-marcher";
    private static final String MIGRATIONS_TABLE = "sm_schema_versions";
    private static final String CREATE_MIGRATIONS_TABLE_SQL =
            "CREATE TABLE sm_schema_versions (owner TEXT PRIMARY KEY, "
                    + "version INTEGER NOT NULL CHECK(version >= 0))";
    private static final SqliteSchemaValidator PLATFORM_SCHEMA =
            SqliteSchemaValidator.exactSchema(
                    List.of(CREATE_MIGRATIONS_TABLE_SQL),
                    List.of(),
                    List.of("sm_schema_"),
                    List.of());
    private static final byte[] SQLITE_HEADER = "SQLite format 3\0".getBytes(StandardCharsets.US_ASCII);
    private static final Pattern BACKUP_VERSION_PATTERN = Pattern.compile(".*\\.backup-v(\\d+)\\.sqlite");
    private static final DiagnosticId INTEGRITY_FAILURE =
            new DiagnosticId("persistence.integrity-failure");
    private static final DiagnosticId FAMILY_INCOMPATIBLE =
            new DiagnosticId("persistence.family-incompatible");
    private static final DiagnosticId RECOVERY_FAILURE =
            new DiagnosticId("persistence.recovery-failure");
    private static final DiagnosticId MIGRATION_FAILURE =
            new DiagnosticId("persistence.migration-failure");

    private final Path databasePath;
    private final Diagnostics diagnostics;
    private final FileMover fileMover;
    private final OpenMode openMode;
    private final Path ownershipRoot;
    private final Map<String, StoreHandle> stores = new LinkedHashMap<>();
    private final Set<String> qualifiedSourceMigrations = new LinkedHashSet<>();
    private boolean prepared;
    private boolean storesSealed;
    private boolean closed;
    private DatabaseFileToken parkedFileToken;

    public SqliteDatabase(Path databasePath, Diagnostics diagnostics) {
        this(databasePath, diagnostics, OpenMode.CREATE_OR_OPEN);
    }

    public SqliteDatabase(Path databasePath, Diagnostics diagnostics, OpenMode openMode) {
        this(databasePath, diagnostics, openMode, defaultOwnershipRoot(databasePath));
    }

    public SqliteDatabase(
            Path databasePath,
            Diagnostics diagnostics,
            OpenMode openMode,
            Path ownershipRoot
    ) {
        this(databasePath, diagnostics, openMode, ownershipRoot, SqliteDatabase::moveReplacing);
    }

    SqliteDatabase(Path databasePath, Diagnostics diagnostics, FileMover fileMover) {
        this(
                databasePath,
                diagnostics,
                OpenMode.CREATE_OR_OPEN,
                defaultOwnershipRoot(databasePath),
                fileMover);
    }

    private SqliteDatabase(
            Path databasePath,
            Diagnostics diagnostics,
            OpenMode openMode,
            Path ownershipRoot,
            FileMover fileMover
    ) {
        this.databasePath = Objects.requireNonNull(databasePath, "databasePath").toAbsolutePath().normalize();
        this.diagnostics = Objects.requireNonNull(diagnostics, "diagnostics");
        this.openMode = Objects.requireNonNull(openMode, "openMode");
        this.ownershipRoot = Objects.requireNonNull(ownershipRoot, "ownershipRoot")
                .toAbsolutePath().normalize();
        this.fileMover = Objects.requireNonNull(fileMover, "fileMover");
    }

    public static SqliteDatabase defaultDatabase(String fileName, Diagnostics diagnostics) {
        return new SqliteDatabase(resolveDatabasePath(fileName), diagnostics);
    }

    public static Path resolveDatabasePath(String fileName) {
        return resolveDatabasePath(fileName, System.getenv("XDG_DATA_HOME"), System.getProperty("user.home"));
    }

    /**
     * Creates a coherent, restore-tested, owner-only copy of an existing SQLite database without
     * running platform or feature migrations against the source.
     */
    public static void createVerifiedSnapshot(Path source, Path target) throws SQLException {
        Path safeSource = Objects.requireNonNull(source, "source").toAbsolutePath().normalize();
        Path safeTarget = Objects.requireNonNull(target, "target").toAbsolutePath().normalize();
        Path temporarySnapshot = null;
        boolean targetCreated = false;
        boolean completed = false;
        try {
            if (!Files.isRegularFile(safeSource) || Files.size(safeSource) == 0L) {
                throw new SQLException("SQLite snapshot source is missing or empty.");
            }
            Path realSource = safeSource.toRealPath();
            if (realSource.equals(safeTarget) || Files.exists(safeTarget)) {
                throw new SQLException("SQLite snapshot target must be a new file.");
            }
            Path parent = safeTarget.getParent();
            if (parent == null) {
                throw new SQLException("SQLite snapshot target must have a parent directory.");
            }
            Files.createDirectories(parent);
            Path temporaryDirectory = Files.createTempDirectory(parent, ".sqlite-snapshot-");
            temporarySnapshot = temporaryDirectory.resolve("snapshot.sqlite");

            loadDriver();
            vacuumInto(realSource, temporarySnapshot);
            assertIntegrity(temporarySnapshot);

            Path restoreProbe = temporaryDirectory.resolve("restore-probe.sqlite");
            Files.copy(temporarySnapshot, restoreProbe);
            assertIntegrity(restoreProbe);

            try {
                Files.move(temporarySnapshot, safeTarget, StandardCopyOption.ATOMIC_MOVE);
            } catch (AtomicMoveNotSupportedException ignored) {
                Files.move(temporarySnapshot, safeTarget);
            }
            targetCreated = true;
            Files.setPosixFilePermissions(
                    safeTarget, PosixFilePermissions.fromString("rw-------"));
            assertIntegrity(safeTarget);
            completed = true;
        } catch (IOException | UnsupportedOperationException exception) {
            throw new SQLException("Could not create verified SQLite snapshot.", exception);
        } finally {
            if (targetCreated && !completed) {
                deleteIfExists(safeTarget);
            }
            if (temporarySnapshot != null) {
                deletePreflightSnapshot(temporarySnapshot);
            }
        }
    }

    static Path resolveDatabasePath(String fileName, String xdgDataHome, String userHome) {
        String safeFileName = Objects.requireNonNull(fileName, "fileName");
        if (safeFileName.isBlank() || Path.of(safeFileName).getNameCount() != 1) {
            throw new IllegalArgumentException("database file name must be one path segment");
        }
        Path dataHome = xdgDataHome != null && !xdgDataHome.isBlank()
                ? Path.of(xdgDataHome)
                : Path.of(Objects.requireNonNull(userHome, "userHome"), ".local", "share");
        return dataHome.resolve(APP_DATA_DIR_NAME).resolve(safeFileName).toAbsolutePath().normalize();
    }

    public Path databasePath() {
        return databasePath;
    }

    /**
     * Captures an O(1) identity/size/high-resolution-time token when a drained runtime enters
     * PARKED ownership. No SQLite connection is opened, so this operation cannot create or alter
     * database or WAL/SHM state.
     */
    public synchronized void capturePreparedParkedState() throws SQLException {
        requireOpen();
        if (!prepared || !storesSealed) {
            throw new SQLException("SQLite lifecycle must be fully prepared before parked capture.");
        }
        parkedFileToken = captureQuiescentFileToken();
    }

    /**
     * Revalidates a fully prepared parked store before reuse. Under the local single-owner process
     * boundary, unchanged file identity, size, high-resolution modification time, and absent
     * sidecars inherit the integrity established at open. A detected change receives physical,
     * foreign-key, and every owner-schema check through an immutable read-only SQLite connection
     * before the new token is accepted. The return value is true only for unchanged bytes; a valid
     * change returns false so callers discard stale in-memory models and rebuild.
     */
    public synchronized boolean verifyPreparedParkedState() throws SQLException {
        requireOpen();
        if (!prepared || !storesSealed || parkedFileToken == null) {
            throw new SQLException("SQLite lifecycle has no captured parked state.");
        }
        DatabaseFileToken observed = captureQuiescentFileToken();
        if (parkedFileToken.equals(observed)) {
            return true;
        }
        try (Connection connection = openImmutableReadOnly(databasePath)) {
            assertConnectionIntegrity(connection);
            for (StoreHandle store : stores.values()) {
                if (store.readiness != FeatureStoreReadiness.READY) {
                    throw new FeatureStoreUnavailableException(store.readiness);
                }
                validateReadOnly(connection, store.definition.validator());
            }
        }
        DatabaseFileToken afterValidation = captureQuiescentFileToken();
        if (!observed.equals(afterValidation)) {
            throw new SQLException("Read-only parked validation changed the SQLite file family.");
        }
        parkedFileToken = afterValidation;
        return false;
    }

    /**
     * Creates and restore-tests a durable snapshot before an explicit maintenance operation.
     * Callers still own their feature transaction; this method only establishes a verified recovery
     * point for the complete database without exposing its local path.
     */
    private synchronized FeatureStoreBackup createVerifiedMaintenanceBackup(String owner) throws SQLException {
        String safeOwner = requireOwner(owner);
        prepare();
        if (!Files.isRegularFile(databasePath) || fileSize(databasePath) == 0L) {
            throw new SQLException("SQLite maintenance backup requires an initialized database.");
        }

        Path snapshot = null;
        Path restoreProbe = null;
        try {
            snapshot = createVacuumSnapshot(databasePath);
            assertIntegrity(snapshot);
            restoreProbe = snapshot.resolveSibling("restore-probe.db");
            Files.copy(snapshot, restoreProbe, StandardCopyOption.REPLACE_EXISTING);
            assertIntegrity(restoreProbe);

            Instant createdAt = Instant.now();
            Path target = sibling(databasePath.getFileName()
                    + ".maintenance-" + safeOwner + "-" + createdAt.toEpochMilli() + ".sqlite");
            replaceAtomically(snapshot, target);
            snapshot = null;
            assertIntegrity(target);
            return new FeatureStoreBackup(safeOwner, createdAt);
        } catch (IOException exception) {
            throw new SQLException("Could not create SQLite maintenance backup.", exception);
        } finally {
            if (snapshot != null) {
                deletePreflightSnapshot(snapshot);
            } else if (restoreProbe != null) {
                deletePreflightSnapshot(restoreProbe);
            }
        }
    }

    /**
     * Registers an immutable feature-store definition and returns its owner-bound handle.
     * Registration is complete before production storage preparation begins.
     */
    public synchronized FeatureStoreHandle featureStore(FeatureStoreDefinition definition) {
        FeatureStoreDefinition safeDefinition = Objects.requireNonNull(definition, "definition");
        StoreHandle existing = stores.get(safeDefinition.owner());
        if (existing != null) {
            throw new IllegalArgumentException("migration owner is already registered");
        }
        if (storesSealed) {
            throw new IllegalStateException("feature stores are already prepared");
        }
        StoreHandle registered = new StoreHandle(safeDefinition);
        stores.put(safeDefinition.owner(), registered);
        return registered;
    }

    /**
     * Grants the explicit maintenance capability for a handle registered by this lifecycle. Normal
     * feature composition receives only the connection handle.
     */
    public synchronized FeatureStoreMaintenance maintenanceFor(FeatureStoreHandle handle) {
        FeatureStoreHandle safeHandle = Objects.requireNonNull(handle, "handle");
        StoreHandle registered = stores.get(safeHandle.owner());
        if (registered == null || registered != safeHandle) {
            throw new IllegalArgumentException(
                    "feature store handle is not registered by this lifecycle");
        }
        return registered.maintenance;
    }

    /**
     * Seals registration and prepares every owner independently. A failed or newer owner does not
     * prevent another owner from becoming ready.
     */
    public synchronized Map<String, FeatureStoreReadiness> prepareRegisteredStores() {
        storesSealed = true;
        try {
            prepare();
        } catch (NewerPlatformSchemaException exception) {
            markAllStores(FeatureStoreReadiness.NEWER_SCHEMA);
            return readinessSnapshot();
        } catch (DatabaseFamilyIncompatibleException exception) {
            markAllStores(FeatureStoreReadiness.INCOMPATIBLE);
            return readinessSnapshot();
        } catch (SQLException exception) {
            markAllStores(FeatureStoreReadiness.CORRUPT);
            return readinessSnapshot();
        }
        Connection preparationConnection = null;
        try {
            for (StoreHandle store : stores.values()) {
                if (qualifiedSourceMigrations.remove(store.definition.owner())) {
                    preparationConnection = applyQualifiedSourceMigration(
                            preparationConnection, store);
                } else {
                    preparationConnection = prepareStore(preparationConnection, store);
                }
            }
        } finally {
            closePreparationConnection(preparationConnection, null);
            qualifiedSourceMigrations.clear();
        }
        return readinessSnapshot();
    }

    public synchronized void prepare() throws SQLException {
        requireOpen();
        if (prepared) {
            return;
        }
        loadDriver();
        if (openMode == OpenMode.EXISTING_ONLY) {
            assertExistingOnlyCandidatePath();
            prepareExistingDatabase(false);
        } else if (openMode == OpenMode.RESERVED_NEW) {
            assertReservedNewCandidate();
        } else {
            createParentDirectory();
            if (Files.isRegularFile(databasePath) && fileSize(databasePath) > 0L) {
                prepareExistingDatabase(true);
            }
        }
        prepared = true;
    }

    /**
     * Proves that the prepared lifecycle can acquire a write transaction without changing feature
     * data, identities, or revisions. The probe table and row exist only inside a rolled-back
     * transaction; a second read verifies that no schema artifact survived.
     */
    public synchronized void verifyTransactionalWriteRollback() throws SQLException {
        requireOpen();
        if (!prepared || !storesSealed) {
            throw new SQLException("SQLite lifecycle must be fully prepared before write verification.");
        }
        try (Connection connection = openConfigured(databasePath)) {
            connection.setAutoCommit(false);
            try (Statement statement = connection.createStatement()) {
                statement.execute("CREATE TABLE sm_runtime_write_probe (probe_value INTEGER NOT NULL)");
                if (statement.executeUpdate(
                        "INSERT INTO sm_runtime_write_probe(probe_value) VALUES (1)") != 1) {
                    throw new SQLException("SQLite write probe did not insert exactly one transactional row.");
                }
                try (ResultSet result = statement.executeQuery(
                        "SELECT probe_value FROM sm_runtime_write_probe")) {
                    if (!result.next() || result.getInt(1) != 1 || result.next()) {
                        throw new SQLException("SQLite write probe readback was not exact.");
                    }
                }
            } finally {
                connection.rollback();
            }
        }
        try (Connection verification = openConfigured(databasePath);
                var statement = verification.prepareStatement(
                        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?")) {
            statement.setString(1, "sm_runtime_write_probe");
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next() || result.getInt(1) != 0) {
                    throw new SQLException("SQLite write probe rollback left a schema artifact.");
                }
            }
        }
    }

    @Override
    public synchronized void close() {
        closed = true;
    }

    private Connection openConnection(StoreHandle store) throws SQLException {
        Connection connection = null;
        try {
            synchronized (this) {
                requireOpen();
                if (store.readiness == null) {
                    throw new FeatureStoreNotPreparedException();
                }
                if (store.readiness != FeatureStoreReadiness.READY) {
                    throw new FeatureStoreUnavailableException(store.readiness);
                }
                connection = openConfigured(databasePath);
            }
            return connection;
        } catch (SQLException | RuntimeException exception) {
            if (connection != null) {
                connection.close();
            }
            if (exception instanceof SQLException sqlException) {
                throw sqlException;
            }
            throw exception;
        }
    }

    private void prepareExistingDatabase(boolean recoveryAllowed) throws SQLException {
        Path inspection = databasePath;
        Path snapshot = null;
        Path qualification = null;
        try {
            try {
                assertCompatibleSourceFamilyShape();
                assertSQLiteHeader(databasePath);
                inspection = createPreflightInspection();
                assertImmutablePhysicalIntegrity(inspection);
            } catch (DatabaseFamilyIncompatibleException exception) {
                diagnostics.failure(FAMILY_INCOMPATIBLE, exception.getClass());
                throw exception;
            } catch (SQLException exception) {
                diagnostics.failure(INTEGRITY_FAILURE, exception.getClass());
                if (recoveryAllowed) {
                    recoverFromLatestBackup(exception);
                    prepareExistingDatabase(false);
                    return;
                }
                throw exception;
            }
            int version = immutablePlatformVersion(inspection);
            if (version > PLATFORM_SCHEMA_VERSION) {
                throw new NewerPlatformSchemaException();
            }
            try {
                assertImmutableForeignKeys(inspection);
                if (!hasPendingMigration(inspection, version)) {
                    qualifyCurrentStoresReadOnly(inspection);
                    return;
                }
                snapshot = createOwnerQualificationSnapshot(inspection);
                assertPhysicalIntegrity(snapshot);
                assertForeignKeys(snapshot);
                restoreTest(snapshot);
                qualification = snapshot.resolveSibling("owner-qualification.db");
                Files.copy(snapshot, qualification);
                qualifyPendingStoresOnCopy(qualification);
            } catch (SQLException exception) {
                diagnostics.failure(INTEGRITY_FAILURE, exception.getClass());
                throw exception;
            } catch (IOException exception) {
                diagnostics.failure(INTEGRITY_FAILURE, exception.getClass());
                throw new SQLException("Could not create SQLite owner-qualification copy.", exception);
            } finally {
                if (qualification != null) {
                    deleteIfExists(qualification);
                    deleteIfExists(walPath(qualification));
                    deleteIfExists(shmPath(qualification));
                    deleteIfExists(journalPath(qualification));
                }
            }
            if (qualifiedSourceMigrations.isEmpty()) {
                return;
            }
            promoteVerifiedBackup(version, snapshot);
            snapshot = null;
        } finally {
            if (snapshot != null) {
                deletePreflightSnapshot(snapshot);
            }
            if (!inspection.equals(databasePath)) {
                deletePreflightSnapshot(inspection);
            }
        }
    }

    private boolean hasPendingMigration(Path inspection, int platformVersion) throws SQLException {
        try (Connection connection = openImmutableReadOnly(inspection)) {
            if (platformSchemaUninitialized(connection, platformVersion)) {
                return true;
            }
            requireCurrentPlatformSchema(connection, platformVersion);
            for (StoreHandle store : stores.values()) {
                int storedVersion = storedFeatureVersion(connection, store.definition.owner());
                if (storedVersion < store.definition.supportedVersion()) {
                    return true;
                }
            }
            return false;
        }
    }

    private void qualifyCurrentStoresReadOnly(Path inspection) throws SQLException {
        try (Connection connection = openImmutableReadOnly(inspection)) {
            int version = pragmaInt(connection, "PRAGMA user_version");
            requireCurrentPlatformSchema(connection, version);
            for (StoreHandle store : stores.values()) {
                int storedVersion = storedFeatureVersion(connection, store.definition.owner());
                if (storedVersion > store.definition.supportedVersion()) {
                    store.readiness = FeatureStoreReadiness.NEWER_SCHEMA;
                    continue;
                }
                try {
                    validateReadOnly(connection, store.definition.validator());
                    store.readiness = FeatureStoreReadiness.READY;
                } catch (SQLException | RuntimeException failure) {
                    store.readiness = FeatureStoreReadiness.MIGRATION_FAILED;
                    diagnostics.failure(MIGRATION_FAILURE, failure.getClass());
                }
            }
        }
    }

    private void qualifyPendingStoresOnCopy(Path qualification) throws SQLException {
        Map<String, Integer> sourceVersions = new LinkedHashMap<>();
        boolean platformInitializationPending;
        try (Connection inspection = openImmutableReadOnly(qualification)) {
            int platformVersion = pragmaInt(inspection, "PRAGMA user_version");
            platformInitializationPending = platformSchemaUninitialized(
                    inspection, platformVersion);
            if (!platformInitializationPending) {
                requireCurrentPlatformSchema(inspection, platformVersion);
                for (StoreHandle store : stores.values()) {
                    sourceVersions.put(
                            store.definition.owner(),
                            storedFeatureVersion(inspection, store.definition.owner()));
                }
            } else {
                stores.keySet().forEach(owner -> sourceVersions.put(owner, 0));
            }
        }

        Connection qualificationConnection = null;
        try {
            for (StoreHandle store : stores.values()) {
                qualificationConnection = prepareStoreAt(
                        qualificationConnection, store, qualification);
                if (store.readiness == FeatureStoreReadiness.READY
                        && sourceVersions.get(store.definition.owner())
                                < store.definition.supportedVersion()) {
                    qualifiedSourceMigrations.add(store.definition.owner());
                }
            }
        } finally {
            closePreparationConnection(qualificationConnection, null);
        }

        if (platformInitializationPending && qualifiedSourceMigrations.isEmpty()) {
            stores.values().stream()
                    .filter(store -> store.readiness == FeatureStoreReadiness.READY)
                    .findFirst()
                    .ifPresent(store -> qualifiedSourceMigrations.add(store.definition.owner()));
        }
    }

    private static boolean platformSchemaUninitialized(
            Connection connection,
            int platformVersion
    ) throws SQLException {
        if (platformVersion != 0 || hasPlatformMetadata(connection)) {
            return false;
        }
        try (Statement statement = connection.createStatement();
             ResultSet objects = statement.executeQuery(
                     "SELECT 1 FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' LIMIT 1")) {
            if (objects.next()) {
                throw new SQLException(
                        "SQLite platform schema is missing from a nonempty database.");
            }
        }
        return true;
    }

    private static void requireCurrentPlatformSchema(
            Connection connection,
            int platformVersion
    ) throws SQLException {
        if (platformVersion > PLATFORM_SCHEMA_VERSION) {
            throw new NewerPlatformSchemaException();
        }
        if (platformVersion != PLATFORM_SCHEMA_VERSION || !hasPlatformMetadata(connection)) {
            throw new SQLException("SQLite platform schema is not the current direct format.");
        }
        PLATFORM_SCHEMA.validate(connection);
    }

    private static boolean hasPlatformMetadata(Connection connection) throws SQLException {
        try (var statement = connection.prepareStatement(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")) {
            statement.setString(1, MIGRATIONS_TABLE);
            try (ResultSet result = statement.executeQuery()) {
                return result.next();
            }
        }
    }

    private Connection prepareStore(Connection reusableConnection, StoreHandle store) {
        return prepareStoreAt(reusableConnection, store, databasePath);
    }

    private Connection prepareStoreAt(
            Connection reusableConnection,
            StoreHandle store,
            Path path
    ) {
        if (store.readiness != null) {
            return reusableConnection;
        }
        Connection connection = reusableConnection;
        try {
            if (connection == null) {
                connection = openConfigured(path);
            }
            migrate(connection, store.definition);
            store.readiness = FeatureStoreReadiness.READY;
            return connection;
        } catch (NewerFeatureSchemaException | NewerPlatformSchemaException exception) {
            store.readiness = FeatureStoreReadiness.NEWER_SCHEMA;
            closePreparationConnection(connection, exception);
            return null;
        } catch (SQLException | RuntimeException exception) {
            store.readiness = FeatureStoreReadiness.MIGRATION_FAILED;
            diagnostics.failure(MIGRATION_FAILURE, exception.getClass());
            closePreparationConnection(connection, exception);
            return null;
        } catch (Error failure) {
            closePreparationConnection(connection, failure);
            throw failure;
        }
    }

    private Connection applyQualifiedSourceMigration(
            Connection reusableConnection,
            StoreHandle store
    ) {
        Connection connection = reusableConnection;
        try {
            if (connection == null) {
                connection = openConfigured(databasePath);
            }
            migrate(connection, store.definition);
            store.readiness = FeatureStoreReadiness.READY;
            return connection;
        } catch (NewerFeatureSchemaException | NewerPlatformSchemaException exception) {
            store.readiness = FeatureStoreReadiness.NEWER_SCHEMA;
            closePreparationConnection(connection, exception);
            return null;
        } catch (SQLException | RuntimeException exception) {
            store.readiness = FeatureStoreReadiness.MIGRATION_FAILED;
            diagnostics.failure(MIGRATION_FAILURE, exception.getClass());
            closePreparationConnection(connection, exception);
            return null;
        } catch (Error failure) {
            closePreparationConnection(connection, failure);
            throw failure;
        }
    }

    private void closePreparationConnection(Connection connection, Throwable ownerFailure) {
        if (connection == null) {
            return;
        }
        try {
            connection.close();
        } catch (SQLException closeFailure) {
            if (ownerFailure != null && ownerFailure != closeFailure) {
                ownerFailure.addSuppressed(closeFailure);
            }
            diagnostics.failure(MIGRATION_FAILURE, closeFailure.getClass());
        }
    }

    private void migrate(Connection connection, FeatureStoreDefinition definition) throws SQLException {
        boolean previousAutoCommit = connection.getAutoCommit();
        connection.setAutoCommit(false);
        try {
            boolean changedSchema = ensurePlatformMetadata(connection);
            int storedVersion = storedFeatureVersion(connection, definition.owner());
            if (storedVersion > definition.supportedVersion()) {
                throw new NewerFeatureSchemaException();
            }
            for (SqliteMigration migration : definition.migrations()) {
                if (migration.version() > storedVersion) {
                    migration.action().apply(connection);
                    storeFeatureVersion(connection, definition.owner(), migration.version());
                    changedSchema = true;
                }
            }
            validateReadOnly(connection, definition.validator());
            if (changedSchema) {
                assertConnectionIntegrity(connection);
            }
            connection.commit();
        } catch (SQLException | RuntimeException exception) {
            rollback(connection, exception);
            if (exception instanceof SQLException sqlException) {
                throw sqlException;
            }
            throw new SQLException("SQLite migration failed.", exception);
        } finally {
            connection.setAutoCommit(previousAutoCommit);
        }
    }

    private boolean ensurePlatformMetadata(Connection connection) throws SQLException {
        int version = pragmaInt(connection, "PRAGMA user_version");
        if (version > PLATFORM_SCHEMA_VERSION) {
            throw new NewerPlatformSchemaException();
        }
        if (!platformSchemaUninitialized(connection, version)) {
            requireCurrentPlatformSchema(connection, version);
            return false;
        }
        try (Statement statement = connection.createStatement()) {
            statement.execute(CREATE_MIGRATIONS_TABLE_SQL);
            statement.execute("PRAGMA user_version = " + PLATFORM_SCHEMA_VERSION);
        }
        requireCurrentPlatformSchema(connection, PLATFORM_SCHEMA_VERSION);
        return true;
    }

    private static void validateReadOnly(
            Connection connection,
            FeatureStoreDefinition.Validator validator
    ) throws SQLException {
        setQueryOnly(connection, true);
        try {
            validator.validate(connection);
        } catch (SQLException failure) {
            resetQueryOnlyAfterFailure(connection, failure);
            throw failure;
        } catch (RuntimeException | Error failure) {
            resetQueryOnlyAfterFailure(connection, failure);
            throw failure;
        }
        setQueryOnly(connection, false);
    }

    private static void resetQueryOnlyAfterFailure(Connection connection, Throwable failure) {
        try {
            setQueryOnly(connection, false);
        } catch (SQLException resetFailure) {
            failure.addSuppressed(resetFailure);
        }
    }

    private static void setQueryOnly(Connection connection, boolean queryOnly) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA query_only = " + (queryOnly ? "ON" : "OFF"));
        }
    }

    private static int storedFeatureVersion(Connection connection, String owner) throws SQLException {
        try (var statement = connection.prepareStatement(
                "SELECT version FROM " + MIGRATIONS_TABLE + " WHERE owner=?")) {
            statement.setString(1, owner);
            try (ResultSet result = statement.executeQuery()) {
                return result.next() ? result.getInt(1) : 0;
            }
        }
    }

    private static void storeFeatureVersion(Connection connection, String owner, int version) throws SQLException {
        try (var statement = connection.prepareStatement(
                "INSERT INTO " + MIGRATIONS_TABLE + "(owner, version) VALUES(?, ?) "
                        + "ON CONFLICT(owner) DO UPDATE SET version=excluded.version")) {
            statement.setString(1, owner);
            statement.setInt(2, version);
            statement.executeUpdate();
        }
    }

    private void promoteVerifiedBackup(int version, Path snapshot) throws SQLException {
        Path target = backupPath(version);
        replaceAtomically(snapshot, target);
        deletePreflightSnapshot(snapshot);
    }

    private void recoverFromLatestBackup(SQLException originalFailure) throws SQLException {
        Path recovered = sibling(databasePath.getFileName() + ".recovery.tmp");
        Path backup = latestValidBackup(recovered);
        if (backup == null) {
            diagnostics.failure(RECOVERY_FAILURE, originalFailure.getClass());
            throw originalFailure;
        }
        try {
            validateQualifiedRecoveryCandidateReadOnly(recovered);
            Path quarantine = quarantinePath();
            moveDatabaseFamilyToQuarantine(quarantine);
            try {
                replaceAtomically(recovered, databasePath);
                validateQualifiedRecoveryCandidateReadOnly(databasePath);
            } catch (SQLException | RuntimeException exception) {
                restoreQuarantinedPrimary(quarantine);
                throw exception;
            }
        } catch (IOException | SQLException exception) {
            diagnostics.failure(RECOVERY_FAILURE, exception.getClass());
            if (exception instanceof SQLException sqlException) {
                throw sqlException;
            }
            throw new SQLException("SQLite recovery failed.", exception);
        } finally {
            deleteRecoveryCandidate(recovered);
        }
    }

    /**
     * Selects the newest backup that becomes fully ready on a disposable copy. Physical validity
     * and a matching {@code user_version} are insufficient: the exact platform ledger and every
     * registered owner schema must qualify before recovery may move the primary family.
     */
    private Path latestValidBackup(Path recovered) throws SQLException {
        List<Path> candidates = new ArrayList<>();
        Path parent = databasePath.getParent();
        if (parent == null || !Files.isDirectory(parent)) {
            return null;
        }
        String prefix = databasePath.getFileName() + ".backup-v";
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(parent, prefix + "*.sqlite")) {
            for (Path candidate : stream) {
                Matcher matcher = BACKUP_VERSION_PATTERN.matcher(candidate.getFileName().toString());
                if (matcher.matches() && Integer.parseInt(matcher.group(1)) <= PLATFORM_SCHEMA_VERSION) {
                    candidates.add(candidate);
                }
            }
        } catch (IOException exception) {
            throw new SQLException("Could not inspect SQLite backups.", exception);
        }
        candidates.sort(Comparator.comparingInt(SqliteDatabase::backupVersion).reversed());
        for (Path candidate : candidates) {
            boolean qualified = false;
            try {
                assertImmutableIntegrity(candidate);
                int namedVersion = backupVersion(candidate);
                int storedVersion = immutablePlatformVersion(candidate);
                if (storedVersion == namedVersion && storedVersion <= PLATFORM_SCHEMA_VERSION) {
                    deleteRecoveryCandidate(recovered);
                    requireRecoveryCandidateAbsent(recovered);
                    Files.copy(candidate, recovered, StandardCopyOption.REPLACE_EXISTING);
                    qualifyRecoveryCandidate(recovered);
                    qualified = true;
                    return candidate;
                }
            } catch (IOException | SQLException | RuntimeException ignored) {
                // Try the next older local backup; diagnostics remain payload-free at the caller
                // boundary.
            } finally {
                if (!qualified) {
                    deleteRecoveryCandidate(recovered);
                }
            }
        }
        return null;
    }

    private void qualifyRecoveryCandidate(Path candidate) throws SQLException {
        assertImmutableIntegrity(candidate);
        try (Connection inspection = openImmutableReadOnly(candidate)) {
            int platformVersion = pragmaInt(inspection, "PRAGMA user_version");
            requireCurrentPlatformSchema(inspection, platformVersion);
        }

        try (Connection qualification = openRecoveryQualification(candidate)) {
            for (StoreHandle store : stores.values()) {
                migrate(qualification, store.definition);
            }
        }
        if (Files.exists(walPath(candidate), LinkOption.NOFOLLOW_LINKS)
                || Files.exists(shmPath(candidate), LinkOption.NOFOLLOW_LINKS)
                || Files.exists(journalPath(candidate), LinkOption.NOFOLLOW_LINKS)) {
            throw new SQLException("Qualified SQLite recovery copy retained a live sidecar.");
        }
        validateQualifiedRecoveryCandidateReadOnly(candidate);
    }

    private void validateQualifiedRecoveryCandidateReadOnly(Path candidate) throws SQLException {
        try (Connection inspection = openImmutableReadOnly(candidate)) {
            assertConnectionIntegrity(inspection);
            int platformVersion = pragmaInt(inspection, "PRAGMA user_version");
            requireCurrentPlatformSchema(inspection, platformVersion);
            for (StoreHandle store : stores.values()) {
                int storedVersion = storedFeatureVersion(
                        inspection, store.definition.owner());
                if (storedVersion != store.definition.supportedVersion()) {
                    throw new SQLException("SQLite recovery owner is not at its current schema.");
                }
                validateReadOnly(inspection, store.definition.validator());
            }
        }
    }

    private static Connection openRecoveryQualification(Path candidate) throws SQLException {
        Connection connection = DriverManager.getConnection(
                "jdbc:sqlite:" + candidate.toAbsolutePath().normalize());
        try (Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys = ON");
            statement.execute("PRAGMA busy_timeout = " + BUSY_TIMEOUT_MILLIS);
            try (ResultSet mode = statement.executeQuery("PRAGMA journal_mode = DELETE")) {
                if (!mode.next() || !"delete".equalsIgnoreCase(mode.getString(1))) {
                    throw new SQLException("SQLite recovery qualification requires DELETE journaling.");
                }
            }
            statement.execute("PRAGMA synchronous = FULL");
            return connection;
        } catch (SQLException failure) {
            connection.close();
            throw failure;
        }
    }

    private static void deleteRecoveryCandidate(Path candidate) {
        deleteIfExists(candidate);
        deleteIfExists(walPath(candidate));
        deleteIfExists(shmPath(candidate));
        deleteIfExists(journalPath(candidate));
    }

    private static void requireRecoveryCandidateAbsent(Path candidate) throws IOException {
        if (Files.exists(candidate, LinkOption.NOFOLLOW_LINKS)
                || Files.exists(walPath(candidate), LinkOption.NOFOLLOW_LINKS)
                || Files.exists(shmPath(candidate), LinkOption.NOFOLLOW_LINKS)
                || Files.exists(journalPath(candidate), LinkOption.NOFOLLOW_LINKS)) {
            throw new IOException("SQLite recovery workspace could not be cleared.");
        }
    }

    private static int backupVersion(Path path) {
        Matcher matcher = BACKUP_VERSION_PATTERN.matcher(path.getFileName().toString());
        return matcher.matches() ? Integer.parseInt(matcher.group(1)) : -1;
    }

    private void moveDatabaseFamilyToQuarantine(Path quarantine) throws IOException {
        moveTransaction(List.of(
                new FileMove(databasePath, quarantine),
                new FileMove(walPath(databasePath), sibling(quarantine.getFileName() + "-wal")),
                new FileMove(shmPath(databasePath), sibling(quarantine.getFileName() + "-shm")),
                new FileMove(journalPath(databasePath), sibling(quarantine.getFileName() + "-journal"))));
    }

    private void restoreQuarantinedPrimary(Path quarantine) throws IOException {
        Path failedRecovery = sibling(databasePath.getFileName() + ".recovery-failed.tmp");
        deleteRequiredIfExists(failedRecovery);
        moveTransaction(List.of(
                new FileMove(databasePath, failedRecovery),
                new FileMove(quarantine, databasePath),
                new FileMove(sibling(quarantine.getFileName() + "-wal"), walPath(databasePath)),
                new FileMove(sibling(quarantine.getFileName() + "-shm"), shmPath(databasePath)),
                new FileMove(sibling(quarantine.getFileName() + "-journal"), journalPath(databasePath))));
        deleteRequiredIfExists(failedRecovery);
    }

    private void moveTransaction(List<FileMove> moves) throws IOException {
        List<FileMove> completed = new ArrayList<>();
        try {
            for (FileMove move : moves) {
                if (Files.exists(move.source())) {
                    if (Files.exists(move.target())) {
                        throw new IOException("SQLite move target already exists.");
                    }
                    fileMover.move(move.source(), move.target());
                    completed.add(move);
                }
            }
        } catch (IOException failure) {
            for (int index = completed.size() - 1; index >= 0; index--) {
                FileMove move = completed.get(index);
                try {
                    fileMover.move(move.target(), move.source());
                } catch (IOException rollbackFailure) {
                    failure.addSuppressed(rollbackFailure);
                }
            }
            throw failure;
        }
    }

    private static void assertIntegrity(Path path) throws SQLException {
        assertPhysicalIntegrity(path);
        assertForeignKeys(path);
    }

    private static void assertImmutableIntegrity(Path path) throws SQLException {
        assertImmutablePhysicalIntegrity(path);
        assertImmutableForeignKeys(path);
    }

    private static void assertPhysicalIntegrity(Path path) throws SQLException {
        if (!Files.isRegularFile(path) || fileSize(path) == 0L) {
            throw new SQLException("SQLite file is missing or empty.");
        }
        try (Connection connection = openReadOnly(path)) {
            assertConnectionPhysicalIntegrity(connection);
        }
    }

    private static void assertImmutablePhysicalIntegrity(Path path) throws SQLException {
        if (!Files.isRegularFile(path) || fileSize(path) == 0L) {
            throw new SQLException("SQLite file is missing or empty.");
        }
        try (Connection connection = openImmutableReadOnly(path)) {
            assertConnectionPhysicalIntegrity(connection);
        }
    }

    private static void assertForeignKeys(Path path) throws SQLException {
        try (Connection connection = openReadOnly(path)) {
            assertConnectionForeignKeys(connection);
        }
    }

    private static void assertImmutableForeignKeys(Path path) throws SQLException {
        try (Connection connection = openImmutableReadOnly(path)) {
            assertConnectionForeignKeys(connection);
        }
    }

    private void restoreTest(Path snapshot) throws SQLException {
        Path restoreProbe = snapshot.resolveSibling("restore-probe.db");
        try {
            Files.copy(snapshot, restoreProbe, StandardCopyOption.REPLACE_EXISTING);
            assertPhysicalIntegrity(restoreProbe);
            assertForeignKeys(restoreProbe);
        } catch (IOException exception) {
            throw new SQLException("Could not restore-test SQLite backup.", exception);
        } finally {
            deleteIfExists(restoreProbe);
        }
    }

    private static void assertConnectionIntegrity(Connection connection) throws SQLException {
        assertConnectionPhysicalIntegrity(connection);
        assertConnectionForeignKeys(connection);
    }

    private static void assertConnectionPhysicalIntegrity(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA integrity_check")) {
            if (!result.next() || !"ok".equalsIgnoreCase(result.getString(1)) || result.next()) {
                throw new SQLException("SQLite integrity check failed.");
            }
        }
    }

    private static void assertConnectionForeignKeys(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("PRAGMA foreign_key_check")) {
            if (result.next()) {
                throw new SQLException("SQLite foreign key check failed.");
            }
        }
    }

    private static int immutablePlatformVersion(Path path) throws SQLException {
        try (Connection connection = openImmutableReadOnly(path)) {
            return pragmaInt(connection, "PRAGMA user_version");
        }
    }

    private static Connection openReadOnly(Path path) throws SQLException {
        SQLiteConfig configuration = new SQLiteConfig();
        configuration.setReadOnly(true);
        configuration.setBusyTimeout(BUSY_TIMEOUT_MILLIS);
        return configuration.createConnection("jdbc:sqlite:" + path.toAbsolutePath().normalize());
    }

    private static Connection openImmutableReadOnly(Path path) throws SQLException {
        loadDriver();
        String sqliteUri = path.toAbsolutePath().normalize().toUri().toASCIIString();
        Connection connection = DriverManager.getConnection(
                "jdbc:sqlite:" + sqliteUri + "?mode=ro&immutable=1");
        try (Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA query_only = ON");
            statement.execute("PRAGMA foreign_keys = ON");
            statement.execute("PRAGMA busy_timeout = " + BUSY_TIMEOUT_MILLIS);
        } catch (SQLException failure) {
            connection.close();
            throw failure;
        }
        return connection;
    }

    private static Connection openConfigured(Path path) throws SQLException {
        Connection connection = DriverManager.getConnection("jdbc:sqlite:" + path.toAbsolutePath().normalize());
        try (Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys = ON");
            statement.execute("PRAGMA busy_timeout = " + BUSY_TIMEOUT_MILLIS);
            try (ResultSet mode = statement.executeQuery("PRAGMA journal_mode = WAL")) {
                if (!mode.next() || !"wal".equalsIgnoreCase(mode.getString(1))) {
                    throw new SQLException("SQLite WAL mode is unavailable.");
                }
            }
            statement.execute("PRAGMA synchronous = NORMAL");
        } catch (SQLException exception) {
            connection.close();
            throw exception;
        }
        return connection;
    }

    private DatabaseFileToken captureQuiescentFileToken() throws SQLException {
        if (!Files.isRegularFile(databasePath, LinkOption.NOFOLLOW_LINKS)) {
            throw new SQLException("Parked SQLite database is missing or not a physical file.");
        }
        requireAbsentParkedSidecar(walPath(databasePath));
        requireAbsentParkedSidecar(shmPath(databasePath));
        requireAbsentParkedSidecar(journalPath(databasePath));
        try {
            BasicFileAttributes attributes = Files.readAttributes(
                    databasePath, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS);
            return new DatabaseFileToken(
                    String.valueOf(attributes.fileKey()),
                    attributes.size(),
                    attributes.lastModifiedTime().toMillis(),
                    attributes.lastModifiedTime().toInstant().getNano(),
                    attributes.creationTime().toMillis());
        } catch (IOException failure) {
            throw new SQLException("Could not capture parked SQLite file token.", failure);
        }
    }

    private static void requireAbsentParkedSidecar(Path sidecar) throws SQLException {
        if (Files.exists(sidecar, LinkOption.NOFOLLOW_LINKS)) {
            throw new SQLException("Parked SQLite file family contains a live sidecar: "
                    + sidecar.getFileName());
        }
    }

    private static int pragmaInt(Connection connection, String pragma) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery(pragma)) {
            if (!result.next()) {
                throw new SQLException("SQLite pragma did not return a value.");
            }
            return result.getInt(1);
        }
    }

    private Path createPreflightInspection() throws SQLException {
        assertCompatibleSourceFamilyShape();
        Path journal = journalPath(databasePath);
        if (Files.exists(journal, LinkOption.NOFOLLOW_LINKS)) {
            return createRollbackJournalInspection();
        }
        if (Files.exists(walPath(databasePath), LinkOption.NOFOLLOW_LINKS)) {
            return createWalFamilyInspection();
        }
        return databasePath;
    }

    private void assertCompatibleSourceFamilyShape() throws SQLException {
        Path journal = journalPath(databasePath);
        Path wal = walPath(databasePath);
        Path shm = shmPath(databasePath);
        boolean journalExists = Files.exists(journal, LinkOption.NOFOLLOW_LINKS);
        boolean walExists = Files.exists(wal, LinkOption.NOFOLLOW_LINKS);
        boolean shmExists = Files.exists(shm, LinkOption.NOFOLLOW_LINKS);
        requirePhysicalSidecar(journal, journalExists);
        requirePhysicalSidecar(wal, walExists);
        requirePhysicalSidecar(shm, shmExists);
        if (journalExists && (walExists || shmExists)) {
            throw new DatabaseFamilyIncompatibleException(
                    "SQLite database contains incompatible journal families.");
        }
        if (walExists != shmExists) {
            throw new DatabaseFamilyIncompatibleException(
                    "SQLite WAL and shared-memory sidecars are incomplete.");
        }
        if (walExists && (fileSize(wal) <= 32L || fileSize(shm) == 0L)) {
            throw new DatabaseFamilyIncompatibleException(
                    "SQLite WAL family contains an incomplete sidecar.");
        }
    }

    private static void requirePhysicalSidecar(Path sidecar, boolean exists)
            throws DatabaseFamilyIncompatibleException {
        if (exists && (!Files.isRegularFile(sidecar, LinkOption.NOFOLLOW_LINKS)
                || Files.isSymbolicLink(sidecar))) {
            throw new DatabaseFamilyIncompatibleException(
                    "SQLite database contains a non-physical sidecar.");
        }
    }

    /**
     * Materializes a complete WAL family without ever opening the source through SQLite. SQLite
     * may create, update, checkpoint, or remove sidecars only inside the disposable directory.
     */
    private Path createWalFamilyInspection() throws SQLException {
        Path copied = null;
        try {
            DatabaseFamilyToken before = captureWalFamilyToken();
            Path directory = Files.createTempDirectory(
                    databasePath.getParent(), "." + databasePath.getFileName() + ".wal-preflight-");
            copied = directory.resolve("source.db");
            Files.copy(databasePath, copied);
            Files.copy(walPath(databasePath), walPath(copied));
            Files.copy(shmPath(databasePath), shmPath(copied));
            DatabaseFamilyToken after = captureWalFamilyToken();
            if (!before.equals(after)) {
                throw new DatabaseFamilyIncompatibleException(
                        "SQLite WAL family changed during isolated preflight copy.");
            }
            Path inspection = directory.resolve("inspection.db");
            vacuumInto(copied, inspection);
            assertImmutablePhysicalIntegrity(inspection);
            deleteIfExists(copied);
            deleteIfExists(walPath(copied));
            deleteIfExists(shmPath(copied));
            deleteIfExists(journalPath(copied));
            return inspection;
        } catch (IOException | SQLException failure) {
            if (copied != null) {
                deletePreflightSnapshot(copied);
            }
            if (failure instanceof DatabaseFamilyIncompatibleException incompatible) {
                throw incompatible;
            }
            throw new DatabaseFamilyIncompatibleException(
                    "Could not isolate the SQLite WAL family for preflight.", failure);
        }
    }

    private DatabaseFamilyToken captureWalFamilyToken()
            throws DatabaseFamilyIncompatibleException {
        return new DatabaseFamilyToken(
                capturePhysicalFileToken(databasePath),
                capturePhysicalFileToken(walPath(databasePath)),
                capturePhysicalFileToken(shmPath(databasePath)));
    }

    private static DatabaseFileToken capturePhysicalFileToken(Path path)
            throws DatabaseFamilyIncompatibleException {
        try {
            BasicFileAttributes attributes = Files.readAttributes(
                    path, BasicFileAttributes.class, LinkOption.NOFOLLOW_LINKS);
            if (!attributes.isRegularFile()) {
                throw new IOException("SQLite family member is not a regular file.");
            }
            return new DatabaseFileToken(
                    String.valueOf(attributes.fileKey()),
                    attributes.size(),
                    attributes.lastModifiedTime().toMillis(),
                    attributes.lastModifiedTime().toInstant().getNano(),
                    attributes.creationTime().toMillis());
        } catch (IOException failure) {
            throw new DatabaseFamilyIncompatibleException(
                    "Could not capture SQLite source-family identity.", failure);
        }
    }

    private Path createOwnerQualificationSnapshot(Path inspection) throws SQLException {
        if (!inspection.equals(databasePath)) {
            return createVacuumSnapshot(inspection);
        }
        DatabaseFileToken before = captureQuiescentFileToken();
        Path snapshot = null;
        try {
            Path directory = Files.createTempDirectory(
                    databasePath.getParent(), "." + databasePath.getFileName() + ".preflight-");
            snapshot = directory.resolve("snapshot.db");
            Files.copy(databasePath, snapshot);
            DatabaseFileToken after = captureQuiescentFileToken();
            if (!before.equals(after)) {
                throw new SQLException("SQLite source changed during sidecar-free qualification copy.");
            }
            return snapshot;
        } catch (IOException | SQLException failure) {
            if (snapshot != null) {
                deletePreflightSnapshot(snapshot);
            }
            if (failure instanceof SQLException sqlFailure) {
                throw sqlFailure;
            }
            throw new SQLException("Could not create sidecar-free SQLite qualification copy.", failure);
        }
    }

    private Path createRollbackJournalInspection() throws SQLException {
        Path recoveredCopy = null;
        try {
            Path directory = Files.createTempDirectory(
                    databasePath.getParent(), "." + databasePath.getFileName() + ".rollback-preflight-");
            recoveredCopy = directory.resolve("recovered.db");
            copyRollbackFamilyUnderLock(recoveredCopy);
            try (Connection connection = DriverManager.getConnection(
                    "jdbc:sqlite:" + recoveredCopy.toAbsolutePath().normalize())) {
                assertConnectionIntegrity(connection);
                pragmaInt(connection, "PRAGMA user_version");
            }
            return recoveredCopy;
        } catch (PreflightLockUnavailableException exception) {
            if (recoveredCopy != null) {
                deletePreflightSnapshot(recoveredCopy);
            }
            throw exception;
        } catch (IOException | SQLException exception) {
            if (recoveredCopy != null) {
                deletePreflightSnapshot(recoveredCopy);
            }
            if (exception instanceof SQLException sqlException) {
                throw sqlException;
            }
            throw new SQLException("Could not create SQLite rollback inspection.", exception);
        }
    }

    private void copyRollbackFamilyUnderLock(Path recoveredCopy)
            throws IOException, PreflightLockUnavailableException {
        try (FileChannel channel = FileChannel.open(
                databasePath, StandardOpenOption.READ, StandardOpenOption.WRITE)) {
            FileLock lock;
            try {
                lock = channel.tryLock();
            } catch (OverlappingFileLockException | IOException exception) {
                throw new PreflightLockUnavailableException(exception);
            }
            if (lock == null) {
                throw new PreflightLockUnavailableException(null);
            }
            try (lock) {
                Path journal = journalPath(databasePath);
                if (!Files.isRegularFile(journal)) {
                    throw new PreflightLockUnavailableException(null);
                }
                Files.copy(databasePath, recoveredCopy);
                Files.copy(journal, journalPath(recoveredCopy));
            }
        }
    }

    private Path createVacuumSnapshot(Path source) throws SQLException {
        Path snapshot = null;
        try {
            Path directory = Files.createTempDirectory(
                    databasePath.getParent(), "." + databasePath.getFileName() + ".preflight-");
            snapshot = directory.resolve("snapshot.db");
            vacuumInto(source, snapshot);
            return snapshot;
        } catch (IOException | SQLException exception) {
            if (snapshot != null) {
                deletePreflightSnapshot(snapshot);
            }
            if (exception instanceof SQLException sqlException) {
                throw sqlException;
            }
            throw new SQLException("Could not create SQLite preflight snapshot.", exception);
        }
    }

    private static void vacuumInto(Path source, Path target) throws SQLException {
        try (Connection connection = openReadOnly(source);
             Statement statement = connection.createStatement()) {
            statement.execute("VACUUM INTO '" + sqliteLiteral(target) + "'");
        }
    }

    private static void assertSQLiteHeader(Path path) throws SQLException {
        try (var input = Files.newInputStream(path)) {
            if (!Arrays.equals(SQLITE_HEADER, input.readNBytes(SQLITE_HEADER.length))) {
                throw new SQLException("SQLite header is invalid.");
            }
        } catch (IOException exception) {
            throw new SQLException("Could not inspect SQLite header.", exception);
        }
    }

    private void assertExistingOnlyCandidatePath() throws SQLException {
        assertPhysicalOwnershipPath();
        if (Files.isSymbolicLink(databasePath)
                || !Files.isRegularFile(databasePath, LinkOption.NOFOLLOW_LINKS)
                || fileSize(databasePath) == 0L) {
            throw new SQLException("Existing-only SQLite file is missing, empty, or symbolic.");
        }
    }

    private void assertReservedNewCandidate() throws SQLException {
        assertPhysicalOwnershipPath();
        if (Files.isSymbolicLink(databasePath)
                || !Files.isRegularFile(databasePath, LinkOption.NOFOLLOW_LINKS)
                || fileSize(databasePath) != 0L) {
            throw new SQLException("Reserved-new SQLite file is not an owned empty reservation.");
        }
    }

    private void assertPhysicalOwnershipPath() throws SQLException {
        if (!databasePath.startsWith(ownershipRoot)) {
            throw new SQLException("SQLite file escapes its physical ownership root.");
        }
        try {
            if (Files.isSymbolicLink(ownershipRoot)
                    || !Files.isDirectory(ownershipRoot, LinkOption.NOFOLLOW_LINKS)
                    || !ownershipRoot.toRealPath().equals(ownershipRoot)) {
                throw new IOException("SQLite ownership root is symbolic or non-physical.");
            }
            Path current = ownershipRoot;
            for (Path segment : ownershipRoot.relativize(databasePath)) {
                current = current.resolve(segment);
                if (Files.exists(current, LinkOption.NOFOLLOW_LINKS)
                        && Files.isSymbolicLink(current)) {
                    throw new IOException("SQLite ownership path contains a symbolic link.");
                }
            }
        } catch (IOException failure) {
            throw new SQLException("Could not validate physical SQLite ownership path.", failure);
        }
    }

    private static Path defaultOwnershipRoot(Path databasePath) {
        Path normalized = Objects.requireNonNull(databasePath, "databasePath")
                .toAbsolutePath().normalize();
        return normalized.getParent() == null ? normalized : normalized.getParent();
    }

    private static void deletePreflightSnapshot(Path snapshot) {
        Path directory = snapshot.getParent();
        if (directory == null) {
            return;
        }
        try (var files = Files.walk(directory)) {
            files.sorted(Comparator.reverseOrder()).forEach(SqliteDatabase::deleteIfExists);
        } catch (IOException ignored) {
            // The isolated snapshot never owns persisted application truth.
        }
    }

    private static void rollback(Connection connection, Throwable original) throws SQLException {
        try {
            connection.rollback();
        } catch (SQLException rollbackFailure) {
            original.addSuppressed(rollbackFailure);
            throw rollbackFailure;
        }
    }

    private void markAllStores(FeatureStoreReadiness readiness) {
        for (StoreHandle store : stores.values()) {
            store.readiness = readiness;
        }
    }

    private Map<String, FeatureStoreReadiness> readinessSnapshot() {
        Map<String, FeatureStoreReadiness> readiness = new LinkedHashMap<>();
        stores.forEach((owner, store) -> readiness.put(owner, store.readiness));
        return Map.copyOf(readiness);
    }

    private final class StoreHandle implements FeatureStoreHandle {

        private final FeatureStoreDefinition definition;
        private final StoreMaintenance maintenance = new StoreMaintenance(this);
        private volatile FeatureStoreReadiness readiness;

        private StoreHandle(FeatureStoreDefinition definition) {
            this.definition = definition;
        }

        @Override
        public String owner() {
            return definition.owner();
        }

        @Override
        public java.util.Optional<FeatureStoreReadiness> readiness() {
            return java.util.Optional.ofNullable(readiness);
        }

        @Override
        public Connection openConnection() throws SQLException {
            return SqliteDatabase.this.openConnection(this);
        }
    }

    private final class StoreMaintenance implements FeatureStoreMaintenance {

        private final StoreHandle store;

        private StoreMaintenance(StoreHandle store) {
            this.store = store;
        }

    @Override
    public String owner() {
      return store.owner();
    }

    @Override
    public Connection openConnection() throws SQLException {
      return SqliteDatabase.this.openConnection(store);
    }

        @Override
        public FeatureStoreBackup createVerifiedBackup() throws SQLException {
            synchronized (SqliteDatabase.this) {
                requireOpen();
                if (store.readiness == null) {
                    throw new FeatureStoreNotPreparedException();
                }
                if (store.readiness != FeatureStoreReadiness.READY) {
                    throw new FeatureStoreUnavailableException(store.readiness);
                }
            }
            return SqliteDatabase.this.createVerifiedMaintenanceBackup(owner());
        }
    }

    private static final class NewerFeatureSchemaException extends SQLException {
        private NewerFeatureSchemaException() {
            super("SQLite feature schema is newer than this application.");
        }
    }

    private static final class NewerPlatformSchemaException extends SQLException {
        private NewerPlatformSchemaException() {
            super("SQLite platform schema is newer than this application.");
        }
    }

    private static String requireOwner(String owner) {
        return FeatureStoreDefinition.of(owner).owner();
    }

    private void requireOpen() throws SQLException {
        if (closed) {
            throw new SQLException("SQLite database lifecycle is closed.");
        }
    }

    private static void loadDriver() throws SQLException {
        try {
            Class.forName("org.sqlite.JDBC");
        } catch (ClassNotFoundException exception) {
            throw new SQLException("SQLite JDBC driver not available.", exception);
        }
    }

    private void createParentDirectory() throws SQLException {
        try {
            Path parent = databasePath.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }
        } catch (IOException exception) {
            throw new SQLException("Could not prepare SQLite directory.", exception);
        }
    }

    private static long fileSize(Path path) throws SQLException {
        try {
            return Files.size(path);
        } catch (IOException exception) {
            throw new SQLException("Could not inspect SQLite file.", exception);
        }
    }

    private Path backupPath(int version) {
        return sibling(databasePath.getFileName() + ".backup-v" + version + ".sqlite");
    }

    private Path quarantinePath() {
        return sibling(databasePath.getFileName() + ".corrupt-" + Instant.now().toEpochMilli() + ".sqlite");
    }

    private Path sibling(Object fileName) {
        return databasePath.resolveSibling(String.valueOf(fileName));
    }

    private static Path walPath(Path path) {
        return path.resolveSibling(path.getFileName() + "-wal");
    }

    private static Path shmPath(Path path) {
        return path.resolveSibling(path.getFileName() + "-shm");
    }

    private static Path journalPath(Path path) {
        return path.resolveSibling(path.getFileName() + "-journal");
    }

    private static String sqliteLiteral(Path path) {
        return path.toAbsolutePath().normalize().toString().replace("'", "''");
    }

    private static void replaceAtomically(Path source, Path target) throws SQLException {
        try {
            try {
                Files.move(source, target,
                        StandardCopyOption.REPLACE_EXISTING,
                        StandardCopyOption.ATOMIC_MOVE);
            } catch (AtomicMoveNotSupportedException ignored) {
                Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException exception) {
            throw new SQLException("Could not replace SQLite file.", exception);
        }
    }

    private static void moveReplacing(Path source, Path target) throws IOException {
        try {
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException ignored) {
            Files.move(source, target);
        }
    }

    private static void deleteRequiredIfExists(Path path) throws IOException {
        Files.deleteIfExists(path);
    }

    private static void deleteIfExists(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // A later create/move operation reports the actionable failure without exposing the
            // path.
        }
    }

    @FunctionalInterface
    interface FileMover {
        void move(Path source, Path target) throws IOException;
    }

    private record DatabaseFileToken(
            String fileKey,
            long bytes,
            long modifiedMillis,
            int modifiedNanos,
            long createdMillis
    ) { }

    private record DatabaseFamilyToken(
            DatabaseFileToken primary,
            DatabaseFileToken wal,
            DatabaseFileToken shm
    ) { }

    private record FileMove(Path source, Path target) { }

    private static class DatabaseFamilyIncompatibleException extends SQLException {

        private DatabaseFamilyIncompatibleException(String message) {
            super(message);
        }

        private DatabaseFamilyIncompatibleException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    private static final class PreflightLockUnavailableException
            extends DatabaseFamilyIncompatibleException {

        private PreflightLockUnavailableException(Throwable cause) {
            super("SQLite preflight lock is unavailable.", cause);
        }
    }
}
