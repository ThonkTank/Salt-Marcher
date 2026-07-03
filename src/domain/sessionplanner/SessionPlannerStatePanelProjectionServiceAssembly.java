package src.domain.sessionplanner;

import src.domain.sessionplanner.model.session.SessionPlan;
import src.domain.sessionplanner.model.session.port.SessionEncounterFactsPort;
import src.domain.sessionplanner.model.session.port.SessionPartyFactsPort;
import src.domain.sessionplanner.model.session.repository.SessionEncounterFactsRepository;
import src.domain.sessionplanner.model.session.repository.SessionPartyFactsRepository;
import src.domain.sessionplanner.published.SessionPlannerSceneTimelineProjection;
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
        return buildStatePanel(
                session.selectedEncounterId() > 0L,
                SessionPlannerSceneTimelineProjectionServiceAssembly.buildSessionScenes(
                        session,
                        context.scaledBudgetXp(),
                        context.loadedEncounters(),
                        encounterFactsRepository));
    }

    private static SessionPlannerStatePanelProjection buildStatePanel(
            boolean hasSelectedScene,
            java.util.List<SessionPlannerSceneTimelineProjection.SessionScene> sessionScenes
    ) {
        SessionPlannerSceneTimelineProjection.SessionScene selectedScene = sessionScenes.stream()
                .filter(SessionPlannerSceneTimelineProjection.SessionScene::selected)
                .findFirst()
                .orElse(null);
        if (selectedScene == null) {
            return new SessionPlannerStatePanelProjection(
                    false,
                    "Keine Session-Szene ausgewaehlt",
                    "Waehle im Planner eine Szene aus, um den vorbereitenden State-Kontext zu sehen.",
                    "",
                    hasSelectedScene
                            ? "Szene fuer State-Panel ausgewaehlt"
                            : "Noch keine Szene fuer State-Panel ausgewaehlt",
                    "Katalog-Vorbereitung",
                    "Planner-owned read-only Placeholder.");
        }
        String title = firstNonBlank(
                selectedScene.sceneTitle(),
                selectedScene.linkedEncounterName(),
                "Szene #" + selectedScene.sceneToken());
        String detail = selectedScene.linkedEncounterPlan()
                ? selectedScene.linkedEncounterCreatureCount() + " Kreaturen"
                        + (selectedScene.linkedEncounterGeneratedLabel().isBlank()
                                ? ""
                                : " · " + selectedScene.linkedEncounterGeneratedLabel())
                : "Keine verknuepfte Encounter-Planung";
        String xpSummary = selectedScene.budgetPercentage().stripTrailingZeros().toPlainString()
                + "% Budget · Ziel " + selectedScene.targetXp() + " XP · Ist "
                + selectedScene.linkedEncounterAdjustedXp() + " XP";
        return new SessionPlannerStatePanelProjection(
                true,
                title,
                detail,
                xpSummary,
                "Ausgewaehlte Szene #" + selectedScene.sceneToken(),
                "Katalog-Vorbereitung",
                "Planner-owned read-only Placeholder.");
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return "";
    }
}
