package features.world.dungeonmap.editor.shell.ui;

import features.world.dungeonmap.api.DungeonCorridorSummary;
import features.world.dungeonmap.api.DungeonRoomClusterSummary;
import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.view.model.DungeonSelection;
import features.world.dungeonmap.inspector.ui.DungeonInspectorPresenter;
import ui.shell.DetailsNavigator;

import java.util.Objects;

public final class DungeonEditorInspectorPublisher {

    private final DetailsNavigator detailsNavigator;

    public DungeonEditorInspectorPublisher(DetailsNavigator detailsNavigator) {
        this.detailsNavigator = Objects.requireNonNull(detailsNavigator, "detailsNavigator");
    }

    public boolean isShowing(DungeonSelection target) {
        DetailsNavigator.EntryKey entryKey = entryKey(target);
        return entryKey != null && detailsNavigator.isShowing(entryKey);
    }

    public void publish(DungeonLayout layout, DungeonSelection target) {
        if (layout == null || target == null) {
            return;
        }
        if (target instanceof DungeonSelection.RoomCluster clusterSelection) {
            DungeonRoomCluster cluster = DungeonInspectorPresenter.findCluster(layout, clusterSelection.clusterId());
            DungeonRoomClusterSummary summary = DungeonInspectorPresenter.clusterSummary(layout, cluster, false);
            if (summary != null) {
                detailsNavigator.showDungeonRoomCluster(summary);
            }
            return;
        }
        if (target instanceof DungeonSelection.Corridor corridorSelection) {
            DungeonCorridor corridor = DungeonInspectorPresenter.findCorridor(layout, corridorSelection.corridorId());
            if (corridor == null) {
                return;
            }
            DungeonCorridorSummary summary = DungeonInspectorPresenter.corridorSummary(layout, corridor, false);
            if (summary == null) {
                return;
            }
            detailsNavigator.showInfo(
                    "Korridor",
                    new DetailsNavigator.EntryKey("dungeon-corridor", summary.corridorId()),
                    DungeonInspectorPresenter.corridorLabel(summary));
        }
    }

    private DetailsNavigator.EntryKey entryKey(DungeonSelection target) {
        if (target instanceof DungeonSelection.RoomCluster cluster) {
            return new DetailsNavigator.EntryKey("dungeon-room-cluster", cluster.clusterId());
        }
        if (target instanceof DungeonSelection.Corridor corridor) {
            return new DetailsNavigator.EntryKey("dungeon-corridor", corridor.corridorId());
        }
        return null;
    }
}
