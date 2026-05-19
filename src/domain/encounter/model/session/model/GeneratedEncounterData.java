package src.domain.encounter.model.session.model;

import java.util.List;

public record GeneratedEncounterData(
        String title,
        String difficultyLabel,
        int adjustedXp,
        List<EncounterCreatureData> roster,
        List<String> advisoryMessages
) {
    public GeneratedEncounterData {
        title = title == null ? "" : title;
        difficultyLabel = difficultyLabel == null ? "" : difficultyLabel;
        roster = roster == null ? List.of() : List.copyOf(roster);
        advisoryMessages = advisoryMessages == null ? List.of() : List.copyOf(advisoryMessages);
    }
}
