package features.world.quarantine.dungeonmap.editor.session.inspector;

import features.world.quarantine.dungeonmap.inspector.DungeonCorridorSummary;
import features.world.quarantine.dungeonmap.inspector.DungeonInspectorPort;
import features.world.quarantine.dungeonmap.inspector.DungeonInspectorPresenter;
import features.world.quarantine.dungeonmap.inspector.DungeonRoomClusterSummary;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.layout.model.DungeonSelection;
import ui.shell.DetailsNavigator;

import java.util.Objects;

public final class DungeonEditorInspectorPublisher {

    private final DungeonInspectorPort inspectorPort;

    public DungeonEditorInspectorPublisher(DungeonInspectorPort inspectorPort) {
        this.inspectorPort = Objects.requireNonNull(inspectorPort, "inspectorPort");
    }

    public boolean isShowing(DungeonSelection target) {
        DetailsNavigator.EntryKey entryKey = entryKey(target);
        return entryKey != null && inspectorPort.isShowing(entryKey);
    }

    public void publish(DungeonLayout layout, DungeonSelection target) {
        if (layout == null || target == null) {
            return;
        }
        target.accept(
                clusterSelection -> {
                    DungeonRoomCluster cluster = layout.findCluster(clusterSelection.clusterId());
                    DungeonRoomClusterSummary summary = DungeonInspectorPresenter.clusterSummary(layout, cluster, false);
                    if (summary != null) {
                        var innerKey = new DetailsNavigator.EntryKey("dungeon-room-cluster", summary.clusterId());
                        inspectorPort.showContent("Raum-Cluster", innerKey, () -> DungeonInspectorPresenter.buildClusterNode(summary));
                    }
                },
                corridorSelection -> {
                    DungeonCorridor corridor = layout.findCorridor(corridorSelection.corridorId());
                    if (corridor == null) return;
                    DungeonCorridorSummary summary = DungeonInspectorPresenter.corridorSummary(layout, corridor, false);
                    if (summary == null) return;
                    inspectorPort.showInfo(
                            "Korridor",
                            new DetailsNavigator.EntryKey("dungeon-corridor", summary.corridorId()),
                            DungeonInspectorPresenter.corridorLabel(summary));
                });
    }

    private DetailsNavigator.EntryKey entryKey(DungeonSelection target) {
        if (target == null) return null;
        return target.map(
                cluster -> new DetailsNavigator.EntryKey("content",
                        new DetailsNavigator.EntryKey("dungeon-room-cluster", cluster.clusterId())),
                corridor -> new DetailsNavigator.EntryKey("dungeon-corridor", corridor.corridorId()));
    }
}
