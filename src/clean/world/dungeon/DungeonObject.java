package clean.world.dungeon;

import clean.world.dungeon.input.ComposeDungeoneditorInput;
import clean.world.dungeon.input.ComposeDungeontravelInput;
import clean.world.dungeon.state.DungeonState;

/**
 * Owner root seam for dungeon world child hosts.
 */
public final class DungeonObject {

    public ComposeDungeontravelInput.DungeontravelInput composeDungeontravel(ComposeDungeontravelInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return DungeonState.composeDungeontravel(input);
    }

    public ComposeDungeoneditorInput.DungeoneditorInput composeDungeoneditor(ComposeDungeoneditorInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return DungeonState.composeDungeoneditor(input);
    }
}
