package features.world.dungeonmap.application.runtime;

import java.util.List;

public record DungeonRuntimeSurface(
        String title,
        DungeonRuntimeSurfaceRef ref,
        String visualDescription,
        List<DungeonRuntimeExit> exits,
        List<DungeonRuntimeAction> actions
) {
    public DungeonRuntimeSurface {
        title = title == null || title.isBlank() ? "Dungeon" : title;
        visualDescription = visualDescription == null ? "" : visualDescription.trim();
        exits = exits == null ? List.of() : List.copyOf(exits);
        actions = actions == null ? List.of() : List.copyOf(actions);
    }

    /**
     * Runtime exits are the single descriptive truth for numbered doorways. Overlay markers, inspector copy, and
     * travel actions should derive from these exits instead of rebuilding parallel door payloads at each UI sink.
     */
    public List<DungeonRuntimeAction> availableActions() {
        if (exits.isEmpty()) {
            return actions;
        }
        if (actions.isEmpty()) {
            return exits.stream().map(DungeonRuntimeExit::action).toList();
        }
        var result = new java.util.ArrayList<DungeonRuntimeAction>(exits.size() + actions.size());
        exits.stream().map(DungeonRuntimeExit::action).forEach(result::add);
        result.addAll(actions);
        return List.copyOf(result);
    }
}
