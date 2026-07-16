package features.sessionplanner.adapter.javafx;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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
import features.sessionplanner.api.SessionPlannerStatePanelModel;
import features.sessionplanner.api.SessionPlannerStatePanelProjection;
import platform.ui.catalogcrud.CatalogCrudControlsContentModel;

final class SessionPlannerViewModel {

    private static final long NO_SCENE_TOKEN = 0L;
    private static final long NO_LOCATION_ID = 0L;
    private static final long SETUP_WIDGET_BASE = 1_000L;
    private static final long SCENE_WIDGET_BASE = 1_000_000L;
    private static final long REST_WIDGET_BASE = 2_000_000L;
    private static final long LOOT_WIDGET_BASE = 3_000_000L;
    private static final long PARTICIPANT_WIDGET_BASE = 4_000_000L;
    private static final long WIDGET_STRIDE = 100L;
    private static final int WIDGET_SCENE_SELECT = 1;
    private static final int WIDGET_ALLOCATION_DECREASE = 2;
    private static final int WIDGET_ALLOCATION_INCREASE = 3;
    private static final int WIDGET_SCENE_MOVE_UP = 4;
    private static final int WIDGET_SCENE_MOVE_DOWN = 5;
    private static final int WIDGET_SCENE_REMOVE = 6;
    private static final int WIDGET_REST_SHORT = 7;
    private static final int WIDGET_REST_LONG = 8;
    private static final int WIDGET_REST_CLEAR = 9;
    private static final int WIDGET_LOOT_ADD = 10;
    private static final int WIDGET_LOOT_REMOVE = 11;
    private static final int WIDGET_SCENE_SAVE = 12;
    private static final int WIDGET_SCENE_DRAFT = 13;
    private static final int WIDGET_PARTICIPANT_ADD = 14;
    private static final int WIDGET_PARTICIPANT_REMOVE = 15;
    private static final int WIDGET_ENCOUNTER_DAYS = 16;
    private static final int WIDGET_SCENE_ADD = 17;
    private static final TimelineWidgetKind[] WIDGET_KIND_BY_CODE = {
            TimelineWidgetKind.NONE,
            TimelineWidgetKind.SCENE_SELECT,
            TimelineWidgetKind.ALLOCATION_DECREASE,
            TimelineWidgetKind.ALLOCATION_INCREASE,
            TimelineWidgetKind.SCENE_MOVE_UP,
            TimelineWidgetKind.SCENE_MOVE_DOWN,
            TimelineWidgetKind.SCENE_REMOVE,
            TimelineWidgetKind.REST_SHORT,
            TimelineWidgetKind.REST_LONG,
            TimelineWidgetKind.REST_CLEAR,
            TimelineWidgetKind.LOOT_ADD,
            TimelineWidgetKind.LOOT_REMOVE,
            TimelineWidgetKind.SCENE_SAVE,
            TimelineWidgetKind.SCENE_DRAFT,
            TimelineWidgetKind.PARTICIPANT_ADD,
            TimelineWidgetKind.PARTICIPANT_REMOVE,
            TimelineWidgetKind.ENCOUNTER_DAYS,
            TimelineWidgetKind.SCENE_ADD
    };

    private final CatalogCrudControlsContentModel catalogContentModel = new CatalogCrudControlsContentModel();
    private final ReadOnlyObjectWrapper<ControlsProjection> controlsProjection =
            new ReadOnlyObjectWrapper<>(ControlsProjection.empty());
    private final ReadOnlyObjectWrapper<TimelineProjection> timelineProjection =
            new ReadOnlyObjectWrapper<>(TimelineProjection.empty());
    private final ReadOnlyObjectWrapper<StateProjection> stateProjection =
            new ReadOnlyObjectWrapper<>(StateProjection.empty());
    private final Map<SceneDraftKey, SceneDraft> sceneDrafts = new HashMap<>();
    private List<TimelineProjection.LocationChoice> locationOptions = List.of();
    private SessionPlannerSessionSnapshot latestSession = SessionPlannerSessionSnapshot.empty("");
    private SessionPlannerParticipantsProjection latestParticipants = SessionPlannerParticipantsProjection.empty();
    private SessionPlannerSceneTimelineProjection latestSceneTimeline =
            SessionPlannerSceneTimelineProjection.empty();
    private SetupState latestSetup = SetupState.empty();

    ReadOnlyObjectProperty<ControlsProjection> controlsProjectionProperty() {
        return controlsProjection.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<TimelineProjection> timelineProjectionProperty() {
        return timelineProjection.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<StateProjection> stateProjectionProperty() {
        return stateProjection.getReadOnlyProperty();
    }

    CatalogCrudControlsContentModel catalogContentModel() {
        return catalogContentModel;
    }

    void bindReadback(
            SessionPlannerCurrentSessionModel sessionModel,
            SessionPlannerCatalogModel catalogModel,
            SessionPlannerParticipantsModel participantsModel,
            SessionPlannerSceneTimelineModel sceneTimelineModel,
            SessionPlannerStatePanelModel statePanelModel
    ) {
        sessionModel.subscribe(this::applySession);
        catalogModel.subscribe(this::applyCatalog);
        participantsModel.subscribe(this::applyParticipants);
        sceneTimelineModel.subscribe(this::applySceneTimeline);
        statePanelModel.subscribe(this::applyStatePanel);
        applySession(sessionModel.current());
        applyCatalog(catalogModel.current());
        applyParticipants(participantsModel.current());
        applySceneTimeline(sceneTimelineModel.current());
        applyStatePanel(statePanelModel.current());
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

    void applySceneTimeline(SessionPlannerSceneTimelineProjection sceneTimelineProjection) {
        latestSceneTimeline = sceneTimelineProjection == null
                ? SessionPlannerSceneTimelineProjection.empty()
                : sceneTimelineProjection;
        pruneSceneDrafts();
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

    void applySetup(SetupState setupState) {
        SetupState nextSetup = setupState == null ? SetupState.empty() : setupState;
        if (latestSetup.sessionId() != nextSetup.sessionId()) {
            sceneDrafts.clear();
        }
        latestSetup = nextSetup;
        refreshTimelineProjection();
    }

    void updateSceneDraft(long sceneToken, String sceneTitle, String sceneNotes, long locationId) {
        if (sceneToken <= NO_SCENE_TOKEN) {
            return;
        }
        SceneDraft draft = new SceneDraft(sceneTitle, sceneNotes, locationId);
        SceneDraftKey key = new SceneDraftKey(latestSetup.sessionId(), sceneToken);
        if (draft.equals(sceneDrafts.get(key))) {
            return;
        }
        sceneDrafts.put(key, draft);
    }

    long participantChoiceId(int choiceIndex) {
        List<ParticipantChoice> choices = latestSetup.partyMemberChoices();
        return choiceIndex < 0 || choiceIndex >= choices.size()
                ? 0L
                : choices.get(choiceIndex).characterId();
    }

    BigDecimal budgetPercentage(long sceneToken) {
        if (sceneToken <= NO_SCENE_TOKEN) {
            return BigDecimal.ZERO;
        }
        return latestSceneTimeline.sessionScenes().stream()
                .filter(scene -> scene.sceneToken() == sceneToken)
                .map(SessionPlannerSceneTimelineProjection.SessionScene::budgetPercentage)
                .findFirst()
                .orElse(BigDecimal.ZERO);
    }

    TimelineWidgetKind widgetKind(long widgetToken) {
        int code = (int) Math.floorMod(widgetToken, WIDGET_STRIDE);
        return code >= WIDGET_KIND_BY_CODE.length
                ? TimelineWidgetKind.NONE
                : WIDGET_KIND_BY_CODE[code];
    }

    private void applySession(SessionPlannerSessionSnapshot snapshot) {
        latestSession = snapshot == null ? SessionPlannerSessionSnapshot.empty("") : snapshot;
        refreshControlsProjection();
        applyLocationReferences(latestSession.locationReferences());
        applyTimelineSetup();
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
        applyTimelineSetup();
    }

    private void applyStatePanel(SessionPlannerStatePanelProjection projection) {
        stateProjection.set(StateProjection.from(projection));
    }

    private void applyTimelineSetup() {
        applySetup(SetupState.from(latestSession, latestParticipants));
    }

    private void refreshControlsProjection() {
        controlsProjection.set(ControlsProjection.from(latestSession));
    }

    private void refreshTimelineProjection() {
        timelineProjection.set(TimelineProjection.from(
                latestSceneTimeline,
                sceneDrafts,
                locationOptions,
                latestSetup));
    }

    private void pruneSceneDrafts() {
        Set<Long> activeTokens = latestSceneTimeline.sessionScenes().stream()
                .map(SessionPlannerSceneTimelineProjection.SessionScene::sceneToken)
                .collect(Collectors.toSet());
        long sessionId = latestSetup.sessionId();
        sceneDrafts.keySet().removeIf(key -> key.sessionId() != sessionId || !activeTokens.contains(key.sceneToken()));
    }

    private static long setupWidgetToken(int widgetCode) {
        return SETUP_WIDGET_BASE + widgetCode;
    }

    private static long sceneWidgetToken(long sceneToken, int widgetCode) {
        return SCENE_WIDGET_BASE + Math.max(0L, sceneToken) * WIDGET_STRIDE + widgetCode;
    }

    private static long restWidgetToken(int gapIndex, int widgetCode) {
        return REST_WIDGET_BASE + Math.max(0, gapIndex) * WIDGET_STRIDE + widgetCode;
    }

    private static long lootWidgetToken(long lootToken, int widgetCode) {
        return LOOT_WIDGET_BASE + Math.max(0L, lootToken) * WIDGET_STRIDE + widgetCode;
    }

    private static long participantWidgetToken(long participantId, int widgetCode) {
        return PARTICIPANT_WIDGET_BASE + Math.max(0L, participantId) * WIDGET_STRIDE + widgetCode;
    }

    record ControlsProjection(
            String statusText,
            SessionModel session,
            List<AvailablePlanModel> availablePlans
    ) {

        ControlsProjection {
            statusText = SessionPlannerVocabulary.text(statusText);
            session = session == null ? SessionModel.empty() : session;
            availablePlans = safeCopy(availablePlans);
        }

        static ControlsProjection empty() {
            return new ControlsProjection("", SessionModel.empty(), List.of());
        }

        static ControlsProjection from(SessionPlannerSessionSnapshot snapshot) {
            SessionPlannerSessionSnapshot safe =
                    snapshot == null ? SessionPlannerSessionSnapshot.empty("") : snapshot;
            boolean hasCurrentSession = safe.session().sessionId() > 0L;
            return new ControlsProjection(
                    safe.status(),
                    new SessionModel(safe.session().sessionId()),
                    safe.availableEncounterPlans().stream()
                            .map(plan -> AvailablePlanModel.from(plan, hasCurrentSession))
                            .toList());
        }

        record SessionModel(long sessionId) {

            SessionModel {
                sessionId = Math.max(0L, sessionId);
            }

            static SessionModel empty() {
                return new SessionModel(0L);
            }
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
    }

    record TimelineProjection(
            SetupModel setup,
            List<SceneModel> scenes,
            List<RestGapModel> restGaps,
            List<LocationChoice> locationOptions
    ) {

        TimelineProjection {
            setup = setup == null ? SetupModel.empty() : setup;
            scenes = safeCopy(scenes);
            restGaps = safeCopy(restGaps);
            locationOptions = safeCopy(locationOptions);
        }

        static TimelineProjection empty() {
            return new TimelineProjection(SetupModel.empty(), List.of(), List.of(), List.of());
        }

        static TimelineProjection from(
                SessionPlannerSceneTimelineProjection projection,
                Map<SceneDraftKey, SceneDraft> sceneDrafts,
                List<LocationChoice> locationOptions,
                SetupState setupState
        ) {
            SessionPlannerSceneTimelineProjection safe =
                    projection == null ? SessionPlannerSceneTimelineProjection.empty() : projection;
            SetupState safeSetup = setupState == null ? SetupState.empty() : setupState;
            return new TimelineProjection(
                    SetupModel.from(safeSetup, safe.sessionScenes().size()),
                    mapScenes(safe.sessionScenes(), sceneDrafts, locationOptions, safeSetup.sessionId()),
                    safe.restGaps().stream()
                            .map(gap -> new RestGapModel(
                                    gap.gapIndex(),
                                    gap.leftSceneToken(),
                                    gap.rightSceneToken(),
                                    SessionPlannerVocabulary.restLabel(gap.restKind()),
                                    gap.restKind() != null && gap.restKind() != SessionPlannerRestKind.NONE,
                                    restWidgetToken(gap.gapIndex(), WIDGET_REST_SHORT),
                                    restWidgetToken(gap.gapIndex(), WIDGET_REST_LONG),
                                    restWidgetToken(gap.gapIndex(), WIDGET_REST_CLEAR)))
                            .toList(),
                    safeCopy(locationOptions));
        }

        private static List<SceneModel> mapScenes(
                List<SessionPlannerSceneTimelineProjection.SessionScene> scenes,
                Map<SceneDraftKey, SceneDraft> sceneDrafts,
                List<LocationChoice> locationOptions,
                long sessionId
        ) {
            List<SessionPlannerSceneTimelineProjection.SessionScene> safe =
                    scenes == null ? List.of() : List.copyOf(scenes);
            Map<SceneDraftKey, SceneDraft> safeDrafts = sceneDrafts == null ? Map.of() : Map.copyOf(sceneDrafts);
            List<LocationChoice> safeLocations = safeCopy(locationOptions);
            return java.util.stream.IntStream.range(0, safe.size())
                    .mapToObj(index -> sceneModel(
                            safe.get(index),
                            safe.size(),
                            index,
                            safeDrafts,
                            safeLocations,
                            sessionId))
                    .toList();
        }

        private static SceneModel sceneModel(
                SessionPlannerSceneTimelineProjection.SessionScene scene,
                int sceneCount,
                int index,
                Map<SceneDraftKey, SceneDraft> sceneDrafts,
                List<LocationChoice> locationOptions,
                long sessionId
        ) {
            SceneDraft draft = sceneDrafts.get(new SceneDraftKey(sessionId, scene.sceneToken()));
            long locationId = draft == null ? scene.locationId() : draft.locationId();
            String comparison = "Ziel " + formatXp(scene.targetXp())
                    + " XP · Ist " + formatXp(scene.linkedEncounterAdjustedXp()) + " XP";
            return new SceneModel(
                    scene.sceneToken(),
                    scene.linkedEncounterName(),
                    scene.linkedEncounterPlan(),
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
                    draft == null ? scene.sceneTitle() : draft.sceneTitle(),
                    draft == null ? scene.sceneNotes() : draft.sceneNotes(),
                    locationId,
                    locationLabel(locationId, locationOptions),
                    locationChoices(locationId, locationOptions),
                    sceneWidgetToken(scene.sceneToken(), WIDGET_SCENE_SELECT),
                    sceneWidgetToken(scene.sceneToken(), WIDGET_ALLOCATION_DECREASE),
                    sceneWidgetToken(scene.sceneToken(), WIDGET_ALLOCATION_INCREASE),
                    sceneWidgetToken(scene.sceneToken(), WIDGET_SCENE_MOVE_UP),
                    sceneWidgetToken(scene.sceneToken(), WIDGET_SCENE_MOVE_DOWN),
                    sceneWidgetToken(scene.sceneToken(), WIDGET_SCENE_REMOVE),
                    sceneWidgetToken(scene.sceneToken(), WIDGET_SCENE_SAVE),
                    sceneWidgetToken(scene.sceneToken(), WIDGET_SCENE_DRAFT),
                    sceneWidgetToken(scene.sceneToken(), WIDGET_LOOT_ADD),
                    scene.lootPlaceholders().stream()
                            .map(loot -> new LootModel(
                                    loot.token(),
                                    lootWidgetToken(loot.token(), WIDGET_LOOT_REMOVE),
                                    loot.label()))
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

        record SetupModel(
                boolean sessionActionsDisabled,
                String encounterDaysText,
                String sceneTargetText,
                String budgetText,
                String restText,
                long participantAddWidgetToken,
                long encounterDaysWidgetToken,
                long sceneAddWidgetToken,
                List<String> partyMemberChoiceLabels,
                List<SessionParticipantModel> sessionParticipantRows
        ) {

            SetupModel {
                encounterDaysText = SessionPlannerVocabulary.text(encounterDaysText);
                sceneTargetText = SessionPlannerVocabulary.text(sceneTargetText);
                budgetText = SessionPlannerVocabulary.text(budgetText);
                restText = SessionPlannerVocabulary.text(restText);
                participantAddWidgetToken = Math.max(0L, participantAddWidgetToken);
                encounterDaysWidgetToken = Math.max(0L, encounterDaysWidgetToken);
                sceneAddWidgetToken = Math.max(0L, sceneAddWidgetToken);
                partyMemberChoiceLabels = safeCopy(partyMemberChoiceLabels);
                sessionParticipantRows = safeCopy(sessionParticipantRows);
            }

            static SetupModel empty() {
                return new SetupModel(true, "", "ca. 0 Szenen", "", "",
                        setupWidgetToken(WIDGET_PARTICIPANT_ADD),
                        setupWidgetToken(WIDGET_ENCOUNTER_DAYS),
                        setupWidgetToken(WIDGET_SCENE_ADD),
                        List.of(),
                        List.of(SessionParticipantModel.placeholder()));
            }

            static SetupModel from(SetupState setupState, int sceneCount) {
                SetupState safe = setupState == null ? SetupState.empty() : setupState;
                return new SetupModel(
                        safe.sessionActionsDisabled(),
                        safe.encounterDaysText(),
                        sceneTargetText(safe.encounterDaysText(), sceneCount),
                        safe.budgetText(),
                        safe.restText(),
                        setupWidgetToken(WIDGET_PARTICIPANT_ADD),
                        setupWidgetToken(WIDGET_ENCOUNTER_DAYS),
                        setupWidgetToken(WIDGET_SCENE_ADD),
                        safe.partyMemberChoices().stream()
                                .map(ParticipantChoice::label)
                                .toList(),
                        participantRows(safe.sessionParticipants()));
            }

            private static List<SessionParticipantModel> participantRows(List<ParticipantState> participants) {
                List<ParticipantState> safe = safeCopy(participants);
                if (safe.isEmpty()) {
                    return List.of(SessionParticipantModel.placeholder());
                }
                return safe.stream()
                        .map(participant -> new SessionParticipantModel(
                                participant.characterId(),
                                participant.name(),
                                participant.detail(),
                                participant.detailStyleClass(),
                                participantWidgetToken(participant.characterId(), WIDGET_PARTICIPANT_REMOVE),
                                "X",
                                participant.actionDisabled(),
                                true))
                        .toList();
            }

            private static String sceneTargetText(String encounterDaysText, int sceneCount) {
                BigDecimal days = SessionPlannerVocabulary.parsePositiveDecimal(encounterDaysText);
                int target = days == null ? 0 : days.multiply(BigDecimal.valueOf(8L)).intValue();
                return sceneCount + " / ca. " + target + " Szenen";
            }
        }

        record SessionParticipantModel(
                long characterId,
                String name,
                String detail,
                String detailStyleClass,
                long removeWidgetToken,
                String removeText,
                boolean actionDisabled,
                boolean removeVisible
        ) {

            SessionParticipantModel {
                characterId = Math.max(0L, characterId);
                name = SessionPlannerVocabulary.text(name);
                detail = SessionPlannerVocabulary.text(detail);
                detailStyleClass = SessionPlannerVocabulary.text(detailStyleClass);
                removeWidgetToken = Math.max(0L, removeWidgetToken);
                removeText = SessionPlannerVocabulary.text(removeText);
            }

            static SessionParticipantModel placeholder() {
                return new SessionParticipantModel(0L, "keine Spieler", "", "text-secondary", 0L, "", true, false);
            }
        }

        record SceneModel(
                long sceneToken,
                String linkedEncounterName,
                boolean linkedEncounterPlan,
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
                long selectWidgetToken,
                long allocationDecreaseWidgetToken,
                long allocationIncreaseWidgetToken,
                long moveUpWidgetToken,
                long moveDownWidgetToken,
                long removeWidgetToken,
                long sceneSaveWidgetToken,
                long sceneDraftWidgetToken,
                long addLootWidgetToken,
                List<LootModel> lootPlaceholders
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
                selectWidgetToken = Math.max(0L, selectWidgetToken);
                allocationDecreaseWidgetToken = Math.max(0L, allocationDecreaseWidgetToken);
                allocationIncreaseWidgetToken = Math.max(0L, allocationIncreaseWidgetToken);
                moveUpWidgetToken = Math.max(0L, moveUpWidgetToken);
                moveDownWidgetToken = Math.max(0L, moveDownWidgetToken);
                removeWidgetToken = Math.max(0L, removeWidgetToken);
                sceneSaveWidgetToken = Math.max(0L, sceneSaveWidgetToken);
                sceneDraftWidgetToken = Math.max(0L, sceneDraftWidgetToken);
                addLootWidgetToken = Math.max(0L, addLootWidgetToken);
                lootPlaceholders = safeCopy(lootPlaceholders);
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
                boolean hasAssignedRest,
                long shortRestWidgetToken,
                long longRestWidgetToken,
                long clearRestWidgetToken
        ) {

            RestGapModel {
                label = SessionPlannerVocabulary.text(label);
                shortRestWidgetToken = Math.max(0L, shortRestWidgetToken);
                longRestWidgetToken = Math.max(0L, longRestWidgetToken);
                clearRestWidgetToken = Math.max(0L, clearRestWidgetToken);
            }
        }

        record LootModel(
                long token,
                long removeWidgetToken,
                String label
        ) {

            LootModel {
                token = Math.max(0L, token);
                removeWidgetToken = Math.max(0L, removeWidgetToken);
                label = SessionPlannerVocabulary.text(label);
            }
        }
    }

    record StateProjection(
            boolean selectedSceneAvailable,
            String selectedSceneTitle,
            String selectedSceneDetail,
            String selectedSceneXpSummary,
            String stateContextLabel,
            String placeholderTitle,
            String placeholderDetail
    ) {

        StateProjection {
            selectedSceneTitle = SessionPlannerVocabulary.text(selectedSceneTitle);
            selectedSceneDetail = SessionPlannerVocabulary.text(selectedSceneDetail);
            selectedSceneXpSummary = SessionPlannerVocabulary.text(selectedSceneXpSummary);
            stateContextLabel = SessionPlannerVocabulary.text(stateContextLabel);
            placeholderTitle = SessionPlannerVocabulary.text(placeholderTitle);
            placeholderDetail = SessionPlannerVocabulary.text(placeholderDetail);
        }

        static StateProjection empty() {
            return from(SessionPlannerStatePanelProjection.empty());
        }

        static StateProjection from(SessionPlannerStatePanelProjection projection) {
            SessionPlannerStatePanelProjection safe =
                    projection == null ? SessionPlannerStatePanelProjection.empty() : projection;
            return new StateProjection(
                    safe.selectedSceneAvailable(),
                    safe.selectedSceneTitle(),
                    safe.selectedSceneDetail(),
                    safe.selectedSceneXpSummary(),
                    safe.stateContextLabel(),
                    safe.placeholderTitle(),
                    safe.placeholderDetail());
        }
    }

    record TimelineInput(
            long widgetToken,
            long sceneToken,
            long leftSceneToken,
            long rightSceneToken,
            long lootToken,
            long participantId,
            int participantChoiceIndex,
            String encounterDaysText,
            String sceneTitleText,
            String sceneNotesText,
            long locationId
    ) {

        TimelineInput {
            widgetToken = Math.max(0L, widgetToken);
            sceneToken = Math.max(0L, sceneToken);
            leftSceneToken = Math.max(0L, leftSceneToken);
            rightSceneToken = Math.max(0L, rightSceneToken);
            lootToken = Math.max(0L, lootToken);
            participantId = Math.max(0L, participantId);
            participantChoiceIndex = Math.max(-1, participantChoiceIndex);
            encounterDaysText = SessionPlannerVocabulary.text(encounterDaysText);
            sceneTitleText = SessionPlannerVocabulary.text(sceneTitleText);
            sceneNotesText = SessionPlannerVocabulary.text(sceneNotesText);
            locationId = Math.max(0L, locationId);
        }
    }

    record SetupState(
            long sessionId,
            boolean sessionActionsDisabled,
            String encounterDaysText,
            String budgetText,
            String restText,
            List<ParticipantChoice> partyMemberChoices,
            List<ParticipantState> sessionParticipants
    ) {

        SetupState {
            sessionId = Math.max(0L, sessionId);
            encounterDaysText = SessionPlannerVocabulary.text(encounterDaysText);
            budgetText = SessionPlannerVocabulary.text(budgetText);
            restText = SessionPlannerVocabulary.text(restText);
            partyMemberChoices = safeCopy(partyMemberChoices);
            sessionParticipants = safeCopy(sessionParticipants);
        }

        static SetupState empty() {
            return new SetupState(0L, true, "", "", "", List.of(), List.of());
        }

        static SetupState from(
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
            return new SetupState(
                    safeSession.session().sessionId(),
                    sessionActionsDisabled,
                    sessionActionsDisabled ? "" : safeSession.session().encounterDaysText(),
                    safeSession.xpBudget().summary(),
                    safeSession.restAdvice().summary(),
                    safeParticipants.activePartyMembers().stream()
                            .filter(member -> !sessionActionsDisabled && !participantIds.contains(member.characterId()))
                            .map(member -> new ParticipantChoice(
                                    member.characterId(),
                                    member.name() + " - Level " + member.level()))
                            .toList(),
                    safeParticipants.participants().stream()
                            .map(SetupState::participantState)
                            .toList());
        }

        private static ParticipantState participantState(
                SessionPlannerParticipantsProjection.SessionParticipant participant
        ) {
            String detail = participant.level() > 0
                    ? "Level " + participant.level()
                    : participant.statusText();
            return new ParticipantState(
                    participant.characterId(),
                    participant.name(),
                    detail,
                    participant.available() ? "text-secondary" : "session-planner-gap-active",
                    false);
        }
    }

    record ParticipantChoice(long characterId, String label) {

        ParticipantChoice {
            characterId = Math.max(0L, characterId);
            label = SessionPlannerVocabulary.text(label);
        }
    }

    record ParticipantState(
            long characterId,
            String name,
            String detail,
            String detailStyleClass,
            boolean actionDisabled
    ) {

        ParticipantState {
            characterId = Math.max(0L, characterId);
            name = SessionPlannerVocabulary.text(name);
            detail = SessionPlannerVocabulary.text(detail);
            detailStyleClass = SessionPlannerVocabulary.text(detailStyleClass);
        }
    }

    record SceneDraft(
            String sceneTitle,
            String sceneNotes,
            long locationId
    ) {

        SceneDraft {
            sceneTitle = SessionPlannerVocabulary.text(sceneTitle);
            sceneNotes = SessionPlannerVocabulary.text(sceneNotes);
            locationId = Math.max(0L, locationId);
        }
    }

    record SceneDraftKey(long sessionId, long sceneToken) {

        SceneDraftKey {
            sessionId = Math.max(0L, sessionId);
            sceneToken = Math.max(0L, sceneToken);
        }
    }

    enum TimelineWidgetKind {
        NONE,
        SCENE_SELECT,
        ALLOCATION_DECREASE,
        ALLOCATION_INCREASE,
        SCENE_MOVE_UP,
        SCENE_MOVE_DOWN,
        SCENE_REMOVE,
        REST_SHORT,
        REST_LONG,
        REST_CLEAR,
        LOOT_ADD,
        LOOT_REMOVE,
        SCENE_SAVE,
        SCENE_DRAFT,
        PARTICIPANT_ADD,
        PARTICIPANT_REMOVE,
        ENCOUNTER_DAYS,
        SCENE_ADD
    }

    private static <T> List<T> safeCopy(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
