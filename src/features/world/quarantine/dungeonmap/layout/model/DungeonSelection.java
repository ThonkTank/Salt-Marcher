package features.world.quarantine.dungeonmap.layout.model;

import java.util.function.Consumer;
import java.util.function.Function;

public sealed interface DungeonSelection
        permits DungeonSelection.RoomCluster, DungeonSelection.Corridor {

    static DungeonSelection roomCluster(long clusterId) {
        return new RoomCluster(clusterId);
    }

    static DungeonSelection corridor(long corridorId) {
        return new Corridor(corridorId);
    }

    default boolean selectsRoomCluster(Long clusterId) {
        return this instanceof RoomCluster selection && clusterId != null && selection.clusterId() == clusterId;
    }

    default boolean selectsCorridor(Long corridorId) {
        return this instanceof Corridor selection && corridorId != null && selection.corridorId() == corridorId;
    }

    default <T> T map(Function<RoomCluster, T> onCluster, Function<Corridor, T> onCorridor) {
        if (this instanceof RoomCluster cluster) return onCluster.apply(cluster);
        if (this instanceof Corridor corridor) return onCorridor.apply(corridor);
        throw new AssertionError("Unknown DungeonSelection: " + this);
    }

    default void accept(Consumer<RoomCluster> onCluster, Consumer<Corridor> onCorridor) {
        if (this instanceof RoomCluster cluster) onCluster.accept(cluster);
        else if (this instanceof Corridor corridor) onCorridor.accept(corridor);
    }

    record RoomCluster(long clusterId) implements DungeonSelection {
    }

    record Corridor(long corridorId) implements DungeonSelection {
    }
}
