package src.view.statetabs.encounter;

import src.domain.encounter.published.EncounterStateSnapshot;

final class EncounterStateContributionModel {

    private final ContentModels contentModels = ContentModels.create();

    ContentModels contentModels() {
        return contentModels;
    }

    void apply(EncounterStateSnapshot snapshot) {
        EncounterStateSnapshot safeSnapshot = snapshot == null ? EncounterStateSnapshot.empty("") : snapshot;
        contentModels.state().showContent(toActiveContent(safeSnapshot.activeMode()));
        contentModels.builder().showBuilder(safeSnapshot.builderPane(), safeSnapshot.statusLine());
        contentModels.initiative().showInitiative(safeSnapshot.initiativePane());
        contentModels.combat().showCombat(safeSnapshot.combatPane());
        contentModels.results().showResults(safeSnapshot.resolutionPane());
    }

    private static EncounterStateContentModel.ActiveContent toActiveContent(EncounterStateSnapshot.Mode source) {
        EncounterStateSnapshot.Mode effective = source == null ? EncounterStateSnapshot.Mode.BUILDER : source;
        return EncounterStateContentModel.ActiveContent.valueOf(effective.name());
    }

    record ContentModels(
            EncounterStateContentModel state,
            EncounterBuilderStateContentModel builder,
            EncounterInitiativeStateContentModel initiative,
            EncounterCombatStateContentModel combat,
            EncounterResultsStateContentModel results
    ) {

        static ContentModels create() {
            return new ContentModels(
                    new EncounterStateContentModel(),
                    new EncounterBuilderStateContentModel(),
                    new EncounterInitiativeStateContentModel(),
                    new EncounterCombatStateContentModel(),
                    new EncounterResultsStateContentModel());
        }
    }
}
