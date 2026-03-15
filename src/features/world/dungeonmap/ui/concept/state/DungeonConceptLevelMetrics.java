package features.world.dungeonmap.ui.concept.state;

public record DungeonConceptLevelMetrics(
        int fullSpanGroupXp,
        int progressTargetGroupXp,
        double progressTargetDays,
        int daysTargetGroupXp,
        double daysTargetFraction
) {
    public static DungeonConceptLevelMetrics empty() {
        return new DungeonConceptLevelMetrics(0, 0, 0.0, 0, 0.0);
    }
}
