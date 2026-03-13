package features.world.dungeonmap.service;

public final class DungeonMapServices {

    private final DungeonMapQueries queries = new DungeonMapQueries();
    private final DungeonMapCommands commands = new DungeonMapCommands();

    public DungeonMapQueries queries() {
        return queries;
    }

    public DungeonMapCommands commands() {
        return commands;
    }
}
