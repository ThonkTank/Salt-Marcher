package src.view.leftbartabs.sessionplanner;

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
import src.domain.sessionplanner.published.SessionPlannerSceneTimelineProjection;
import src.domain.sessionplanner.published.SessionPlannerParticipantsProjection;
import src.domain.sessionplanner.published.SessionPlannerRestKind;
import src.domain.sessionplanner.published.SessionPlannerSessionSnapshot;

public final class SessionPlannerTimelineMainContentModel {

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

    private final ReadOnlyObjectWrapper<Projection> projection =
            new ReadOnlyObjectWrapper<>(Projection.empty());
    private final Map<SceneDraftKey, SceneDraft> sceneDrafts = new HashMap<>();
    private List<LocationOption> locationOptions = List.of();
    private SessionPlannerSceneTimelineProjection latestSceneTimelineProjection =
            SessionPlannerSceneTimelineProjection.empty();
    private SetupState latestSetupState = SetupState.empty();

    ReadOnlyObjectProperty<Projection> projectionProperty() {
        return projection.getReadOnlyProperty();
    }

    void applySceneTimeline(SessionPlannerSceneTimelineProjection sceneTimelineProjection) {
        latestSceneTimelineProjection = sceneTimelineProjection == null
                ? SessionPlannerSceneTimelineProjection.empty()
                : sceneTimelineProjection;
        pruneSceneDrafts(latestSceneTimelineProjection);
        publishProjection();
    }

    void applyLocationReferences(List<SessionPlannerSessionSnapshot.LocationReference> locationReferences) {
        locationOptions = locationReferences == null
                ? List.of()
                : locationReferences.stream()
                        .map(LocationOption::from)
                        .toList();
        publishProjection();
    }

    void applySetup(SetupState setupState) {
        SetupState nextSetupState = setupState == null ? SetupState.empty() : setupState;
        if (latestSetupState.sessionId() != nextSetupState.sessionId()) {
            sceneDrafts.clear();
        }
        latestSetupState = nextSetupState;
        publishProjection();
    }

    void updateSceneDraft(long sceneToken, String sceneTitle, String sceneNotes, long locationId) {
        if (sceneToken <= NO_SCENE_TOKEN) {
            return;
        }
        SceneDraft draft = new SceneDraft(sceneTitle, sceneNotes, locationId);
        SceneDraftKey key = new SceneDraftKey(latestSetupState.sessionId(), sceneToken);
        if (draft.equals(sceneDrafts.get(key))) {
            return;
        }
        sceneDrafts.put(key, draft);
    }

    long participantChoiceId(int choiceIndex) {
        List<ParticipantChoice> choices = latestSetupState.partyMemberChoices();
        return choiceIndex < 0 || choiceIndex >= choices.size()
                ? 0L
                : choices.get(choiceIndex).characterId();
    }

    BigDecimal budgetPercentage(long sceneToken) {
        if (sceneToken <= NO_SCENE_TOKEN) {
            return BigDecimal.ZERO;
        }
        return latestSceneTimelineProjection.sessionScenes().stream()
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

    private void pruneSceneDrafts(SessionPlannerSceneTimelineProjection sceneTimelineProjection) {
        Set<Long> activeTokens = sceneTimelineProjection.sessionScenes().stream()
                .map(SessionPlannerSceneTimelineProjection.SessionScene::sceneToken)
                .collect(Collectors.toSet());
        long sessionId = latestSetupState.sessionId();
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

    private void publishProjection() {
        projection.set(Projection.from(latestSceneTimelineProjection, sceneDrafts, locationOptions, latestSetupState));
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
            encounterDaysText = safeText(encounterDaysText);
            budgetText = safeText(budgetText);
            restText = safeText(restText);
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
            label = safeText(label);
        }

        @Override
        public String toString() {
            return label;
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
            name = safeText(name);
            detail = safeText(detail);
            detailStyleClass = safeText(detailStyleClass);
        }
    }

    record Projection(
            SetupModel setup,
            List<Projection.SceneModel> scenes,
            List<Projection.RestGapModel> restGaps,
            List<LocationOption> locationOptions
    ) {

        Projection {
            setup = setup == null ? SetupModel.empty() : setup;
            scenes = safeCopy(scenes);
            restGaps = safeCopy(restGaps);
            locationOptions = safeCopy(locationOptions);
        }

        static Projection empty() {
            return new Projection(SetupModel.empty(), List.of(), List.of(), List.of());
        }

        static Projection from(
                SessionPlannerSceneTimelineProjection projection,
                Map<SceneDraftKey, SceneDraft> sceneDrafts,
                List<LocationOption> locationOptions,
                SetupState setupState
        ) {
            SessionPlannerSceneTimelineProjection safe =
                    projection == null ? SessionPlannerSceneTimelineProjection.empty() : projection;
            SetupState safeSetup = setupState == null ? SetupState.empty() : setupState;
            return new Projection(
                    SetupModel.from(safeSetup, safe.sessionScenes().size()),
                    mapScenes(safe.sessionScenes(), sceneDrafts, locationOptions, safeSetup.sessionId()),
                    safe.restGaps().stream()
                            .map(gap -> new RestGapModel(
                                    gap.gapIndex(),
                                    gap.leftSceneToken(),
                                    gap.rightSceneToken(),
                                    restLabel(gap.restKind()),
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
                List<LocationOption> locationOptions,
                long sessionId
        ) {
            List<SessionPlannerSceneTimelineProjection.SessionScene> safe =
                    scenes == null ? List.of() : List.copyOf(scenes);
            Map<SceneDraftKey, SceneDraft> safeDrafts = sceneDrafts == null ? Map.of() : Map.copyOf(sceneDrafts);
            List<LocationOption> safeLocations = safeCopy(locationOptions);
            return java.util.stream.IntStream.range(0, safe.size())
                    .mapToObj(index -> {
                        SessionPlannerSceneTimelineProjection.SessionScene scene = safe.get(index);
                        SceneDraft draft = safeDrafts.get(new SceneDraftKey(sessionId, scene.sceneToken()));
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
                                index < safe.size() - 1,
                                draft == null ? scene.sceneTitle() : draft.sceneTitle(),
                                draft == null ? scene.sceneNotes() : draft.sceneNotes(),
                                locationId,
                                locationLabel(locationId, safeLocations),
                                locationChoices(locationId, safeLocations),
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
                    })
                    .toList();
        }

        private static String restLabel(SessionPlannerRestKind restKind) {
            return switch (restKind == null ? SessionPlannerRestKind.NONE : restKind) {
                case NONE -> "Keine Rast";
                case SHORT_REST -> "Kurze Rast";
                case LONG_REST -> "Lange Rast";
            };
        }

        private static String formatXp(int value) {
            NumberFormat format = NumberFormat.getIntegerInstance(Locale.GERMANY);
            return format.format(Math.max(0, value));
        }

        private static String formatPercent(BigDecimal percentage) {
            BigDecimal safe = percentage == null ? BigDecimal.ZERO : percentage.stripTrailingZeros();
            return safe.toPlainString() + "%";
        }

        private static String locationLabel(long locationId, List<LocationOption> locationOptions) {
            if (locationId <= NO_LOCATION_ID) {
                return "Keine Location";
            }
            for (LocationOption option : safeCopy(locationOptions)) {
                if (option.id() == locationId) {
                    return option.name();
                }
            }
            return "Location #" + locationId;
        }

        private static List<LocationChoice> locationChoices(long selectedLocationId, List<LocationOption> locationOptions) {
            List<LocationChoice> choices = new java.util.ArrayList<>();
            choices.add(new LocationChoice(0L, "Keine Location"));
            boolean selectedPresent = selectedLocationId <= NO_LOCATION_ID;
            for (LocationOption option : safeCopy(locationOptions)) {
                choices.add(new LocationChoice(option.id(), option.name()));
                selectedPresent = selectedPresent || option.id() == selectedLocationId;
            }
            if (!selectedPresent) {
                choices.add(new LocationChoice(selectedLocationId, "Location #" + selectedLocationId));
            }
            return List.copyOf(choices);
        }

        private static <T> List<T> safeCopy(List<T> values) {
            return values == null ? List.of() : List.copyOf(values);
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
                linkedEncounterName = safeText(linkedEncounterName);
                linkedEncounterGeneratedLabel = safeText(linkedEncounterGeneratedLabel);
                linkedEncounterDifficultyLabel = safeText(linkedEncounterDifficultyLabel);
                budgetPercentage = budgetPercentage == null ? BigDecimal.ZERO : budgetPercentage;
                budgetPercentageText = safeText(budgetPercentageText);
                targetXpText = safeText(targetXpText);
                comparisonText = safeText(comparisonText);
                sceneTitle = safeText(sceneTitle);
                sceneNotes = safeText(sceneNotes);
                locationId = Math.max(0L, locationId);
                locationLabel = safeText(locationLabel);
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
                label = safeText(label);
            }

            @Override
            public String toString() {
                return id <= NO_LOCATION_ID ? label : "#" + id + " | " + label;
            }
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
                encounterDaysText = safeText(encounterDaysText);
                sceneTargetText = safeText(sceneTargetText);
                budgetText = safeText(budgetText);
                restText = safeText(restText);
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

            static SetupModel from(
                    SetupState setupState,
                    int sceneCount
            ) {
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
                BigDecimal days = parsePositiveDecimal(encounterDaysText);
                int target = days == null ? 0 : days.multiply(BigDecimal.valueOf(8L)).intValue();
                return sceneCount + " / ca. " + target + " Szenen";
            }

            private static BigDecimal parsePositiveDecimal(String raw) {
                if (raw == null || raw.isBlank()) {
                    return null;
                }
                try {
                    BigDecimal parsed = new BigDecimal(raw.trim().replace(',', '.'));
                    return parsed.signum() <= 0 ? null : parsed;
                } catch (NumberFormatException exception) {
                    return null;
                }
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
                name = safeText(name);
                detail = safeText(detail);
                detailStyleClass = safeText(detailStyleClass);
                removeWidgetToken = Math.max(0L, removeWidgetToken);
                removeText = safeText(removeText);
            }

            static SessionParticipantModel placeholder() {
                return new SessionParticipantModel(0L, "keine Spieler", "", "text-secondary", 0L, "", true, false);
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
                label = safeText(label);
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
                label = safeText(label);
            }
        }

        private static String safeText(String text) {
            return text == null ? "" : text;
        }
    }

    record SceneDraft(
            String sceneTitle,
            String sceneNotes,
            long locationId
    ) {

        SceneDraft {
            sceneTitle = sceneTitle == null ? "" : sceneTitle;
            sceneNotes = sceneNotes == null ? "" : sceneNotes;
            locationId = Math.max(0L, locationId);
        }
    }

    record SceneDraftKey(long sessionId, long sceneToken) {

        SceneDraftKey {
            sessionId = Math.max(0L, sessionId);
            sceneToken = Math.max(0L, sceneToken);
        }
    }

    record LocationOption(long id, String name) {

        LocationOption {
            id = Math.max(0L, id);
            name = name == null || name.isBlank() ? "Location #" + id : name;
        }

        static LocationOption from(SessionPlannerSessionSnapshot.LocationReference reference) {
            return new LocationOption(reference.locationId(), reference.displayName());
        }
    }

    private static <T> List<T> safeCopy(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }

    private static String safeText(String text) {
        return text == null ? "" : text;
    }
}
