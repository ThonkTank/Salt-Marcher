package src.domain.worldplanner.model.world;

import java.util.List;

public record WorldPlannerState(
        List<WorldNpc> npcs,
        List<WorldFaction> factions,
        List<WorldLocation> locations,
        long nextNpcId,
        long nextFactionId,
        long nextLocationId,
        String statusText
) {

    public WorldPlannerState {
        npcs = npcs == null ? List.of() : List.copyOf(npcs);
        factions = factions == null ? List.of() : List.copyOf(factions);
        locations = locations == null ? List.of() : List.copyOf(locations);
        nextNpcId = Math.max(1L, nextNpcId);
        nextFactionId = Math.max(1L, nextFactionId);
        nextLocationId = Math.max(1L, nextLocationId);
        statusText = WorldNpc.text(statusText);
    }

    public static WorldPlannerState empty() {
        return new WorldPlannerState(List.of(), List.of(), List.of(), 1L, 1L, 1L, "");
    }

    public WorldPlannerState withStatus(String status) {
        return new WorldPlannerState(npcs, factions, locations, nextNpcId, nextFactionId, nextLocationId, status);
    }

    public WorldNpc npc(long npcId) {
        return npcs.stream()
                .filter(npc -> npc.npcId() == npcId)
                .findFirst()
                .orElse(null);
    }

    public WorldFaction faction(long factionId) {
        return factions.stream()
                .filter(faction -> faction.factionId() == factionId)
                .findFirst()
                .orElse(null);
    }

    public WorldLocation location(long locationId) {
        return locations.stream()
                .filter(location -> location.locationId() == locationId)
                .findFirst()
                .orElse(null);
    }
}
