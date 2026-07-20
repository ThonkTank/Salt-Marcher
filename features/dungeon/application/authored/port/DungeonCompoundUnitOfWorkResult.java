package features.dungeon.application.authored.port;

import features.dungeon.domain.core.structure.DungeonMapIdentity;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/** Ordered per-map results for one indivisible compound patch commit. */
public sealed interface DungeonCompoundUnitOfWorkResult
        permits DungeonCompoundUnitOfWorkResult.Committed, DungeonCompoundUnitOfWorkResult.Rejected {

    record Committed(List<DungeonUnitOfWorkResult.Committed> committedMaps)
            implements DungeonCompoundUnitOfWorkResult {
        public Committed {
            List<DungeonUnitOfWorkResult.Committed> ordered = new ArrayList<>(
                    committedMaps == null ? List.of() : committedMaps);
            if (ordered.isEmpty() || ordered.stream().anyMatch(Objects::isNull)) {
                throw new IllegalArgumentException("a compound commit requires at least one committed map");
            }
            ordered.sort((left, right) -> Long.compare(left.mapId().value(), right.mapId().value()));
            Set<DungeonMapIdentity> mapIds = new HashSet<>();
            for (DungeonUnitOfWorkResult.Committed committed : ordered) {
                if (!mapIds.add(committed.mapId())) {
                    throw new IllegalArgumentException("a compound commit may contain only one result per map");
                }
            }
            committedMaps = List.copyOf(ordered);
        }

        @Override
        public List<DungeonUnitOfWorkResult.Committed> committedMaps() {
            return committedMaps;
        }
    }

    record Rejected(DungeonMapIdentity mapId, DungeonUnitOfWorkResult.Reason reason)
            implements DungeonCompoundUnitOfWorkResult {
        public Rejected {
            mapId = Objects.requireNonNull(mapId, "mapId");
            reason = Objects.requireNonNull(reason, "reason");
        }
    }
}
