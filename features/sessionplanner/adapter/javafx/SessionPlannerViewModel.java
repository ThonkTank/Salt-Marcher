package features.sessionplanner.adapter.javafx;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import features.sessionplanner.api.SessionPlannerCatalogSnapshot;
import features.sessionplanner.api.SessionEncounterPlanSearchSnapshot;
import features.sessionplanner.api.SessionPlannerParticipantsProjection;
import features.sessionplanner.api.SessionPlannerRestKind;
import features.sessionplanner.api.SessionPlannerSceneTimelineProjection;
import features.sessionplanner.api.SessionPlannerSelectedSceneSnapshot;
import features.sessionplanner.api.SessionPlannerSessionSnapshot;
import features.sessionplanner.api.SessionPlannerWorkspaceSnapshot;
import features.sessionplanner.api.SessionPreparationSnapshot;
import platform.ui.catalogcrud.CatalogCrudControlsContentModel;

/**
 * Übersetzt die publizierten Session-Planner-Read-Models in drei UI-Projektionen
 * (Controls inkl. Setup, Timeline, Session-Übersicht). Bewusst frei von Widget-Token-Indirektion:
 * die Views tragen die echten Domänen-IDs und rufen typisierte Callbacks; der Binder verdrahtet
 * diese direkt auf die planner-API.
 */
final class SessionPlannerViewModel {

    private static final long NO_LOCATION_ID = 0L;

    private final CatalogCrudControlsContentModel catalogContentModel = new CatalogCrudControlsContentModel();
    private final ReadOnlyObjectWrapper<ControlsProjection> controlsProjection =
            new ReadOnlyObjectWrapper<>(ControlsProjection.empty());
    private final ReadOnlyObjectWrapper<TimelineProjection> timelineProjection =
            new ReadOnlyObjectWrapper<>(TimelineProjection.empty());
    private final ReadOnlyObjectWrapper<SummaryProjection> summaryProjection =
            new ReadOnlyObjectWrapper<>(SummaryProjection.empty());

    private SessionPlannerSessionSnapshot latestSession = SessionPlannerSessionSnapshot.empty("");
    private SessionPlannerParticipantsProjection latestParticipants = SessionPlannerParticipantsProjection.empty();
    private SessionPlannerSceneTimelineProjection latestSceneTimeline =
            SessionPlannerSceneTimelineProjection.empty();
    private SessionPreparationSnapshot latestPreparation = SessionPreparationSnapshot.idle();
    private SessionPlannerSelectedSceneSnapshot latestSelectedScene = SessionPlannerSelectedSceneSnapshot.empty();

    ReadOnlyObjectProperty<ControlsProjection> controlsProjectionProperty() {
        return controlsProjection.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<TimelineProjection> timelineProjectionProperty() {
        return timelineProjection.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<SummaryProjection> summaryProjectionProperty() {
        return summaryProjection.getReadOnlyProperty();
    }

    CatalogCrudControlsContentModel catalogContentModel() {
        return catalogContentModel;
    }

    void applyWorkspace(SessionPlannerWorkspaceSnapshot workspace) {
        SessionPlannerWorkspaceSnapshot safe = workspace == null
                ? SessionPlannerWorkspaceSnapshot.empty() : workspace;
        latestSession = safe.currentSession();
        latestParticipants = safe.participants();
        latestSceneTimeline = safe.sceneTimeline();
        latestPreparation = safe.preparation();
        latestSelectedScene = safe.selectedScene();
        showCatalog(safe.catalog());
        refreshControlsProjection();
        refreshTimelineProjection();
        refreshSummaryProjection();
    }

    boolean hasCurrentSession() {
        return latestSession.session().sessionId() > 0L;
    }

    void updateSelectorFilter(String nextFilterText) {
        catalogContentModel.updateSelectorFilter(nextFilterText);
    }

    void selectCatalogItem(String itemId) {
        catalogContentModel.selectItem(itemId);
    }

    void closeCatalogOperation() {
        catalogContentModel.closeOperation();
    }

    void openCreate() {
        catalogContentModel.openCreate();
    }

    void openRename(String itemId) {
        catalogContentModel.openRename(itemId);
    }

    void openDelete(String itemId) {
        catalogContentModel.openDelete(itemId);
    }

    private void showCatalog(SessionPlannerCatalogSnapshot catalog) {
        SessionPlannerCatalogSnapshot safe = catalog == null ? SessionPlannerCatalogSnapshot.empty() : catalog;
        catalogContentModel.showCatalog(new CatalogCrudControlsContentModel.CatalogState(
                "Sessions",
                "Session auswaehlen",
                "Keine Sessions verfuegbar.",
                safe.selectedSessionId() <= 0L ? "" : Long.toString(safe.selectedSessionId()),
                safe.sessions().stream()
                        .map(session -> new CatalogCrudControlsContentModel.Item(
                                Long.toString(session.sessionId()),
                                session.displayName(),
                                "",
                                0L,
                                true))
                        .toList(),
                new CatalogCrudControlsContentModel.Actions(true, true, true, false),
                false,
                safe.statusText()));
    }

    private void refreshControlsProjection() {
        controlsProjection.set(ControlsProjection.from(latestSession, latestParticipants, latestPreparation));
    }

    private void refreshTimelineProjection() {
        timelineProjection.set(TimelineProjection.from(
                latestSession.session().sessionId(), latestSceneTimeline,
                latestSelectedScene, sessionActionsDisabled()));
    }

    private void refreshSummaryProjection() {
        summaryProjection.set(SummaryProjection.from(latestSession, latestSelectedScene));
    }

    private boolean sessionActionsDisabled() {
        return latestSession.session().sessionId() <= 0L;
    }

    record ControlsProjection(
            String statusText,
            SetupModel setup,
            SessionPreparationSnapshot preparation
    ) {

        ControlsProjection {
            statusText = SessionPlannerVocabulary.text(statusText);
            setup = setup == null ? SetupModel.empty() : setup;
            preparation = preparation == null ? SessionPreparationSnapshot.idle() : preparation;
        }

        static ControlsProjection empty() {
            return new ControlsProjection("", SetupModel.empty(), SessionPreparationSnapshot.idle());
        }

        static ControlsProjection from(
                SessionPlannerSessionSnapshot snapshot,
                SessionPlannerParticipantsProjection participants,
                SessionPreparationSnapshot preparation
        ) {
            SessionPlannerSessionSnapshot safe =
                    snapshot == null ? SessionPlannerSessionSnapshot.empty("") : snapshot;
            boolean hasCurrentSession = safe.session().sessionId() > 0L;
            return new ControlsProjection(
                    safe.status(),
                    SetupModel.from(safe, participants), preparation);
        }

        record SetupModel(
                boolean sessionActionsDisabled,
                String encounterDaysText,
                List<ParticipantChoiceModel> partyMemberChoices,
                List<SessionParticipantModel> sessionParticipants
        ) {

            SetupModel {
                encounterDaysText = SessionPlannerVocabulary.text(encounterDaysText);
                partyMemberChoices = safeCopy(partyMemberChoices);
                sessionParticipants = safeCopy(sessionParticipants);
            }

            static SetupModel empty() {
                return new SetupModel(true, "", List.of(), List.of());
            }

            static SetupModel from(
                    SessionPlannerSessionSnapshot sessionSnapshot,
                    SessionPlannerParticipantsProjection participantsProjection
            ) {
                SessionPlannerSessionSnapshot safeSession =
                        sessionSnapshot == null ? SessionPlannerSessionSnapshot.empty("") : sessionSnapshot;
                SessionPlannerParticipantsProjection safeParticipants =
                        participantsProjection == null
                                ? SessionPlannerParticipantsProjection.empty()
                                : participantsProjection;
                boolean sessionActionsDisabled = safeSession.session().sessionId() <= 0L;
                Set<Long> participantIds = safeParticipants.participants().stream()
                        .map(SessionPlannerParticipantsProjection.SessionParticipant::characterId)
                        .collect(Collectors.toSet());
                return new SetupModel(
                        sessionActionsDisabled,
                        sessionActionsDisabled ? "" : safeSession.session().encounterDaysText(),
                        safeParticipants.activePartyMembers().stream()
                                .filter(member -> !sessionActionsDisabled
                                        && !participantIds.contains(member.characterId()))
                                .map(member -> new ParticipantChoiceModel(
                                        member.characterId(),
                                        member.name() + " - Level " + member.level()))
                                .toList(),
                        safeParticipants.participants().stream()
                                .map(SessionParticipantModel::from)
                                .toList());
            }
        }

        record ParticipantChoiceModel(long characterId, String label) {

            ParticipantChoiceModel {
                characterId = Math.max(0L, characterId);
                label = SessionPlannerVocabulary.text(label);
            }

            @Override
            public String toString() {
                return label;
            }
        }

        record SessionParticipantModel(
                long characterId,
                String name,
                String detail,
                String detailStyleClass
        ) {

            SessionParticipantModel {
                characterId = Math.max(0L, characterId);
                name = SessionPlannerVocabulary.text(name);
                detail = SessionPlannerVocabulary.text(detail);
                detailStyleClass = SessionPlannerVocabulary.text(detailStyleClass);
            }

            static SessionParticipantModel from(
                    SessionPlannerParticipantsProjection.SessionParticipant participant
            ) {
                String detail = participant.level() > 0
                        ? "Level " + participant.level()
                        : participant.statusText();
                return new SessionParticipantModel(
                        participant.characterId(),
                        participant.name(),
                        detail,
                        participant.available() ? "text-secondary" : "session-planner-gap-active");
            }
        }
    }

    record TimelineProjection(
            long sessionId,
            boolean sessionActionsDisabled,
            List<SceneModel> scenes,
            List<RestGapModel> restGaps,
            SelectedSceneModel selectedScene
    ) {

        TimelineProjection {
            sessionId = Math.max(0L, sessionId);
            scenes = safeCopy(scenes);
            restGaps = safeCopy(restGaps);
            selectedScene = selectedScene == null ? SelectedSceneModel.empty() : selectedScene;
        }

        static TimelineProjection empty() {
            return new TimelineProjection(0L, true, List.of(), List.of(), SelectedSceneModel.empty());
        }

        static TimelineProjection from(
                long sessionId,
                SessionPlannerSceneTimelineProjection projection,
                SessionPlannerSelectedSceneSnapshot selected,
                boolean sessionActionsDisabled
        ) {
            SessionPlannerSceneTimelineProjection safe =
                    projection == null ? SessionPlannerSceneTimelineProjection.empty() : projection;
            return new TimelineProjection(
                    sessionId, sessionActionsDisabled,
                    safe.sceneHeaders().stream().map(SceneModel::from).toList(),
                    safe.restGaps().stream().map(gap -> new RestGapModel(
                            gap.gapIndex(), gap.leftSceneToken(), gap.rightSceneToken(),
                            SessionPlannerVocabulary.restLabel(gap.restKind()),
                            gap.restKind() != SessionPlannerRestKind.NONE)).toList(),
                    SelectedSceneModel.from(selected));
        }

        private static String formatXp(int value) {
            return NumberFormat.getIntegerInstance(Locale.GERMANY).format(Math.max(0, value));
        }

        private static String formatPercent(BigDecimal percentage) {
            BigDecimal safe = percentage == null ? BigDecimal.ZERO : percentage.stripTrailingZeros();
            return safe.toPlainString() + "%";
        }

        record SceneModel(
                long sceneToken, String displayTitle, long linkedEncounterPlanId,
                boolean linkedEncounterPlan, String linkedEncounterName,
                String linkedEncounterGeneratedLabel, int linkedEncounterCreatureCount,
                int linkedEncounterAdjustedXp, String linkedEncounterDifficultyLabel,
                String linkedEncounterStatus, BigDecimal budgetPercentage,
                String budgetPercentageText, String targetXpText, String comparisonText,
                boolean selected, String locationLabel, boolean canMoveUp, boolean canMoveDown
        ) {
            SceneModel {
                displayTitle = SessionPlannerVocabulary.text(displayTitle);
                linkedEncounterName = SessionPlannerVocabulary.text(linkedEncounterName);
                linkedEncounterGeneratedLabel = SessionPlannerVocabulary.text(linkedEncounterGeneratedLabel);
                linkedEncounterDifficultyLabel = SessionPlannerVocabulary.text(linkedEncounterDifficultyLabel);
                linkedEncounterStatus = SessionPlannerVocabulary.text(linkedEncounterStatus);
                budgetPercentage = budgetPercentage == null ? BigDecimal.ZERO : budgetPercentage;
                budgetPercentageText = SessionPlannerVocabulary.text(budgetPercentageText);
                targetXpText = SessionPlannerVocabulary.text(targetXpText);
                comparisonText = SessionPlannerVocabulary.text(comparisonText);
                locationLabel = SessionPlannerVocabulary.text(locationLabel);
            }

            static SceneModel from(SessionPlannerSceneTimelineProjection.SceneHeader header) {
                return new SceneModel(
                        header.sceneToken(), header.displayTitle(), header.linkedEncounterPlanId(),
                        header.linkedEncounterPlan(), header.linkedEncounterName(),
                        header.linkedEncounterGeneratedLabel(), header.linkedEncounterCreatureCount(),
                        header.linkedEncounterAdjustedXp(), header.linkedEncounterDifficultyLabel(),
                        header.linkedEncounterStatus(), header.budgetPercentage(),
                        formatPercent(header.budgetPercentage()), formatXp(header.targetXp()),
                        "Ziel " + formatXp(header.targetXp()) + " XP · Ist "
                                + formatXp(header.linkedEncounterAdjustedXp()) + " XP",
                        header.selected(), header.locationLabel(), header.canMoveUp(), header.canMoveDown());
            }

            double budgetFraction() {
                return budgetPercentage.doubleValue() / 100.0;
            }
        }

        record SelectedSceneModel(
                boolean available, long sceneToken, String sceneTitle, String sceneNotes,
                long locationId, List<LocationChoice> locationChoices, BigDecimal budgetPercentage,
                String budgetPercentageText, String targetXpText, long linkedEncounterPlanId,
                boolean linkedEncounterPlan, String linkedEncounterName, String linkedEncounterGeneratedLabel,
                int linkedEncounterCreatureCount, int linkedEncounterTotalBaseXp,
                int linkedEncounterAdjustedXp, double linkedEncounterXpMultiplier,
                String linkedEncounterDifficultyLabel, String linkedEncounterStatus,
                List<SessionPlannerSelectedSceneSnapshot.EncounterRosterLine> linkedEncounterRoster,
                List<SessionPlannerSelectedSceneSnapshot.ManualLootNote> manualLootNotes,
                List<SessionPlannerSelectedSceneSnapshot.GeneratedReward> generatedRewards,
                PlanSearchModel planSearch
        ) {
            SelectedSceneModel {
                sceneTitle = SessionPlannerVocabulary.text(sceneTitle);
                sceneNotes = SessionPlannerVocabulary.text(sceneNotes);
                locationChoices = safeCopy(locationChoices);
                budgetPercentage = budgetPercentage == null ? BigDecimal.ZERO : budgetPercentage;
                linkedEncounterName = SessionPlannerVocabulary.text(linkedEncounterName);
                linkedEncounterGeneratedLabel = SessionPlannerVocabulary.text(linkedEncounterGeneratedLabel);
                linkedEncounterDifficultyLabel = SessionPlannerVocabulary.text(linkedEncounterDifficultyLabel);
                linkedEncounterStatus = SessionPlannerVocabulary.text(linkedEncounterStatus);
                linkedEncounterRoster = safeCopy(linkedEncounterRoster);
                manualLootNotes = safeCopy(manualLootNotes);
                generatedRewards = safeCopy(generatedRewards);
                planSearch = planSearch == null ? PlanSearchModel.idle() : planSearch;
            }

            static SelectedSceneModel empty() {
                return from(SessionPlannerSelectedSceneSnapshot.empty());
            }

            static SelectedSceneModel from(SessionPlannerSelectedSceneSnapshot selected) {
                SessionPlannerSelectedSceneSnapshot safe = selected == null
                        ? SessionPlannerSelectedSceneSnapshot.empty() : selected;
                return new SelectedSceneModel(
                        safe.available(), safe.sceneToken(), safe.sceneTitle(), safe.sceneNotes(), safe.locationId(),
                        safe.locationChoices().stream().map(LocationChoice::from).toList(), safe.budgetPercentage(),
                        formatPercent(safe.budgetPercentage()), formatXp(safe.targetXp()),
                        safe.linkedEncounterPlanId(), safe.linkedEncounterPlan(), safe.linkedEncounterName(),
                        safe.linkedEncounterGeneratedLabel(), safe.linkedEncounterCreatureCount(),
                        safe.linkedEncounterTotalBaseXp(), safe.linkedEncounterAdjustedXp(),
                        safe.linkedEncounterXpMultiplier(), safe.linkedEncounterDifficultyLabel(),
                        safe.linkedEncounterStatus(), safe.linkedEncounterRoster(), safe.manualLootNotes(),
                        safe.generatedRewards(), PlanSearchModel.from(safe.encounterPlanSearch()));
            }
        }

        record AvailablePlanModel(
                long planId,
                String name,
                String difficulty,
                String summary,
                String status,
                boolean enabled
        ) {
            AvailablePlanModel {
                planId = Math.max(0L, planId);
                name = SessionPlannerVocabulary.text(name);
                difficulty = SessionPlannerVocabulary.text(difficulty);
                summary = SessionPlannerVocabulary.text(summary);
                status = SessionPlannerVocabulary.text(status);
            }

            static AvailablePlanModel from(SessionEncounterPlanSearchSnapshot.Result plan) {
                return new AvailablePlanModel(
                        plan.planId(), plan.name(), plan.difficultyLabel(), plan.summaryText(),
                        plan.statusText(), plan.attachEnabled());
            }
        }

        record PlanSearchModel(
                long requestEpoch,
                long sceneToken,
                String query,
                SessionEncounterPlanSearchSnapshot.Status status,
                List<AvailablePlanModel> results,
                boolean hasMore,
                String message
        ) {
            PlanSearchModel {
                requestEpoch = Math.max(0L, requestEpoch);
                sceneToken = Math.max(0L, sceneToken);
                query = SessionPlannerVocabulary.text(query);
                status = status == null ? SessionEncounterPlanSearchSnapshot.Status.IDLE : status;
                results = safeCopy(results);
                message = SessionPlannerVocabulary.text(message);
            }

            static PlanSearchModel idle() {
                return from(SessionEncounterPlanSearchSnapshot.idle());
            }

            static PlanSearchModel from(SessionEncounterPlanSearchSnapshot snapshot) {
                SessionEncounterPlanSearchSnapshot safe = snapshot == null
                        ? SessionEncounterPlanSearchSnapshot.idle() : snapshot;
                return new PlanSearchModel(
                        safe.requestEpoch(), safe.selectedSceneToken(), safe.normalizedQuery(), safe.status(),
                        safe.results().stream().map(AvailablePlanModel::from).toList(),
                        safe.hasMore(), safe.message());
            }
        }

        record LocationChoice(long id, String label) {

            LocationChoice {
                id = Math.max(0L, id);
                label = SessionPlannerVocabulary.text(label);
            }

            @Override
            public String toString() {
                return id <= NO_LOCATION_ID ? label : "#" + id + " | " + label;
            }

            static LocationChoice from(SessionPlannerSelectedSceneSnapshot.LocationChoice choice) {
                return new LocationChoice(choice.locationId(), choice.displayName());
            }
        }

        record RestGapModel(
                int gapIndex,
                long leftSceneToken,
                long rightSceneToken,
                String label,
                boolean hasAssignedRest
        ) {

            RestGapModel {
                label = SessionPlannerVocabulary.text(label);
            }
        }

    }

    record SummaryProjection(
            boolean sessionActive,
            boolean budgetAvailable,
            int totalBudgetXp,
            int plannedEncounterXp,
            int remainingXp,
            int overBudgetXp,
            double progressFraction,
            boolean overBudget,
            String budgetSummary,
            int recommendedShortRests,
            int recommendedLongRests,
            int placedShortRests,
            int placedLongRests,
            String restSummary,
            boolean selectionAvailable,
            String selectedTitle,
            String selectedDetail,
            String selectedBudget
    ) {

        SummaryProjection {
            totalBudgetXp = Math.max(0, totalBudgetXp);
            plannedEncounterXp = Math.max(0, plannedEncounterXp);
            remainingXp = Math.max(0, remainingXp);
            overBudgetXp = Math.max(0, overBudgetXp);
            progressFraction = Math.max(0.0, progressFraction);
            budgetSummary = SessionPlannerVocabulary.text(budgetSummary);
            recommendedShortRests = Math.max(0, recommendedShortRests);
            recommendedLongRests = Math.max(0, recommendedLongRests);
            placedShortRests = Math.max(0, placedShortRests);
            placedLongRests = Math.max(0, placedLongRests);
            restSummary = SessionPlannerVocabulary.text(restSummary);
            selectedTitle = SessionPlannerVocabulary.text(selectedTitle);
            selectedDetail = SessionPlannerVocabulary.text(selectedDetail);
            selectedBudget = SessionPlannerVocabulary.text(selectedBudget);
        }

        static SummaryProjection empty() {
            return from(SessionPlannerSessionSnapshot.empty(""), SessionPlannerSelectedSceneSnapshot.empty());
        }

        static SummaryProjection from(
                SessionPlannerSessionSnapshot sessionSnapshot,
                SessionPlannerSelectedSceneSnapshot selectedScene
        ) {
            SessionPlannerSessionSnapshot safeSession =
                    sessionSnapshot == null ? SessionPlannerSessionSnapshot.empty("") : sessionSnapshot;
            SessionPlannerSelectedSceneSnapshot selected = selectedScene == null
                    ? SessionPlannerSelectedSceneSnapshot.empty() : selectedScene;
            SessionPlannerSessionSnapshot.XpBudgetState budget = safeSession.xpBudget();
            SessionPlannerSessionSnapshot.RestAdviceState rest = safeSession.restAdvice();
            String selectedTitle = selected.sceneTitle().isBlank()
                    ? selected.linkedEncounterName().isBlank()
                            ? "Szene #" + selected.sceneToken() : selected.linkedEncounterName()
                    : selected.sceneTitle();
            String selectedDetail = selected.linkedEncounterPlan()
                    ? selected.linkedEncounterCreatureCount() + " Kreaturen"
                    : "Keine verknüpfte Encounter-Planung";
            String selectedBudget = selected.budgetPercentage().stripTrailingZeros().toPlainString()
                    + "% Budget · Ziel " + selected.targetXp() + " XP · Ist "
                    + selected.linkedEncounterAdjustedXp() + " XP";
            return new SummaryProjection(
                    safeSession.session().sessionId() > 0L,
                    budget.available(),
                    budget.totalBudgetXp(),
                    budget.plannedEncounterXp(),
                    budget.remainingXp(),
                    budget.overBudgetXp(),
                    budget.progressFraction(),
                    budget.overBudget(),
                    budget.summary(),
                    rest.recommendedShortRests(),
                    rest.recommendedLongRests(),
                    rest.placedShortRests(),
                    rest.placedLongRests(),
                    rest.summary(),
                    selected.available(), selectedTitle, selectedDetail, selectedBudget);
        }
    }

    private static <T> List<T> safeCopy(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
