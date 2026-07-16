package features.sessionplanner.api;

import java.util.List;

public record SessionGenerationPreviewSnapshot(
        SessionGenerationPreviewStatus status,
        String message,
        long sessionId,
        String generationId,
        long seed,
        String catalogHash,
        Summary summary,
        List<EncounterCard> encounters,
        List<TreasureCard> treasures,
        List<AuditLine> audits,
        long attemptToken,
        boolean applyEnabled
) {

    public SessionGenerationPreviewSnapshot {
        status = status == null ? SessionGenerationPreviewStatus.ERROR : status;
        message = text(message);
        sessionId = Math.max(0L, sessionId);
        generationId = text(generationId);
        seed = Math.max(0L, seed);
        catalogHash = text(catalogHash);
        summary = summary == null ? Summary.empty() : summary;
        encounters = encounters == null ? List.of() : List.copyOf(encounters);
        treasures = treasures == null ? List.of() : List.copyOf(treasures);
        audits = audits == null ? List.of() : List.copyOf(audits);
        attemptToken = Math.max(0L, attemptToken);
        applyEnabled = applyEnabled && status == SessionGenerationPreviewStatus.READY;
    }

    public static SessionGenerationPreviewSnapshot idle() {
        return new SessionGenerationPreviewSnapshot(
                SessionGenerationPreviewStatus.IDLE,
                "",
                0L,
                "",
                0L,
                "",
                Summary.empty(),
                List.of(),
                List.of(),
                List.of(),
                0L,
                false);
    }

    private static String text(String value) {
        return value == null ? "" : value.trim();
    }

    public record Summary(
            int partyCount,
            int encounterCount,
            long sessionXpTarget,
            long normalBudgetCp,
            long overstockBudgetCp,
            int treasureCount
    ) {

        public static Summary empty() {
            return new Summary(0, 0, 0L, 0L, 0L, 0);
        }
    }

    public record EncounterCard(
            int encounterNumber,
            long targetXp,
            String difficulty,
            String roleSummary,
            String monsterSummary
    ) {

        public EncounterCard {
            difficulty = text(difficulty);
            roleSummary = text(roleSummary);
            monsterSummary = text(monsterSummary);
        }
    }

    public record TreasureCard(
            int treasureId,
            String channel,
            String stockClass,
            long targetCp,
            String title,
            List<String> lines
    ) {

        public TreasureCard {
            channel = text(channel);
            stockClass = text(stockClass);
            title = text(title);
            lines = lines == null ? List.of() : lines.stream().map(SessionGenerationPreviewSnapshot::text).toList();
        }
    }

    public record AuditLine(String code, String status, String detail) {

        public AuditLine {
            code = text(code);
            status = text(status);
            detail = text(detail);
        }
    }
}
