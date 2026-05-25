package src.domain.sessionplanner;

import src.domain.sessionplanner.model.session.model.SessionPlan;
import src.domain.sessionplanner.model.session.port.SessionEncounterFactsPort;
import src.domain.sessionplanner.model.session.port.SessionPartyFactsPort;
import src.domain.sessionplanner.model.session.repository.SessionEncounterFactsRepository;
import src.domain.sessionplanner.model.session.repository.SessionPartyFactsRepository;
import src.domain.sessionplanner.published.SessionPlannerEncountersProjection;
import src.domain.sessionplanner.published.SessionPlannerSessionSnapshot;
import src.domain.sessionplanner.published.SessionPlannerStatePanelProjection;

final class SessionPlannerStatePanelProjectionServiceAssembly {

    private SessionPlannerStatePanelProjectionServiceAssembly() {
    }

    static SessionPlannerStatePanelProjection projectStatePanel(
            SessionPlan session,
            SessionPartyFactsPort partyFacts,
            SessionPartyFactsRepository partyFactsRepository,
            SessionEncounterFactsPort encounterFacts,
            SessionEncounterFactsRepository encounterFactsRepository
    ) {
        SessionPlannerProjectionContextServiceAssembly.ProjectionContext context =
                SessionPlannerProjectionContextServiceAssembly.buildContext(
                        session,
                        partyFacts,
                        partyFactsRepository,
                        encounterFactsRepository);
        SessionPlannerSessionSnapshot sessionSnapshot = SessionPlannerSessionProjectionServiceAssembly.projectSession(
                session,
                partyFacts,
                partyFactsRepository,
                encounterFacts,
                encounterFactsRepository);
        return buildStatePanel(
                sessionSnapshot,
                SessionPlannerEncountersProjectionServiceAssembly.buildPlannedEncounters(
                        session,
                        context.scaledBudgetXp(),
                        context.loadedEncounters(),
                        encounterFactsRepository));
    }

    private static SessionPlannerStatePanelProjection buildStatePanel(
            SessionPlannerSessionSnapshot session,
            java.util.List<SessionPlannerEncountersProjection.PlannedEncounter> encounters
    ) {
        SessionPlannerEncountersProjection.PlannedEncounter selectedEncounter = encounters.stream()
                .filter(SessionPlannerEncountersProjection.PlannedEncounter::selected)
                .findFirst()
                .orElse(null);
        if (selectedEncounter == null) {
            return new SessionPlannerStatePanelProjection(
                    false,
                    "Kein Session-Encounter ausgewaehlt",
                    "Waehle im Planner einen Encounter aus, um den vorbereitenden State-Kontext zu sehen.",
                    "",
                    session.session().hasSelectedEncounter()
                            ? "Encounter fuer State-Panel ausgewaehlt"
                            : "Noch kein Encounter fuer State-Panel ausgewaehlt",
                    "Katalog-Vorbereitung",
                    "Der generische Katalog folgt spaeter. Dieser Slice reserviert nur die planner-eigene read-only Flaeche.");
        }
        String detail = selectedEncounter.creatureCount() + " Kreaturen"
                + (selectedEncounter.generatedLabel().isBlank() ? "" : " · " + selectedEncounter.generatedLabel());
        String xpSummary = selectedEncounter.budgetPercentage().stripTrailingZeros().toPlainString()
                + "% Budget · Ziel " + selectedEncounter.targetXp() + " XP · Ist "
                + selectedEncounter.adjustedXp() + " XP";
        return new SessionPlannerStatePanelProjection(
                true,
                selectedEncounter.name(),
                detail,
                xpSummary,
                "Ausgewaehlter Encounter #" + selectedEncounter.token(),
                "Katalog-Vorbereitung",
                "Read-only Placeholder fuer spaetere Monster-, Spell- und Loot-Aktionen. Noch keine echte Catalog-Boundary und keine Mutation.");
    }
}
