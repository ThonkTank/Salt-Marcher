package features.dungeon.adapter.sqlite.repository;

import features.dungeon.adapter.sqlite.gateway.DungeonSqlitePatchGateway;
import features.dungeon.application.authored.command.DungeonPatch;
import features.dungeon.application.authored.port.DungeonUnitOfWork;
import features.dungeon.application.authored.port.DungeonUnitOfWorkResult;
import java.util.Objects;
import platform.persistence.SqliteDatabase;

/** SQLite-backed single-map patch transaction with no full-map carrier or readback. */
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
}
