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
import features.dungeon.application.authored.port.DungeonWindowChunkHeader;
import features.dungeon.application.authored.port.DungeonWindowContinuation;
import features.dungeon.application.authored.port.DungeonWindowEntityFragment;
import features.dungeon.application.authored.port.DungeonWindowRequest;
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

    public Optional<DungeonWindow> loadWindow(DungeonWindowRequest request) {
        DungeonWindowRequest safeRequest = Objects.requireNonNull(request, "request");
        DungeonSqliteQueryCounter queries = new DungeonSqliteQueryCounter();
        try (Connection connection = connectionSupport.openReadyConnection()) {
            return DungeonSqliteReadSnapshot.read(
                    connection,
                    () -> loadWindowSnapshot(connection, safeRequest, queries));
        } catch (SQLException exception) {
            throw new IllegalStateException("Failed to load Dungeon window from SQLite.", exception);
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
        List<DungeonWindowEntityFragment> fragments = DungeonSqliteWindowFragmentLoader.loadAll(
                connection,
                request.mapId().value(),
                request.chunkKeys(),
                requestedMemberships,
                queries);
        Map<DungeonPatchEntityRef, List<DungeonChunkKey>> allMemberships = loadAllMemberships(
                connection,
                request.mapId().value(),
                requestedMemberships.keySet(),
                queries);
        List<DungeonWindowContinuation> continuations = new ArrayList<>();
        Set<DungeonChunkKey> requestedKeys = Set.copyOf(request.chunkKeys());
        for (Map.Entry<DungeonPatchEntityRef, List<DungeonChunkKey>> entry : requestedMemberships.entrySet()) {
            List<DungeonChunkKey> offWindow = allMemberships.getOrDefault(entry.getKey(), List.of())
                    .stream()
                    .filter(key -> !requestedKeys.contains(key))
                    .toList();
            if (!offWindow.isEmpty()) {
                continuations.add(new DungeonWindowContinuation(entry.getKey(), offWindow));
            }
        }
        return Optional.of(new DungeonWindow(
                header.get(), request.requestGeneration(), chunkHeaders, fragments, continuations));
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

    private static Map<DungeonPatchEntityRef, List<DungeonChunkKey>> loadAllMemberships(
            Connection connection,
            long mapId,
            Set<DungeonPatchEntityRef> refs,
            DungeonSqliteQueryCounter queries
    ) throws SQLException {
        if (refs.isEmpty()) {
            return Map.of();
        }
        Map<DungeonPatchEntityRef.Kind, List<Long>> idsByKind = new java.util.EnumMap<>(
                DungeonPatchEntityRef.Kind.class);
        for (DungeonPatchEntityRef ref : refs) {
            idsByKind.computeIfAbsent(ref.kind(), ignored -> new ArrayList<>()).add(ref.id());
        }
        String predicate = idsByKind.entrySet().stream()
                .map(entry -> "(entity_kind=? AND entity_id IN (" + String.join(",",
                        java.util.Collections.nCopies(entry.getValue().size(), "?")) + "))")
                .collect(java.util.stream.Collectors.joining(" OR "));
        try (PreparedStatement statement = queries.prepare(connection,
                "SELECT entity_kind, entity_id, level_z, chunk_q, chunk_r FROM "
                        + DungeonPersistenceSchema.ENTITY_CHUNKS_TABLE
                        + " WHERE dungeon_map_id=? AND (" + predicate + ")"
                        + " ORDER BY entity_kind, entity_id, level_z, chunk_r, chunk_q")) {
            int parameter = 1;
            statement.setLong(parameter++, mapId);
            for (Map.Entry<DungeonPatchEntityRef.Kind, List<Long>> entry : idsByKind.entrySet()) {
                statement.setString(parameter++, entry.getKey().name());
                for (Long id : entry.getValue()) {
                    statement.setLong(parameter++, id);
                }
            }
            try (ResultSet rows = statement.executeQuery()) {
                Map<DungeonPatchEntityRef, List<DungeonChunkKey>> mutable = new LinkedHashMap<>();
                while (rows.next()) {
                    DungeonPatchEntityRef ref = ref(rows.getString("entity_kind"), rows.getLong("entity_id"));
                    mutable.computeIfAbsent(ref, ignored -> new ArrayList<>()).add(new DungeonChunkKey(
                            mapId,
                            rows.getInt("level_z"),
                            rows.getInt("chunk_q"),
                            rows.getInt("chunk_r")));
                }
                Map<DungeonPatchEntityRef, List<DungeonChunkKey>> result = new LinkedHashMap<>();
                mutable.forEach((ref, values) -> result.put(ref, List.copyOf(values)));
                return Map.copyOf(result);
            }
        }
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
}
