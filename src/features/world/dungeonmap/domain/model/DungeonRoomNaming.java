package features.world.dungeonmap.domain.model;

import java.util.Collection;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class DungeonRoomNaming {

    private static final Pattern ROOM_NUMBER_PATTERN = Pattern.compile("^Raum\\s+(\\d+)$");

    private DungeonRoomNaming() {
        throw new AssertionError("No instances");
    }

    public static String nextRoomName(Collection<DungeonRoom> rooms) {
        int nextNumber = 1;
        for (DungeonRoom room : rooms) {
            if (room == null || room.name() == null) {
                continue;
            }
            Matcher matcher = ROOM_NUMBER_PATTERN.matcher(room.name().trim());
            if (matcher.matches()) {
                nextNumber = Math.max(nextNumber, Integer.parseInt(matcher.group(1)) + 1);
            }
        }
        return "Raum " + nextNumber;
    }
}
