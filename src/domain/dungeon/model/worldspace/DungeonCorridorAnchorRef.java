package src.domain.dungeon.model.worldspace;

import src.domain.dungeon.model.core.component.CorridorAnchorRef;

public record DungeonCorridorAnchorRef(
        long hostCorridorId,
        DungeonTopologyRef topologyRef
) {

    public DungeonCorridorAnchorRef {
        hostCorridorId = Math.max(0L, hostCorridorId);
        topologyRef = topologyRef == null ? DungeonTopologyRef.empty() : topologyRef;
    }

    public boolean present() {
        return hostCorridorId > 0L && topologyRef.present();
    }

    public CorridorAnchorRef toCore() {
        return new CorridorAnchorRef(hostCorridorId, topologyRef.id());
    }

}
