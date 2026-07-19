package features.dungeon.adapter.sqlite.gateway;

import features.dungeon.adapter.sqlite.mapper.DungeonWindowEntityMapper;
import features.dungeon.adapter.sqlite.model.DungeonPersistenceSchema;
import features.dungeon.adapter.sqlite.model.DungeonWindowEntityRecord;
import features.dungeon.application.authored.command.DungeonPatchEntityRef;
import features.dungeon.application.authored.port.DungeonEntitySnapshot;
import features.dungeon.application.authored.port.DungeonIdentityClosureRequest;
import features.dungeon.application.authored.port.DungeonIdentityClosureResult;
import features.dungeon.application.authored.port.DungeonInboundReferenceRequest;
import features.dungeon.application.authored.port.DungeonInboundReferenceResult;
import features.dungeon.application.authored.port.DungeonMapHeader;
import features.dungeon.application.authored.port.DungeonTravelChunkKeysRequest;
import features.dungeon.application.authored.port.DungeonTravelChunkKeysResult;
import features.dungeon.application.authored.port.DungeonTravelStartRequest;
import features.dungeon.application.authored.port.DungeonTravelStartResult;
import features.dungeon.application.authored.port.DungeonWindow;
import features.dungeon.application.authored.port.DungeonWindowContentRequest;
import features.dungeon.application.authored.port.DungeonWindowIndex;
import features.dungeon.application.authored.port.DungeonWindowChunkHeader;
import features.dungeon.application.authored.port.DungeonWindowContinuation;
import features.dungeon.application.authored.port.DungeonWindowEntityFragment;
import features.dungeon.application.authored.port.DungeonWindowRequest;
import features.dungeon.application.authored.port.DungeonAuthoredLevelBounds;
import features.dungeon.application.authored.port.DungeonContinuationCursor;
import features.dungeon.application.authored.port.DungeonContinuationPage;
import features.dungeon.application.authored.port.DungeonContinuationPageRequest;
import features.dungeon.application.authored.port.DungeonEntityChunkExtent;
import features.dungeon.api.DungeonChunkKey;
import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import platform.diagnostics.NoopDiagnostics;
import platform.persistence.SqliteConnectionSource;
import platform.persistence.SqliteDatabase;
import platform.persistence.SqliteMigration;

/** SQLite implementation core for exact sparse reads; it never calls the full-map loader. */
public final class DungeonSqliteWindowGateway {

    private final DungeonSqliteConnectionSupport connectionSupport;
    private final AtomicInteger lastStatementCount = new AtomicInteger();
    private final AtomicInteger lastContinuationRowsRead = new AtomicInteger();
    private final AtomicReference<List<String>> lastStatementSql = new AtomicReference<>(List.of());
    private final Runnable afterHeaderRead;

    public DungeonSqliteWindowGateway() {
        this(SqliteDatabase.defaultDatabase(
                DungeonPersistenceSchema.DATABASE_FILE_NAME,
                NoopDiagnostics.INSTANCE));
    }

    public DungeonSqliteWindowGateway(SqliteDatabase database) {
        this(database, () -> { });
    }

    DungeonSqliteWindowGateway(SqliteDatabase database, Runnable afterHeaderRead) {
        DungeonSqliteSchemaManager schemaManager = new DungeonSqliteSchemaManager();
        SqliteConnectionSource connections = Objects.requireNonNull(database, "database").connections(
                "dungeon",
                new SqliteMigration(1, schemaManager::ensureSchema),
                new SqliteMigration(2, schemaManager::ensureSchema),
                new SqliteMigration(3, schemaManager::replaceWithCanonicalSchema),
                new SqliteMigration(4, schemaManager::addCorridorDoorLevel),
                new SqliteMigration(5, schemaManager::addCorridorRouteCellIndex),
                new SqliteMigration(6, schemaManager::addCorridorRouteDependencyIndex));
        connectionSupport = new DungeonSqliteConnectionSupport(connections);
        this.afterHeaderRead = Objects.requireNonNull(afterHeaderRead, "afterHeaderRead");
    }

    public Optional<DungeonWindowIndex> loadIndex(DungeonWindowRequest request) {
        DungeonWindowRequest safeRequest = Objects.requireNonNull(request, "request");
        DungeonSqliteQueryCounter queries = new DungeonSqliteQueryCounter();
        try (Connection connection = connectionSupport.openReadyConnection()) {
            return DungeonSqliteReadSnapshot.read(connection, () -> {
                Optional<DungeonMapHeader> header = loadMapHeader(
                        connection, safeRequest.mapId().value(), queries);
                if (header.isEmpty()) {
                    return Optional.empty();
                }
                afterHeaderRead.run();
                List<DungeonAuthoredLevelBounds> bounds = loadLevelBounds(
                        connection, safeRequest.mapId().value(), safeRequest.chunkKeys(), queries);
                DungeonContinuationPage page = loadContinuationPageSnapshot(
                        connection,
                        new DungeonContinuationPageRequest(
                                safeRequest.mapId(), header.get().revision(), safeRequest.requestGeneration(),
                                safeRequest.chunkKeys(), Optional.empty()),
                        queries);
                return Optional.of(new DungeonWindowIndex(
                        header.get(), safeRequest.requestGeneration(),
                        loadChunkHeaders(connection, safeRequest, queries), bounds, page));
            });
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load Dungeon window index from SQLite.", exception);
        } finally {
            lastStatementCount.set(queries.statements());
            lastStatementSql.set(queries.preparedSql());
        }
    }

    public Optional<DungeonWindow> loadContent(DungeonWindowContentRequest request) {
        DungeonWindowContentRequest safeRequest = Objects.requireNonNull(request, "request");
        DungeonSqliteQueryCounter queries = new DungeonSqliteQueryCounter();
        DungeonWindowRequest windowRequest = new DungeonWindowRequest(
                safeRequest.mapId(), safeRequest.requestGeneration(),
                safeRequest.chunks().stream().map(DungeonWindowChunkHeader::key).toList());
        try (Connection connection = connectionSupport.openReadyConnection()) {
            return DungeonSqliteReadSnapshot.read(connection, () -> {
                Optional<DungeonWindow> loaded = loadWindowSnapshot(connection, windowRequest, queries);
                if (loaded.isEmpty()
                        || loaded.get().mapHeader().revision() != safeRequest.expectedMapRevision()
                        || !loaded.get().chunkHeaders().equals(safeRequest.chunks())) {
                    return Optional.empty();
                }
                return loaded;
            });
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load Dungeon window content from SQLite.", exception);
        } finally {
            lastStatementCount.set(queries.statements());
            lastStatementSql.set(queries.preparedSql());
        }
    }

    public Optional<DungeonContinuationPage> loadContinuationPage(DungeonContinuationPageRequest request) {
        DungeonContinuationPageRequest safeRequest = Objects.requireNonNull(request, "request");
        DungeonSqliteQueryCounter queries = new DungeonSqliteQueryCounter();
        try (Connection connection = connectionSupport.openReadyConnection()) {
            return DungeonSqliteReadSnapshot.read(connection, () -> {
                Optional<DungeonMapHeader> header = loadMapHeader(
                        connection, safeRequest.mapId().value(), queries);
                if (header.isEmpty() || header.get().revision() != safeRequest.expectedMapRevision()) {
                    return Optional.empty();
                }
                afterHeaderRead.run();
                return Optional.of(loadContinuationPageSnapshot(connection, safeRequest, queries));
            });
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load Dungeon continuation page from SQLite.", exception);
        } finally {
            lastStatementCount.set(queries.statements());
            lastStatementSql.set(queries.preparedSql());
        }
    }

    /** Last sparse-read statement count, excluding connection setup and migrations. */
    public int lastStatementCount() {
        return lastStatementCount.get();
    }

    /** Last sparse-read SQL shapes for bounded-query diagnostics. */
    public List<String> lastStatementSql() {
        return lastStatementSql.get();
    }

    /** Rows consumed by the last continuation query, including its one-row lookahead. */
    public int lastContinuationRowsRead() {
        return lastContinuationRowsRead.get();
    }

    public DungeonIdentityClosureResult loadIdentityClosure(DungeonIdentityClosureRequest request) {
        DungeonIdentityClosureRequest safeRequest = Objects.requireNonNull(request, "request");
        DungeonSqliteQueryCounter queries = new DungeonSqliteQueryCounter();
        try (Connection connection = connectionSupport.openReadyConnection()) {
            return DungeonSqliteReadSnapshot.read(
                    connection,
                    () -> loadClosureSnapshot(connection, safeRequest, queries));
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load Dungeon identity closure from SQLite.", exception);
        } finally {
            lastStatementCount.set(queries.statements());
            lastStatementSql.set(queries.preparedSql());
        }
    }

    public DungeonInboundReferenceResult discoverInboundReferences(DungeonInboundReferenceRequest request) {
        DungeonInboundReferenceRequest safeRequest = Objects.requireNonNull(request, "request");
        DungeonSqliteQueryCounter queries = new DungeonSqliteQueryCounter();
        try (Connection connection = connectionSupport.openReadyConnection()) {
            return DungeonSqliteReadSnapshot.read(connection, () -> {
                Optional<DungeonMapHeader> header = loadMapHeader(
                        connection, safeRequest.mapId().value(), queries);
                if (header.isEmpty()) {
                    return new DungeonInboundReferenceResult.Rejected(
                            DungeonIdentityClosureResult.Reason.MAP_MISSING,
                            safeRequest.targetRefs());
                }
                if (header.get().revision() != safeRequest.expectedMapRevision()) {
                    return new DungeonInboundReferenceResult.Rejected(
                            DungeonIdentityClosureResult.Reason.STALE_REVISION,
                            safeRequest.targetRefs());
                }
                return new DungeonInboundReferenceResult.Complete(
                        header.get(),
                        DungeonSqliteInboundReferenceDiscovery.load(
                                connection,
                                safeRequest.mapId().value(),
                                safeRequest.targetRefs(),
                                queries));
            });
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to discover Dungeon inbound references from SQLite.", exception);
        } finally {
            lastStatementCount.set(queries.statements());
            lastStatementSql.set(queries.preparedSql());
        }
    }

    public DungeonTravelStartResult locateTravelStart(DungeonTravelStartRequest request) {
        DungeonTravelStartRequest safeRequest = Objects.requireNonNull(request, "request");
        DungeonSqliteQueryCounter queries = new DungeonSqliteQueryCounter();
        try (Connection connection = connectionSupport.openReadyConnection()) {
            return DungeonSqliteReadSnapshot.read(
                    connection,
                    () -> locateTravelStartSnapshot(connection, safeRequest, queries));
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to locate Dungeon Travel start from SQLite.", exception);
        } finally {
            lastStatementCount.set(queries.statements());
            lastStatementSql.set(queries.preparedSql());
        }
    }

    public DungeonTravelChunkKeysResult discoverTravelChunkKeys(DungeonTravelChunkKeysRequest request) {
        DungeonTravelChunkKeysRequest safeRequest = Objects.requireNonNull(request, "request");
        DungeonSqliteQueryCounter queries = new DungeonSqliteQueryCounter();
        try (Connection connection = connectionSupport.openReadyConnection()) {
            return DungeonSqliteReadSnapshot.read(
                    connection,
                    () -> discoverTravelChunkKeysSnapshot(connection, safeRequest, queries));
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to discover Dungeon Travel chunk keys from SQLite.", exception);
        } finally {
            lastStatementCount.set(queries.statements());
            lastStatementSql.set(queries.preparedSql());
        }
    }

    private DungeonTravelChunkKeysResult discoverTravelChunkKeysSnapshot(
            Connection connection,
            DungeonTravelChunkKeysRequest request,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        Optional<DungeonMapHeader> header;
        try {
            header = loadMapHeader(connection, request.mapId().value(), queries);
        } catch (MalformedMapHeaderException exception) {
            return new DungeonTravelChunkKeysResult.Rejected(
                    DungeonIdentityClosureResult.Reason.MALFORMED_ENTITY);
        }
        if (header.isEmpty()) {
            return new DungeonTravelChunkKeysResult.Rejected(
                    DungeonIdentityClosureResult.Reason.MAP_MISSING);
        }
        if (header.get().revision() != request.expectedMapRevision()) {
            return new DungeonTravelChunkKeysResult.Rejected(
                    DungeonIdentityClosureResult.Reason.STALE_REVISION);
        }
        afterHeaderRead.run();
        return new DungeonTravelChunkKeysResult.Complete(
                header.get(),
                loadHorizontalTravelChunkRing(connection, request, queries));
    }

    private static List<DungeonChunkKey> loadHorizontalTravelChunkRing(
            Connection connection,
            DungeonTravelChunkKeysRequest request,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        String sql = "SELECT level_z, chunk_q, chunk_r FROM " + DungeonPersistenceSchema.CHUNKS_TABLE
                + " WHERE dungeon_map_id=?"
                + " AND chunk_q IN (?,?,?) AND chunk_r IN (?,?,?)"
                + " ORDER BY level_z, chunk_r, chunk_q";
        try (PreparedStatement statement = queries.prepare(connection, sql)) {
            statement.setLong(1, request.mapId().value());
            statement.setInt(2, request.centerChunkQ() - 1);
            statement.setInt(3, request.centerChunkQ());
            statement.setInt(4, request.centerChunkQ() + 1);
            statement.setInt(5, request.centerChunkR() - 1);
            statement.setInt(6, request.centerChunkR());
            statement.setInt(7, request.centerChunkR() + 1);
            try (ResultSet rows = statement.executeQuery()) {
                List<DungeonChunkKey> keys = new ArrayList<>();
                while (rows.next()) {
                    keys.add(new DungeonChunkKey(
                            request.mapId().value(),
                            rows.getInt("level_z"),
                            rows.getInt("chunk_q"),
                            rows.getInt("chunk_r")));
                }
                return List.copyOf(keys);
            }
        }
    }

    private DungeonTravelStartResult locateTravelStartSnapshot(
            Connection connection,
            DungeonTravelStartRequest request,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        Optional<DungeonMapHeader> header = loadMapHeader(connection, request.mapId().value(), queries);
        if (header.isEmpty()) {
            return new DungeonTravelStartResult.Rejected(DungeonIdentityClosureResult.Reason.MAP_MISSING);
        }
        if (header.get().revision() != request.expectedMapRevision()) {
            return new DungeonTravelStartResult.Rejected(DungeonIdentityClosureResult.Reason.STALE_REVISION);
        }
        afterHeaderRead.run();
        Optional<DungeonTravelStartResult.Located> transition = firstPlacedTransition(
                connection, header.get(), queries);
        if (transition.isPresent()) {
            return transition.get();
        }
        Optional<DungeonTravelStartResult.Located> chunk = firstAuthoredChunk(
                connection, header.get(), queries);
        return chunk.<DungeonTravelStartResult>map(value -> value)
                .orElseGet(() -> new DungeonTravelStartResult.Empty(header.get()));
    }

    private static Optional<DungeonTravelStartResult.Located> firstPlacedTransition(
            Connection connection,
            DungeonMapHeader header,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        String sql = "SELECT t.transition_id, t.cell_x, t.cell_y, t.level_z"
                + " FROM " + DungeonPersistenceSchema.ENTITY_CHUNKS_TABLE + " ec"
                + " JOIN " + DungeonPersistenceSchema.TRANSITIONS_TABLE + " t"
                + " ON t.dungeon_map_id=ec.dungeon_map_id AND t.transition_id=ec.entity_id"
                + " WHERE ec.dungeon_map_id=? AND ec.entity_kind='TRANSITION'"
                + " AND t.cell_x IS NOT NULL AND t.cell_y IS NOT NULL AND t.level_z IS NOT NULL"
                + " GROUP BY t.transition_id, t.cell_x, t.cell_y, t.level_z"
                + " ORDER BY t.transition_id LIMIT 1";
        try (PreparedStatement statement = queries.prepare(connection, sql)) {
            statement.setLong(1, header.mapId().value());
            try (ResultSet row = statement.executeQuery()) {
                if (!row.next()) {
                    return Optional.empty();
                }
                return Optional.of(new DungeonTravelStartResult.Located(
                        header,
                        new features.dungeon.domain.core.geometry.Cell(
                                row.getInt("cell_x"),
                                row.getInt("cell_y"),
                                row.getInt("level_z")),
                        row.getLong("transition_id")));
            }
        }
    }

    private static Optional<DungeonTravelStartResult.Located> firstAuthoredChunk(
            Connection connection,
            DungeonMapHeader header,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        String sql = "SELECT level_z, chunk_q, chunk_r FROM " + DungeonPersistenceSchema.CHUNKS_TABLE
                + " WHERE dungeon_map_id=? ORDER BY level_z, chunk_r, chunk_q LIMIT 1";
        try (PreparedStatement statement = queries.prepare(connection, sql)) {
            statement.setLong(1, header.mapId().value());
            try (ResultSet row = statement.executeQuery()) {
                if (!row.next()) {
                    return Optional.empty();
                }
                DungeonChunkKey chunk = new DungeonChunkKey(
                        header.mapId().value(),
                        row.getInt("level_z"),
                        row.getInt("chunk_q"),
                        row.getInt("chunk_r"));
                return Optional.of(new DungeonTravelStartResult.Located(
                        header,
                        new features.dungeon.domain.core.geometry.Cell(
                                chunk.minimumQ(), chunk.minimumR(), chunk.level()),
                        null));
            }
        }
    }

    private Optional<DungeonWindow> loadWindowSnapshot(
            Connection connection,
            DungeonWindowRequest request,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        Optional<DungeonMapHeader> header = loadMapHeader(connection, request.mapId().value(), queries);
        if (header.isEmpty()) {
            return Optional.empty();
        }
        afterHeaderRead.run();
        List<DungeonWindowChunkHeader> chunkHeaders = loadChunkHeaders(connection, request, queries);
        Map<DungeonPatchEntityRef, List<DungeonChunkKey>> requestedMemberships =
                loadRequestedMemberships(connection, request, queries);
        List<DungeonEntityChunkExtent> extents = loadRequestedExtents(connection, request, queries);
        List<DungeonWindowEntityFragment> fragments = DungeonSqliteWindowFragmentLoader.loadAll(
                connection,
                request.mapId().value(),
                request.chunkKeys(),
                requestedMemberships,
                queries);
        return Optional.of(new DungeonWindow(
                header.get(), request.requestGeneration(), chunkHeaders, fragments,
                extents, List.of(), DungeonContinuationPage.empty()));
    }

    private DungeonIdentityClosureResult loadClosureSnapshot(
            Connection connection,
            DungeonIdentityClosureRequest request,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        Optional<DungeonMapHeader> header;
        try {
            header = loadMapHeader(connection, request.mapId().value(), queries);
        } catch (MalformedMapHeaderException exception) {
            return rejected(DungeonIdentityClosureResult.Reason.MALFORMED_ENTITY, request.entityRefs());
        }
        if (header.isEmpty()) {
            return rejected(DungeonIdentityClosureResult.Reason.MAP_MISSING, request.entityRefs());
        }
        if (header.get().revision() != request.expectedMapRevision()) {
            return rejected(DungeonIdentityClosureResult.Reason.STALE_REVISION, request.entityRefs());
        }
        afterHeaderRead.run();
        DungeonSqliteClosureBatchLoader.LoadResult loaded = DungeonSqliteClosureBatchLoader.loadAll(
                connection, request.mapId().value(), request.entityRefs(), queries);
        List<DungeonEntitySnapshot> snapshots = new ArrayList<>();
        List<DungeonPatchEntityRef> missing = new ArrayList<>();
        for (DungeonPatchEntityRef ref : request.entityRefs()) {
            DungeonIdentityClosureResult.Reason sourceRejection = loaded.rejections().get(ref);
            if (sourceRejection != null) {
                return rejected(sourceRejection, List.of(ref));
            }
            DungeonWindowEntityRecord record = loaded.records().get(ref);
            if (record == null) {
                missing.add(ref);
                continue;
            }
            try {
                snapshots.add(DungeonWindowEntityMapper.toSnapshot(record));
            } catch (IllegalArgumentException exception) {
                return rejected(
                        DungeonWindowEntityMapper.isIncomplete(exception)
                                ? DungeonIdentityClosureResult.Reason.INCOMPLETE_ENTITY
                                : DungeonIdentityClosureResult.Reason.MALFORMED_ENTITY,
                        List.of(ref));
            }
        }
        if (!missing.isEmpty()) {
            return rejected(DungeonIdentityClosureResult.Reason.ENTITY_MISSING, missing);
        }
        if (snapshots.size() != request.entityRefs().size()) {
            return rejected(DungeonIdentityClosureResult.Reason.INCOMPLETE_ENTITY, request.entityRefs());
        }
        return new DungeonIdentityClosureResult.Complete(header.get(), snapshots);
    }

    private static DungeonIdentityClosureResult.Rejected rejected(
            DungeonIdentityClosureResult.Reason reason,
            List<DungeonPatchEntityRef> refs
    ) {
        return new DungeonIdentityClosureResult.Rejected(reason, refs);
    }

    private static Optional<DungeonMapHeader> loadMapHeader(
            Connection connection,
            long mapId,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT dungeon_map_id, name, revision FROM " + DungeonPersistenceSchema.MAPS_TABLE
                        + " WHERE dungeon_map_id=?")) {
            statement.setLong(1, mapId);
            try (ResultSet rows = statement.executeQuery()) {
                if (!rows.next()) {
                    return Optional.empty();
                }
                long loadedMapId = rows.getLong("dungeon_map_id");
                String mapName = rows.getString("name");
                long revision = rows.getLong("revision");
                if (loadedMapId < 1L || mapName == null || mapName.isBlank() || revision < 1L) {
                    throw new MalformedMapHeaderException();
                }
                try {
                    return Optional.of(new DungeonMapHeader(
                            new DungeonMapIdentity(loadedMapId),
                            mapName,
                            revision));
                } catch (IllegalArgumentException exception) {
                    throw new MalformedMapHeaderException(exception);
                }
            }
        }
    }

    private static final class MalformedMapHeaderException extends IllegalArgumentException {
        private MalformedMapHeaderException() {
            super("Malformed dungeon map header row.");
        }

        private MalformedMapHeaderException(IllegalArgumentException cause) {
            super("Malformed dungeon map header row.", cause);
        }
    }

    private static List<DungeonWindowChunkHeader> loadChunkHeaders(
            Connection connection,
            DungeonWindowRequest request,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        if (request.chunkKeys().isEmpty()) {
            return List.of();
        }
        Map<DungeonChunkKey, Long> revisions = new LinkedHashMap<>();
        String sql = "SELECT level_z, chunk_q, chunk_r, content_revision FROM "
                + DungeonPersistenceSchema.CHUNKS_TABLE
                + " WHERE dungeon_map_id=? AND (" + exactChunkPredicate(request.chunkKeys().size()) + ")";
        try (PreparedStatement statement = queries.prepare(connection, sql)) {
            int parameter = bindExactChunks(statement, request.mapId().value(), request.chunkKeys());
            if (parameter == 0) {
                throw new IllegalStateException("chunk header query was not bound");
            }
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    revisions.put(new DungeonChunkKey(
                                    request.mapId().value(),
                                    rows.getInt("level_z"),
                                    rows.getInt("chunk_q"),
                                    rows.getInt("chunk_r")),
                            rows.getLong("content_revision"));
                }
            }
        }
        List<DungeonWindowChunkHeader> result = new ArrayList<>();
        for (DungeonChunkKey key : request.chunkKeys()) {
            result.add(new DungeonWindowChunkHeader(key, revisions.getOrDefault(key, 0L)));
        }
        return List.copyOf(result);
    }

    private static Map<DungeonPatchEntityRef, List<DungeonChunkKey>> loadRequestedMemberships(
            Connection connection,
            DungeonWindowRequest request,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        if (request.chunkKeys().isEmpty()) {
            return Map.of();
        }
        String sql = "SELECT entity_kind, entity_id, level_z, chunk_q, chunk_r FROM "
                + DungeonPersistenceSchema.ENTITY_CHUNKS_TABLE
                + " WHERE dungeon_map_id=? AND (" + exactChunkPredicate(request.chunkKeys().size()) + ")"
                + " ORDER BY entity_kind, entity_id, level_z, chunk_r, chunk_q";
        try (PreparedStatement statement = queries.prepare(connection, sql)) {
            bindExactChunks(statement, request.mapId().value(), request.chunkKeys());
            try (ResultSet rows = statement.executeQuery()) {
                Map<DungeonPatchEntityRef, List<DungeonChunkKey>> mutable = new LinkedHashMap<>();
                while (rows.next()) {
                    DungeonPatchEntityRef ref = ref(rows.getString("entity_kind"), rows.getLong("entity_id"));
                    mutable.computeIfAbsent(ref, ignored -> new ArrayList<>())
                            .add(new DungeonChunkKey(
                                    request.mapId().value(),
                                    rows.getInt("level_z"),
                                    rows.getInt("chunk_q"),
                                    rows.getInt("chunk_r")));
                }
                Map<DungeonPatchEntityRef, List<DungeonChunkKey>> result = new LinkedHashMap<>();
                mutable.forEach((key, value) -> result.put(key, List.copyOf(new LinkedHashSet<>(value))));
                return Map.copyOf(result);
            }
        }
    }

    private static List<DungeonEntityChunkExtent> loadRequestedExtents(
            Connection connection,
            DungeonWindowRequest request,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        if (request.chunkKeys().isEmpty()) {
            return List.of();
        }
        String sql = "SELECT entity_kind,entity_id,level_z,chunk_q,chunk_r,"
                + "minimum_q,minimum_r,maximum_q,maximum_r,entity_chunk_count FROM "
                + DungeonPersistenceSchema.ENTITY_CHUNKS_TABLE
                + " WHERE dungeon_map_id=? AND (" + exactChunkPredicate(request.chunkKeys().size()) + ")"
                + " ORDER BY entity_kind,entity_id,level_z,chunk_r,chunk_q";
        try (PreparedStatement statement = queries.prepare(connection, sql)) {
            bindExactChunks(statement, request.mapId().value(), request.chunkKeys());
            try (ResultSet rows = statement.executeQuery()) {
                List<DungeonEntityChunkExtent> result = new ArrayList<>();
                while (rows.next()) {
                    DungeonChunkKey chunk = new DungeonChunkKey(request.mapId().value(),
                            rows.getInt("level_z"), rows.getInt("chunk_q"), rows.getInt("chunk_r"));
                    result.add(new DungeonEntityChunkExtent(
                            ref(rows.getString("entity_kind"), rows.getLong("entity_id")), chunk,
                            rows.getInt("minimum_q"), rows.getInt("minimum_r"),
                            rows.getInt("maximum_q"), rows.getInt("maximum_r"),
                            rows.getInt("entity_chunk_count")));
                }
                return List.copyOf(result);
            }
        }
    }

    private static List<DungeonAuthoredLevelBounds> loadLevelBounds(
            Connection connection,
            long mapId,
            List<DungeonChunkKey> requestedChunks,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        List<Integer> levels = requestedChunks.stream().map(DungeonChunkKey::level).distinct().sorted().toList();
        if (levels.isEmpty()) {
            return List.of();
        }
        String sql = "SELECT level_z,minimum_q,minimum_r,maximum_q,maximum_r FROM "
                + DungeonPersistenceSchema.AUTHORED_LEVEL_BOUNDS_TABLE
                + " WHERE dungeon_map_id=? AND level_z IN ("
                + String.join(",", java.util.Collections.nCopies(levels.size(), "?")) + ") ORDER BY level_z";
        Map<Integer, DungeonAuthoredLevelBounds> loaded = new LinkedHashMap<>();
        try (PreparedStatement statement = queries.prepare(connection, sql)) {
            statement.setLong(1, mapId);
            for (int index = 0; index < levels.size(); index++) {
                statement.setInt(index + 2, levels.get(index));
            }
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    int level = rows.getInt("level_z");
                    loaded.put(level, new DungeonAuthoredLevelBounds(level, true,
                            rows.getInt("minimum_q"), rows.getInt("minimum_r"),
                            rows.getInt("maximum_q"), rows.getInt("maximum_r")));
                }
            }
        }
        return levels.stream().map(level -> loaded.getOrDefault(level, DungeonAuthoredLevelBounds.empty(level)))
                .toList();
    }

    private DungeonContinuationPage loadContinuationPageSnapshot(
            Connection connection,
            DungeonContinuationPageRequest request,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        if (request.requestedChunks().isEmpty()) {
            lastContinuationRowsRead.set(0);
            return DungeonContinuationPage.empty();
        }
        String requestedPredicate = exactChunkPredicate("seed", request.requestedChunks().size());
        String excludedPredicate = exactChunkPredicate("off", request.requestedChunks().size());
        String cursorPredicate = request.after().isPresent()
                ? " AND (off.entity_kind,off.entity_id,off.level_z,off.chunk_r,off.chunk_q) > (?,?,?,?,?)"
                : "";
        String sql = "WITH requested_entities AS MATERIALIZED ("
                + "SELECT DISTINCT seed.entity_kind,seed.entity_id FROM "
                + DungeonPersistenceSchema.ENTITY_CHUNKS_TABLE + " seed WHERE seed.dungeon_map_id=? AND ("
                + requestedPredicate + ")) SELECT DISTINCT off.entity_kind,off.entity_id,off.level_z,off.chunk_q,off.chunk_r"
                + " FROM " + DungeonPersistenceSchema.ENTITY_CHUNKS_TABLE + " off"
                + " JOIN requested_entities requested ON requested.entity_kind=off.entity_kind"
                + " AND requested.entity_id=off.entity_id WHERE off.dungeon_map_id=?"
                + " AND NOT (" + excludedPredicate + ")" + cursorPredicate
                + " ORDER BY off.entity_kind,off.entity_id,off.level_z,off.chunk_r,off.chunk_q LIMIT 257";
        try (PreparedStatement statement = queries.prepare(connection, sql)) {
            int parameter = bindExactChunks(statement, request.mapId().value(), request.requestedChunks());
            statement.setLong(parameter++, request.mapId().value());
            parameter = bindExactChunks(statement, parameter, request.requestedChunks());
            if (request.after().isPresent()) {
                DungeonContinuationCursor cursor = request.after().get();
                statement.setString(parameter++, cursor.entityRef().kind().name());
                statement.setLong(parameter++, cursor.entityRef().id());
                statement.setInt(parameter++, cursor.offWindowChunk().level());
                statement.setInt(parameter++, cursor.offWindowChunk().chunkR());
                statement.setInt(parameter, cursor.offWindowChunk().chunkQ());
            }
            List<ContinuationRow> rowsRead = new ArrayList<>();
            try (ResultSet rows = statement.executeQuery()) {
                while (rows.next()) {
                    rowsRead.add(new ContinuationRow(
                            ref(rows.getString("entity_kind"), rows.getLong("entity_id")),
                            new DungeonChunkKey(request.mapId().value(), rows.getInt("level_z"),
                                    rows.getInt("chunk_q"), rows.getInt("chunk_r"))));
                }
            }
            lastContinuationRowsRead.set(rowsRead.size());
            boolean hasMore = rowsRead.size() > DungeonContinuationPageRequest.PAGE_SIZE;
            List<ContinuationRow> pageRows = hasMore
                    ? List.copyOf(rowsRead.subList(0, DungeonContinuationPageRequest.PAGE_SIZE))
                    : List.copyOf(rowsRead);
            Map<DungeonPatchEntityRef, List<DungeonChunkKey>> grouped = new LinkedHashMap<>();
            pageRows.forEach(row -> grouped.computeIfAbsent(row.entityRef(), ignored -> new ArrayList<>())
                    .add(row.offWindowChunk()));
            List<DungeonWindowContinuation> entries = grouped.entrySet().stream()
                    .map(entry -> new DungeonWindowContinuation(entry.getKey(), entry.getValue()))
                    .toList();
            Optional<DungeonContinuationCursor> next = Optional.empty();
            if (hasMore) {
                ContinuationRow last = pageRows.get(pageRows.size() - 1);
                next = Optional.of(new DungeonContinuationCursor(
                        request.mapId(), request.expectedMapRevision(), request.requestGeneration(),
                        request.requestedChunks(), last.entityRef(), last.offWindowChunk()));
            }
            return new DungeonContinuationPage(entries, next);
        }
    }

    private static String exactChunkPredicate(String alias, int chunkCount) {
        return String.join(" OR ", java.util.Collections.nCopies(
                chunkCount,
                "(" + alias + ".level_z=? AND " + alias + ".chunk_q=? AND " + alias + ".chunk_r=?)"));
    }

    private static String exactChunkPredicate(int chunkCount) {
        return String.join(" OR ", java.util.Collections.nCopies(
                chunkCount,
                "(level_z=? AND chunk_q=? AND chunk_r=?)"));
    }

    private static int bindExactChunks(
            PreparedStatement statement,
            long mapId,
            List<DungeonChunkKey> chunks
    ) throws SQLException {
        int parameter = 1;
        statement.setLong(parameter++, mapId);
        for (DungeonChunkKey chunk : chunks) {
            statement.setInt(parameter++, chunk.level());
            statement.setInt(parameter++, chunk.chunkQ());
            statement.setInt(parameter++, chunk.chunkR());
        }
        return parameter;
    }

    private static int bindExactChunks(
            PreparedStatement statement,
            int parameter,
            List<DungeonChunkKey> chunks
    ) throws SQLException {
        for (DungeonChunkKey chunk : chunks) {
            statement.setInt(parameter++, chunk.level());
            statement.setInt(parameter++, chunk.chunkQ());
            statement.setInt(parameter++, chunk.chunkR());
        }
        return parameter;
    }

    private static DungeonPatchEntityRef ref(String kind, long id) {
        try {
            return switch (DungeonPatchEntityRef.Kind.valueOf(kind)) {
                case ROOM -> DungeonPatchEntityRef.room(id);
                case ROOM_CLUSTER -> DungeonPatchEntityRef.roomCluster(id);
                case CORRIDOR -> DungeonPatchEntityRef.corridor(id);
                case STAIR -> DungeonPatchEntityRef.stair(id);
                case TRANSITION -> DungeonPatchEntityRef.transition(id);
                case FEATURE_MARKER -> DungeonPatchEntityRef.featureMarker(id);
            };
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("Unknown Dungeon entity membership kind: " + kind, exception);
        }
    }

    private record ContinuationRow(DungeonPatchEntityRef entityRef, DungeonChunkKey offWindowChunk) { }
}
