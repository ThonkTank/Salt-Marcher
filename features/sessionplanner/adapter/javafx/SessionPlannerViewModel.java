package features.sessionplanner.adapter.javafx;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import features.sessionplanner.api.SessionPlannerCatalogModel;
import features.sessionplanner.api.SessionPlannerCatalogSnapshot;
import features.sessionplanner.api.SessionPlannerCurrentSessionModel;
import features.sessionplanner.api.SessionPlannerParticipantsModel;
import features.sessionplanner.api.SessionPlannerParticipantsProjection;
import features.sessionplanner.api.SessionPlannerRestKind;
import features.sessionplanner.api.SessionPlannerSceneTimelineModel;
import features.sessionplanner.api.SessionPlannerSceneTimelineProjection;
import features.sessionplanner.api.SessionPlannerSessionSnapshot;
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

    private List<TimelineProjection.LocationChoice> locationOptions = List.of();
    private SessionPlannerSessionSnapshot latestSession = SessionPlannerSessionSnapshot.empty("");
    private SessionPlannerParticipantsProjection latestParticipants = SessionPlannerParticipantsProjection.empty();
    private SessionPlannerSceneTimelineProjection latestSceneTimeline =
            SessionPlannerSceneTimelineProjection.empty();

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

    void bindReadback(
            SessionPlannerCurrentSessionModel sessionModel,
            SessionPlannerCatalogModel catalogModel,
            SessionPlannerParticipantsModel participantsModel,
            SessionPlannerSceneTimelineModel sceneTimelineModel
    ) {
        sessionModel.subscribe(this::applySession);
        catalogModel.subscribe(this::applyCatalog);
        participantsModel.subscribe(this::applyParticipants);
        sceneTimelineModel.subscribe(this::applySceneTimeline);
        applySession(sessionModel.current());
        applyCatalog(catalogModel.current());
        applyParticipants(participantsModel.current());
        applySceneTimeline(sceneTimelineModel.current());
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

    private void applySession(SessionPlannerSessionSnapshot snapshot) {
        latestSession = snapshot == null ? SessionPlannerSessionSnapshot.empty("") : snapshot;
        applyLocationReferences(latestSession.locationReferences());
        refreshControlsProjection();
        refreshSummaryProjection();
    }

    private void applyCatalog(SessionPlannerCatalogSnapshot catalog) {
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

    private void applyParticipants(SessionPlannerParticipantsProjection projection) {
        latestParticipants = projection == null ? SessionPlannerParticipantsProjection.empty() : projection;
        refreshControlsProjection();
        refreshSummaryProjection();
    }

    void applySceneTimeline(SessionPlannerSceneTimelineProjection sceneTimelineProjection) {
        latestSceneTimeline = sceneTimelineProjection == null
                ? SessionPlannerSceneTimelineProjection.empty()
                : sceneTimelineProjection;
        refreshTimelineProjection();
    }

    void applyLocationReferences(List<SessionPlannerSessionSnapshot.LocationReference> locationReferences) {
        locationOptions = locationReferences == null
                ? List.of()
                : locationReferences.stream()
                        .map(reference -> new TimelineProjection.LocationChoice(
                                reference.locationId(),
                                reference.displayName()))
                        .toList();
        refreshTimelineProjection();
    }

    private void refreshControlsProjection() {
        controlsProjection.set(ControlsProjection.from(latestSession, latestParticipants));
    }

    private void refreshTimelineProjection() {
        timelineProjection.set(TimelineProjection.from(latestSceneTimeline, locationOptions, sessionActionsDisabled()));
    }

    private void refreshSummaryProjection() {
        summaryProjection.set(SummaryProjection.from(latestSession, latestParticipants));
    }

    private boolean sessionActionsDisabled() {
        return latestSession.session().sessionId() <= 0L;
    }

    record ControlsProjection(
            String statusText,
            List<AvailablePlanModel> availablePlans,
            SetupModel setup
    ) {

        ControlsProjection {
            statusText = SessionPlannerVocabulary.text(statusText);
            availablePlans = safeCopy(availablePlans);
            setup = setup == null ? SetupModel.empty() : setup;
        }

        static ControlsProjection empty() {
            return new ControlsProjection("", List.of(), SetupModel.empty());
        }

        static ControlsProjection from(
                SessionPlannerSessionSnapshot snapshot,
                SessionPlannerParticipantsProjection participants
        ) {
            SessionPlannerSessionSnapshot safe =
                    snapshot == null ? SessionPlannerSessionSnapshot.empty("") : snapshot;
            boolean hasCurrentSession = safe.session().sessionId() > 0L;
            return new ControlsProjection(
                    safe.status(),
                    safe.availableEncounterPlans().stream()
                            .map(plan -> AvailablePlanModel.from(plan, hasCurrentSession))
                            .toList(),
                    SetupModel.from(safe, participants));
        }

        record AvailablePlanModel(
                long planId,
                String name,
                String summaryText,
                String statusText,
                String actionText,
                String actionStyleClass,
                boolean actionDisabled
        ) {

            AvailablePlanModel {
                planId = Math.max(0L, planId);
                name = SessionPlannerVocabulary.text(name);
                summaryText = SessionPlannerVocabulary.text(summaryText);
                statusText = SessionPlannerVocabulary.text(statusText);
                actionText = SessionPlannerVocabulary.text(actionText);
                actionStyleClass = SessionPlannerVocabulary.text(actionStyleClass);
            }

            static AvailablePlanModel from(
                    SessionPlannerSessionSnapshot.AvailableEncounterPlan plan,
                    boolean hasCurrentSession
            ) {
                boolean importEnabled = hasCurrentSession && plan.importEnabled();
                return new AvailablePlanModel(
                        plan.planId(),
                        plan.name(),
                        plan.summaryText(),
                        plan.statusText(),
                        "An Session anhaengen",
                        "accent",
                        !importEnabled);
            }
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
            boolean sessionActionsDisabled,
            List<SceneModel> scenes,
            List<RestGapModel> restGaps,
            List<LocationChoice> locationOptions
    ) {

        TimelineProjection {
            scenes = safeCopy(scenes);
            restGaps = safeCopy(restGaps);
            locationOptions = safeCopy(locationOptions);
        }

        static TimelineProjection empty() {
            return new TimelineProjection(true, List.of(), List.of(), List.of());
        }

        static TimelineProjection from(
                SessionPlannerSceneTimelineProjection projection,
                List<LocationChoice> locationOptions,
                boolean sessionActionsDisabled
        ) {
            SessionPlannerSceneTimelineProjection safe =
                    projection == null ? SessionPlannerSceneTimelineProjection.empty() : projection;
            List<LocationChoice> safeLocations = safeCopy(locationOptions);
            return new TimelineProjection(
                    sessionActionsDisabled,
                    mapScenes(safe.sessionScenes(), safeLocations),
                    safe.restGaps().stream()
                            .map(gap -> new RestGapModel(
                                    gap.gapIndex(),
                                    gap.leftSceneToken(),
                                    gap.rightSceneToken(),
                                    SessionPlannerVocabulary.restLabel(gap.restKind()),
                                    gap.restKind() != null && gap.restKind() != SessionPlannerRestKind.NONE))
                            .toList(),
                    safeLocations);
        }

        private static List<SceneModel> mapScenes(
                List<SessionPlannerSceneTimelineProjection.SessionScene> scenes,
                List<LocationChoice> locationOptions
        ) {
            List<SessionPlannerSceneTimelineProjection.SessionScene> safe =
                    scenes == null ? List.of() : List.copyOf(scenes);
            return java.util.stream.IntStream.range(0, safe.size())
                    .mapToObj(index -> sceneModel(safe.get(index), safe.size(), index, locationOptions))
                    .toList();
        }

        private static SceneModel sceneModel(
                SessionPlannerSceneTimelineProjection.SessionScene scene,
                int sceneCount,
                int index,
                List<LocationChoice> locationOptions
        ) {
            long locationId = scene.locationId();
            String comparison = "Ziel " + formatXp(scene.targetXp())
                    + " XP · Ist " + formatXp(scene.linkedEncounterAdjustedXp()) + " XP";
            return new SceneModel(
                    scene.sceneToken(),
                    scene.linkedEncounterPlan(),
                    scene.linkedEncounterName(),
                    scene.linkedEncounterGeneratedLabel(),
                    scene.linkedEncounterCreatureCount(),
                    scene.linkedEncounterTotalBaseXp(),
                    scene.linkedEncounterAdjustedXp(),
                    scene.linkedEncounterXpMultiplier(),
                    scene.linkedEncounterDifficultyLabel(),
                    scene.budgetPercentage(),
                    formatPercent(scene.budgetPercentage()),
                    formatXp(scene.targetXp()),
                    comparison,
                    scene.selected(),
                    index > 0,
                    index < sceneCount - 1,
                    scene.sceneTitle(),
                    scene.sceneNotes(),
                    locationId,
                    locationLabel(locationId, locationOptions),
                    locationChoices(locationId, locationOptions),
                    scene.lootEntries().stream()
                            .map(entry -> new LootModel(
                                    entry.token(),
                                    entry.label(),
                                    entry.kind() == SessionPlannerSceneTimelineProjection.LootEntry.Kind.MANUAL_NOTE))
                            .toList());
        }

        private static String formatXp(int value) {
            NumberFormat format = NumberFormat.getIntegerInstance(Locale.GERMANY);
            return format.format(Math.max(0, value));
        }

        private static String formatPercent(BigDecimal percentage) {
            BigDecimal safe = percentage == null ? BigDecimal.ZERO : percentage.stripTrailingZeros();
            return safe.toPlainString() + "%";
        }

        private static String locationLabel(long locationId, List<LocationChoice> locationOptions) {
            if (locationId <= NO_LOCATION_ID) {
                return "Keine Location";
            }
            for (LocationChoice option : safeCopy(locationOptions)) {
                if (option.id() == locationId) {
                    return option.label();
                }
            }
            return "Location #" + locationId;
        }

        private static List<LocationChoice> locationChoices(long selectedLocationId, List<LocationChoice> locationOptions) {
            List<LocationChoice> choices = new java.util.ArrayList<>();
            choices.add(new LocationChoice(0L, "Keine Location"));
            boolean selectedPresent = selectedLocationId <= NO_LOCATION_ID;
            for (LocationChoice option : safeCopy(locationOptions)) {
                choices.add(new LocationChoice(option.id(), option.label()));
                selectedPresent = selectedPresent || option.id() == selectedLocationId;
            }
            if (!selectedPresent) {
                choices.add(new LocationChoice(selectedLocationId, "Location #" + selectedLocationId));
            }
            return List.copyOf(choices);
        }

        record SceneModel(
                long sceneToken,
                boolean linkedEncounterPlan,
                String linkedEncounterName,
                String linkedEncounterGeneratedLabel,
                int linkedEncounterCreatureCount,
                int linkedEncounterTotalBaseXp,
                int linkedEncounterAdjustedXp,
                double linkedEncounterXpMultiplier,
                String linkedEncounterDifficultyLabel,
                BigDecimal budgetPercentage,
                String budgetPercentageText,
                String targetXpText,
                String comparisonText,
                boolean selected,
                boolean canMoveUp,
                boolean canMoveDown,
                String sceneTitle,
                String sceneNotes,
                long locationId,
                String locationLabel,
                List<LocationChoice> locationChoices,
                List<LootModel> lootEntries
        ) {

            SceneModel {
                sceneToken = Math.max(0L, sceneToken);
                linkedEncounterName = SessionPlannerVocabulary.text(linkedEncounterName);
                linkedEncounterGeneratedLabel = SessionPlannerVocabulary.text(linkedEncounterGeneratedLabel);
                linkedEncounterDifficultyLabel = SessionPlannerVocabulary.text(linkedEncounterDifficultyLabel);
                budgetPercentage = budgetPercentage == null ? BigDecimal.ZERO : budgetPercentage;
                budgetPercentageText = SessionPlannerVocabulary.text(budgetPercentageText);
                targetXpText = SessionPlannerVocabulary.text(targetXpText);
                comparisonText = SessionPlannerVocabulary.text(comparisonText);
                sceneTitle = SessionPlannerVocabulary.text(sceneTitle);
                sceneNotes = SessionPlannerVocabulary.text(sceneNotes);
                locationId = Math.max(0L, locationId);
                locationLabel = SessionPlannerVocabulary.text(locationLabel);
                locationChoices = safeCopy(locationChoices);
                lootEntries = safeCopy(lootEntries);
            }

            String displayTitle() {
                return sceneTitle.isBlank() ? "Unbenannte Szene" : sceneTitle;
            }

            double budgetFraction() {
                return budgetPercentage.doubleValue() / 100.0;
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

        record LootModel(long token, String label, boolean manualNote) {

            LootModel {
                token = Math.max(0L, token);
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
            int participantCount,
            int averageLevel,
            String levelSpreadText,
            String partyHeadline,
            String partyDetail
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
            participantCount = Math.max(0, participantCount);
            averageLevel = Math.max(0, averageLevel);
            levelSpreadText = SessionPlannerVocabulary.text(levelSpreadText);
            partyHeadline = SessionPlannerVocabulary.text(partyHeadline);
            partyDetail = SessionPlannerVocabulary.text(partyDetail);
        }

        static SummaryProjection empty() {
            return from(SessionPlannerSessionSnapshot.empty(""), SessionPlannerParticipantsProjection.empty());
        }

        static SummaryProjection from(
                SessionPlannerSessionSnapshot sessionSnapshot,
                SessionPlannerParticipantsProjection participantsProjection
        ) {
            SessionPlannerSessionSnapshot safeSession =
                    sessionSnapshot == null ? SessionPlannerSessionSnapshot.empty("") : sessionSnapshot;
            SessionPlannerParticipantsProjection safeParticipants =
                    participantsProjection == null
                            ? SessionPlannerParticipantsProjection.empty()
                            : participantsProjection;
            SessionPlannerSessionSnapshot.XpBudgetState budget = safeSession.xpBudget();
            SessionPlannerSessionSnapshot.RestAdviceState rest = safeSession.restAdvice();
            SessionPlannerParticipantsProjection.PartyState party = safeParticipants.party();
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
                    party.activePartySize(),
                    party.averageLevel(),
                    levelSpreadText(party.activePartyLevels()),
                    party.headline(),
                    party.detail());
        }

        private static String levelSpreadText(List<Integer> levels) {
            List<Integer> safe = levels == null ? List.of() : levels.stream().filter(level -> level != null && level > 0).sorted().toList();
            if (safe.isEmpty()) {
                return "";
            }
            int min = safe.getFirst();
            int max = safe.getLast();
            return min == max ? "Level " + min : "Level " + min + "–" + max;
        }
    }

    private static <T> List<T> safeCopy(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
