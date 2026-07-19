package features.dungeon.application.authored.command;

import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.application.authored.port.DungeonIdentityRange;
import features.dungeon.domain.core.structure.DungeonMap;
import features.dungeon.domain.core.structure.corridor.CorridorMapAuthoring;
import features.dungeon.domain.core.structure.corridor.CorridorMapAuthoring.IdentityReservation;
import features.dungeon.domain.core.structure.corridor.CorridorRoutingPolicy;
import features.dungeon.domain.core.structure.corridor.DungeonCorridorEndpoint;
import features.dungeon.domain.core.structure.room.RoomTopologyWorkCatalog;
import java.util.List;
import java.util.Objects;

/** Plans one exact corridor creation patch, including resolved endpoints and bound stairs. */
public final class CreateCorridorCommand {
    private final CorridorMapAuthoring authoring;

    public CreateCorridorCommand(CorridorRoutingPolicy routingPolicy) {
        authoring = new CorridorMapAuthoring(Objects.requireNonNull(routingPolicy, "routingPolicy"));
    }

    public DungeonCommandResult plan(
            DungeonMap current,
            ReservedIdentities identities,
            DungeonCorridorEndpoint start,
            DungeonCorridorEndpoint end
    ) {
        if (current == null || identities == null || start == null || end == null
                || !identities.validFor(start, end)) {
            return new DungeonCommandResult.Rejected(
                    DungeonEditorCommandOutcome.RejectionReason.INVALID_TARGET);
        }
        IdentityReservation reservation = identities.toDomainReservation();
        return ConnectionPatchPlanner.plan(
                current,
                map -> authoring.createCorridor(map, reservation, start, end),
                DungeonEditorCommandOutcome.RejectionReason.BLOCKED_ROUTE);
    }

    public record ReservedIdentities(
            long corridorId,
            DungeonIdentityRange anchorIds,
            long stairId,
            DungeonIdentityRange stairExitIds,
            DungeonIdentityRange roomClusterIds,
            DungeonIdentityRange roomIds
    ) {
        private static final RoomTopologyWorkCatalog ROOM_WORK_CATALOG =
                new RoomTopologyWorkCatalog();

        public ReservedIdentities {
            Objects.requireNonNull(anchorIds, "anchorIds");
            Objects.requireNonNull(roomClusterIds, "roomClusterIds");
            Objects.requireNonNull(roomIds, "roomIds");
            if (corridorId <= 0L || anchorIds.count() < 2
                    || roomClusterIds.count() < 2 || roomIds.count() < 2) {
                throw new IllegalArgumentException(
                        "corridor reservation requires one corridor, two anchors and two endpoint room partitions");
            }
        }

        boolean validFor(DungeonCorridorEndpoint start, DungeonCorridorEndpoint end) {
            if (start == null || end == null || !start.present() || !end.present()) {
                return false;
            }
            if (start.sameLevelAs(end)) {
                return true;
            }
            int requiredExitIds = Math.abs(start.level() - end.level()) + 1;
            return stairId > 0L && stairExitIds != null && stairExitIds.count() >= requiredExitIds;
        }

        IdentityReservation toDomainReservation() {
            int firstClusterCount = (roomClusterIds.count() + 1) / 2;
            int secondClusterCount = roomClusterIds.count() - firstClusterCount;
            int firstRoomCount = (roomIds.count() + 1) / 2;
            int secondRoomCount = roomIds.count() - firstRoomCount;
            RoomTopologyWorkCatalog.ReservedIdentities firstRoomAllocation =
                    ROOM_WORK_CATALOG.reservedIdentities(
                            roomClusterIds.firstId(),
                            firstClusterCount,
                            roomIds.firstId(),
                            firstRoomCount);
            RoomTopologyWorkCatalog.ReservedIdentities secondRoomAllocation =
                    ROOM_WORK_CATALOG.reservedIdentities(
                            roomClusterIds.firstId() + firstClusterCount,
                            secondClusterCount,
                            roomIds.firstId() + firstRoomCount,
                            secondRoomCount);
            List<Long> exitIds = stairExitIds == null
                    ? List.of()
                    : CreateStairCommand.reservedIds(stairExitIds);
            return new IdentityReservation(
                    corridorId,
                    anchorIds.idAt(0),
                    anchorIds.idAt(1),
                    stairId,
                    exitIds,
                    firstRoomAllocation,
                    secondRoomAllocation);
        }
    }
}
