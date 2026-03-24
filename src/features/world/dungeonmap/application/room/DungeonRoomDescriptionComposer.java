package features.world.dungeonmap.application.room;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.room.RoomNarration;

import java.util.ArrayList;
import java.util.List;

public final class DungeonRoomDescriptionComposer {

    private DungeonRoomDescriptionComposer() {
        throw new AssertionError("No instances");
    }

    public static String finalDescription(Room room) {
        if (room == null) {
            return "";
        }
        RoomNarration narration = room.narration();
        if (narration.hasVisualDescriptionOverride()) {
            return narration.visualDescriptionOverride();
        }
        return generatedDescription(room, narration);
    }

    public static String generatedDescription(Room room) {
        return generatedDescription(room, room == null ? null : room.narration());
    }

    public static String generatedDescription(Room room, RoomNarration narration) {
        if (room == null) {
            return "";
        }
        RoomNarration resolvedNarration = narration == null ? RoomNarration.empty() : narration;
        List<String> sentences = new ArrayList<>();
        sentences.add(baseGeometrySentence(room));
        appendIfPresent(sentences, resolvedNarration.wallFinish().descriptionSentence());
        appendIfPresent(sentences, resolvedNarration.lightLevel().descriptionSentence());
        appendIfPresent(sentences, resolvedNarration.atmosphere().descriptionSentence());
        appendIfPresent(sentences, resolvedNarration.notes());
        return String.join(" ", sentences).trim();
    }

    private static String baseGeometrySentence(Room room) {
        TileShape shape = room.floor().shape();
        if (shape == null || shape.size() == 0) {
            return "Ihr seht vor euch einen Raum.";
        }
        String sizeWord = sizeWord(shape.size());
        String formWord = formWord(shape);
        if (formWord.isBlank()) {
            return "Ihr seht vor euch einen " + sizeWord + " Raum.";
        }
        return "Ihr seht vor euch einen " + sizeWord + ", " + formWord + " Raum.";
    }

    private static String sizeWord(int tileCount) {
        if (tileCount <= 2) {
            return "winzigen";
        }
        if (tileCount <= 5) {
            return "kleinen";
        }
        if (tileCount <= 11) {
            return "mittelgroßen";
        }
        if (tileCount <= 23) {
            return "großen";
        }
        return "weitläufigen";
    }

    private static String formWord(TileShape shape) {
        int width = Math.max(1, shape.maxX() - shape.minX());
        int height = Math.max(1, shape.maxY() - shape.minY());
        int minSide = Math.max(1, Math.min(width, height));
        int maxSide = Math.max(width, height);
        double aspectRatio = (double) maxSide / (double) minSide;
        double fillRatio = (double) shape.size() / (double) (width * height);
        int cornerCount = cornerCount(shape.outerLoop());

        if (width >= 3
                && height >= 3
                && Math.abs(width - height) <= 1
                && fillRatio >= 0.60
                && fillRatio <= 0.82
                && cornerCount >= 8) {
            return "annähernd runden";
        }
        if (aspectRatio >= 2.2 && fillRatio >= 0.65) {
            return "langgezogenen";
        }
        if (fillRatio < 0.72 || cornerCount >= 10) {
            return "verwinkelten";
        }
        if (width == height && fillRatio >= 0.95) {
            return "quadratischen";
        }
        if (fillRatio >= 0.95) {
            return "rechteckigen";
        }
        if (aspectRatio <= 1.35 && fillRatio >= 0.80) {
            return "kompakten";
        }
        return "unregelmäßigen";
    }

    private static int cornerCount(List<Point2i> loop) {
        if (loop == null || loop.size() < 3) {
            return 0;
        }
        int corners = 0;
        for (int index = 0; index < loop.size(); index++) {
            Point2i previous = loop.get((index - 1 + loop.size()) % loop.size());
            Point2i current = loop.get(index);
            Point2i next = loop.get((index + 1) % loop.size());
            Point2i incoming = current.subtract(previous);
            Point2i outgoing = next.subtract(current);
            if (!incoming.equals(outgoing)) {
                corners++;
            }
        }
        return corners;
    }

    private static void appendIfPresent(List<String> sentences, String text) {
        if (text == null || text.isBlank()) {
            return;
        }
        sentences.add(text.trim());
    }
}
