package features.dungeon.adapter.sqlite.repository;

import features.dungeon.adapter.sqlite.gateway.DungeonSqlitePatchGateway;
import features.dungeon.application.authored.command.DungeonCompoundPatch;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.port.DungeonCompoundUnitOfWorkResult;
import features.dungeon.application.authored.port.DungeonUnitOfWork;
import features.dungeon.application.authored.port.DungeonUnitOfWorkResult;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import platform.persistence.SqliteDatabase;

/** SQLite-backed patch transactions with no full-map carrier or readback. */
public final class SqliteDungeonUnitOfWork implements DungeonUnitOfWork {

    private final DungeonSqlitePatchGateway gateway;

    public SqliteDungeonUnitOfWork() {
        this(new DungeonSqlitePatchGateway());
    }

    public SqliteDungeonUnitOfWork(SqliteDatabase database) {
        this(new DungeonSqlitePatchGateway(database));
    }

    SqliteDungeonUnitOfWork(DungeonSqlitePatchGateway gateway) {
        this.gateway = Objects.requireNonNull(gateway, "gateway");
    }

    @Override
    public DungeonUnitOfWorkResult commit(DungeonPatch patch) {
        DungeonPatch safePatch = Objects.requireNonNull(patch, "patch");
        return switch (gateway.commit(safePatch)) {
            case DungeonSqlitePatchGateway.CommitOutcome.Committed committed ->
                    new DungeonUnitOfWorkResult.Committed(
                            safePatch.mapId(),
                            safePatch.committedRevision(),
                            committed.chunkRevisions(),
                            safePatch.resultFacts());
            case DungeonSqlitePatchGateway.CommitOutcome.Rejected rejected ->
                    new DungeonUnitOfWorkResult.Rejected(rejected.reason());
        };
    }

    @Override
    public DungeonCompoundUnitOfWorkResult commit(DungeonCompoundPatch compoundPatch) {
        DungeonCompoundPatch safePatch = Objects.requireNonNull(compoundPatch, "compoundPatch");
        Map<Long, DungeonPatch> patchesByMap = new LinkedHashMap<>();
        safePatch.patches().forEach(patch -> patchesByMap.put(patch.mapId().value(), patch));
        return switch (gateway.commit(safePatch)) {
            case DungeonSqlitePatchGateway.CompoundCommitOutcome.Committed committed -> {
                List<DungeonUnitOfWorkResult.Committed> mapResults = committed.maps().stream()
                        .map(mapCommit -> committedMap(patchesByMap, mapCommit))
                        .toList();
                yield new DungeonCompoundUnitOfWorkResult.Committed(mapResults);
            }
            case DungeonSqlitePatchGateway.CompoundCommitOutcome.Rejected rejected ->
                    new DungeonCompoundUnitOfWorkResult.Rejected(rejected.mapId(), rejected.reason());
        };
    }

    private static DungeonUnitOfWorkResult.Committed committedMap(
            Map<Long, DungeonPatch> patchesByMap,
            DungeonSqlitePatchGateway.MapCommit mapCommit
    ) {
        DungeonPatch patch = patchesByMap.get(mapCommit.mapId().value());
        if (patch == null) {
            throw new IllegalStateException("SQLite compound commit returned an unexpected Dungeon map");
        }
        return new DungeonUnitOfWorkResult.Committed(
                patch.mapId(),
                patch.committedRevision(),
                mapCommit.chunkRevisions(),
                patch.resultFacts());
    }
}
