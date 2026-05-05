package src.domain.dungeon.map.value;

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

    public boolean targets(DungeonCorridorAnchorBinding binding) {
        return binding != null && present() && topologyRef.equals(binding.topologyRef());
    }
}
