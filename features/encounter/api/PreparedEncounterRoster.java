package features.encounter.api;

import java.util.List;

public record PreparedEncounterRoster(
        int encounterNumber,
        String displayLabel,
        String intentFingerprint,
        String rosterFingerprint,
        List<PreparedEncounterCreature> creatures,
        GeneratedEncounterPlanSummary summary
) {
    public PreparedEncounterRoster {
        if (encounterNumber <= 0 || summary == null) {
            throw new IllegalArgumentException("prepared roster identity and summary are required");
        }
        displayLabel = required(displayLabel);
        intentFingerprint = required(intentFingerprint);
        rosterFingerprint = required(rosterFingerprint);
        creatures = creatures == null ? List.of() : List.copyOf(creatures);
        if (creatures.isEmpty()) {
            throw new IllegalArgumentException("prepared roster must not be empty");
        }
    }

    @Override
    public List<PreparedEncounterCreature> creatures() {
        return List.copyOf(creatures);
    }

    private static String required(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("value must not be blank");
        }
        return normalized;
    }
}
