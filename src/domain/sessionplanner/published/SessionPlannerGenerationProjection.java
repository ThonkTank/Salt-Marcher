package src.domain.sessionplanner.published;

import java.util.List;

public record SessionPlannerGenerationProjection(
        Status status,
        long generationId,
        String summary,
        String provenance,
        List<EncounterPreview> encounters,
        List<TreasurePreview> treasures,
        List<AuditPreview> audits,
        boolean applyEnabled,
        String message
) {
    public SessionPlannerGenerationProjection {
        status = status == null ? Status.IDLE : status;
        generationId = Math.max(0L, generationId);
        summary = summary == null ? "" : summary;
        provenance = provenance == null ? "" : provenance;
        encounters = encounters == null ? List.of() : List.copyOf(encounters);
        treasures = treasures == null ? List.of() : List.copyOf(treasures);
        audits = audits == null ? List.of() : List.copyOf(audits);
        message = message == null ? "" : message;
    }

    public static SessionPlannerGenerationProjection idle() {
        return new SessionPlannerGenerationProjection(
                Status.IDLE, 0L, "", "", List.of(), List.of(), List.of(), false, "");
    }

    public enum Status {
        IDLE,
        PREVIEW,
        APPLIED,
        ERROR
    }

    public record EncounterPreview(int encounterNumber, String line, String roles) {
    }

    public record TreasurePreview(int treasureId, String placement, String value, List<String> lines) {
        public TreasurePreview {
            lines = lines == null ? List.of() : List.copyOf(lines);
        }
    }

    public record AuditPreview(String name, boolean passed, String detail) {
    }
}
