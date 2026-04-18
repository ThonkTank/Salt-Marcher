package src.view.encounter.ViewModel;

import src.domain.encounter.api.EncounterCreature;
import src.domain.encounter.api.GeneratedEncounter;

import java.util.List;
import java.util.stream.Collectors;

final class EncounterAlternativeViewMapper {

    private EncounterAlternativeViewMapper() {
    }

    static EncounterSnapshot.AlternativeViewData toAlternative(GeneratedEncounter encounter) {
        List<EncounterSnapshot.CreatureViewData> creaturesViewData = encounter.creatures().stream()
                .map(EncounterAlternativeViewMapper::toCreature)
                .toList();
        return new EncounterSnapshot.AlternativeViewData(
                encounter.title(),
                encounter.achievedDifficulty().name(),
                encounter.creatureCount(),
                encounter.adjustedXp(),
                creatureSummary(encounter.creatures()),
                encounter.highlights().isEmpty() ? "" : encounter.highlights().getFirst(),
                creaturesViewData,
                encounter.highlights());
    }

    private static EncounterSnapshot.CreatureViewData toCreature(EncounterCreature creature) {
        return new EncounterSnapshot.CreatureViewData(
                creature.creatureId(),
                creature.name(),
                creature.challengeRating(),
                creature.xp(),
                creature.quantity(),
                creature.role(),
                creature.tags());
    }

    private static String creatureSummary(List<EncounterCreature> creatures) {
        return creatures.stream()
                .map(creature -> creature.quantity() + "x " + creature.name())
                .collect(Collectors.joining(" + "));
    }
}
