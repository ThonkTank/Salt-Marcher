package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import src.domain.sessionplanner.published.SessionPlannerCatalogModel;
import src.domain.sessionplanner.published.SessionPlannerCurrentSessionModel;
import src.domain.sessionplanner.published.SessionPlannerParticipantsModel;
import src.domain.sessionplanner.published.SessionPlannerParticipantsProjection;
import src.domain.sessionplanner.published.SessionPlannerSceneTimelineModel;
import src.domain.sessionplanner.published.SessionPlannerSceneTimelineProjection;
import src.domain.sessionplanner.published.SessionPlannerSessionSnapshot;
import src.domain.sessionplanner.published.SessionPlannerStatePanelModel;
import src.view.slotcontent.controls.catalogcrud.CatalogCrudControlsContentModel;

@SuppressWarnings({"PMD.CouplingBetweenObjects", "PMD.TooManyMethods"})
final class SessionPlannerViewModel {

    private final SessionPlannerControlsContentModel controlsContentModel = new SessionPlannerControlsContentModel();
    private final CatalogCrudControlsContentModel catalogContentModel = new CatalogCrudControlsContentModel();
    private final SessionPlannerTimelineMainContentModel timelineContentModel =
            new SessionPlannerTimelineMainContentModel();
    private final SessionPlannerStateContentModel stateContentModel = new SessionPlannerStateContentModel();
    private final SessionPlannerContributionModel contributionModel = new SessionPlannerContributionModel(
            controlsContentModel,
            catalogContentModel,
            stateContentModel);
    private final ReadOnlyObjectWrapper<ControlsProjection> controlsProjection =
            new ReadOnlyObjectWrapper<>(ControlsProjection.empty());
    private final ReadOnlyObjectWrapper<TimelineProjection> timelineProjection =
            new ReadOnlyObjectWrapper<>(TimelineProjection.empty());
    private final ReadOnlyObjectWrapper<StateProjection> stateProjection =
            new ReadOnlyObjectWrapper<>(StateProjection.empty());
    private SessionPlannerSessionSnapshot latestSession = SessionPlannerSessionSnapshot.empty("");
    private SessionPlannerParticipantsProjection latestParticipants = SessionPlannerParticipantsProjection.empty();

    SessionPlannerViewModel() {
        controlsContentModel.projectionProperty().addListener(
                (ignored, before, after) -> controlsProjection.set(ControlsProjection.from(after)));
        timelineContentModel.projectionProperty().addListener(
                (ignored, before, after) -> timelineProjection.set(TimelineProjection.from(after)));
        stateContentModel.projectionProperty().addListener(
                (ignored, before, after) -> stateProjection.set(StateProjection.from(after)));
        controlsProjection.set(ControlsProjection.from(controlsContentModel.projectionProperty().get()));
        timelineProjection.set(TimelineProjection.from(timelineContentModel.projectionProperty().get()));
        stateProjection.set(StateProjection.from(stateContentModel.projectionProperty().get()));
    }

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
        contributionModel.bindReadback(
                sessionModel,
                catalogModel,
                statePanelModel);
        sessionModel.subscribe(this::applySession);
        participantsModel.subscribe(this::applyParticipants);
        sceneTimelineModel.subscribe(this::applySceneTimeline);
        applySession(sessionModel.current());
        applyParticipants(participantsModel.current());
        applySceneTimeline(sceneTimelineModel.current());
    }

    boolean hasCurrentSession() {
        return controlsContentModel.hasCurrentSession();
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
        timelineContentModel.applySceneTimeline(sceneTimelineProjection);
    }

    void applyLocationReferences(List<SessionPlannerSessionSnapshot.LocationReference> locationReferences) {
        timelineContentModel.applyLocationReferences(locationReferences);
    }

    void applySetup(SetupState setupState) {
        timelineContentModel.applySetup(setupState == null
                ? SessionPlannerTimelineMainContentModel.SetupState.empty()
                : setupState.delegate());
    }

    private void applySession(SessionPlannerSessionSnapshot snapshot) {
        latestSession = snapshot == null ? SessionPlannerSessionSnapshot.empty("") : snapshot;
        applyLocationReferences(latestSession.locationReferences());
        applyTimelineSetup();
    }

    private void applyParticipants(SessionPlannerParticipantsProjection projection) {
        latestParticipants = projection == null ? SessionPlannerParticipantsProjection.empty() : projection;
        applyTimelineSetup();
    }

    private void applyTimelineSetup() {
        applySetup(SetupState.from(latestSession, latestParticipants));
    }

    void updateSceneDraft(long sceneToken, String sceneTitle, String sceneNotes, long locationId) {
        timelineContentModel.updateSceneDraft(sceneToken, sceneTitle, sceneNotes, locationId);
    }

    long participantChoiceId(int choiceIndex) {
        return timelineContentModel.participantChoiceId(choiceIndex);
    }

    BigDecimal budgetPercentage(long sceneToken) {
        return timelineContentModel.budgetPercentage(sceneToken);
    }

    TimelineWidgetKind widgetKind(long widgetToken) {
        return TimelineWidgetKind.from(timelineContentModel.widgetKind(widgetToken));
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

        static ControlsProjection from(SessionPlannerControlsContentModel.Projection projection) {
            SessionPlannerControlsContentModel.Projection safe =
                    projection == null ? SessionPlannerControlsContentModel.Projection.empty() : projection;
            return new ControlsProjection(
                    safe.statusText(),
                    new SessionModel(safe.session().sessionId()),
                    safe.availablePlans().stream()
                            .map(AvailablePlanModel::from)
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
                    SessionPlannerControlsContentModel.Projection.AvailablePlanModel plan
            ) {
                return new AvailablePlanModel(
                        plan.planId(),
                        plan.name(),
                        plan.summaryText(),
                        plan.statusText(),
                        plan.actionText(),
                        plan.actionStyleClass(),
                        plan.actionDisabled());
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

        static TimelineProjection from(SessionPlannerTimelineMainContentModel.Projection projection) {
            SessionPlannerTimelineMainContentModel.Projection safe =
                    projection == null ? SessionPlannerTimelineMainContentModel.Projection.empty() : projection;
            return new TimelineProjection(
                    SetupModel.from(safe.setup()),
                    safe.scenes().stream()
                            .map(SceneModel::from)
                            .toList(),
                    safe.restGaps().stream()
                            .map(RestGapModel::from)
                            .toList(),
                    safe.locationOptions().stream()
                            .map(LocationChoice::from)
                            .toList());
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
                return new SetupModel(true, "", "ca. 0 Szenen", "", "", 0L, 0L, 0L, List.of(), List.of());
            }

            static SetupModel from(SessionPlannerTimelineMainContentModel.Projection.SetupModel setup) {
                SessionPlannerTimelineMainContentModel.Projection.SetupModel safe =
                        setup == null ? SessionPlannerTimelineMainContentModel.Projection.SetupModel.empty() : setup;
                return new SetupModel(
                        safe.sessionActionsDisabled(),
                        safe.encounterDaysText(),
                        safe.sceneTargetText(),
                        safe.budgetText(),
                        safe.restText(),
                        safe.participantAddWidgetToken(),
                        safe.encounterDaysWidgetToken(),
                        safe.sceneAddWidgetToken(),
                        safe.partyMemberChoiceLabels(),
                        safe.sessionParticipantRows().stream()
                                .map(SessionParticipantModel::from)
                                .toList());
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

            static SessionParticipantModel from(
                    SessionPlannerTimelineMainContentModel.Projection.SessionParticipantModel participant
            ) {
                return new SessionParticipantModel(
                        participant.characterId(),
                        participant.name(),
                        participant.detail(),
                        participant.detailStyleClass(),
                        participant.removeWidgetToken(),
                        participant.removeText(),
                        participant.actionDisabled(),
                        participant.removeVisible());
            }
        }

        static final class SceneModel {

            private final SessionPlannerTimelineMainContentModel.Projection.SceneModel delegate;

            private SceneModel(SessionPlannerTimelineMainContentModel.Projection.SceneModel delegate) {
                this.delegate = Objects.requireNonNull(delegate, "delegate");
            }

            static SceneModel from(SessionPlannerTimelineMainContentModel.Projection.SceneModel scene) {
                return new SceneModel(scene);
            }

            long sceneToken() {
                return delegate.sceneToken();
            }

            String linkedEncounterName() {
                return delegate.linkedEncounterName();
            }

            boolean linkedEncounterPlan() {
                return delegate.linkedEncounterPlan();
            }

            String linkedEncounterGeneratedLabel() {
                return delegate.linkedEncounterGeneratedLabel();
            }

            int linkedEncounterCreatureCount() {
                return delegate.linkedEncounterCreatureCount();
            }

            int linkedEncounterTotalBaseXp() {
                return delegate.linkedEncounterTotalBaseXp();
            }

            double linkedEncounterXpMultiplier() {
                return delegate.linkedEncounterXpMultiplier();
            }

            String linkedEncounterDifficultyLabel() {
                return delegate.linkedEncounterDifficultyLabel();
            }

            String budgetPercentageText() {
                return delegate.budgetPercentageText();
            }

            String targetXpText() {
                return delegate.targetXpText();
            }

            String comparisonText() {
                return delegate.comparisonText();
            }

            boolean selected() {
                return delegate.selected();
            }

            boolean canMoveUp() {
                return delegate.canMoveUp();
            }

            boolean canMoveDown() {
                return delegate.canMoveDown();
            }

            String sceneTitle() {
                return delegate.sceneTitle();
            }

            String sceneNotes() {
                return delegate.sceneNotes();
            }

            long locationId() {
                return delegate.locationId();
            }

            String locationLabel() {
                return delegate.locationLabel();
            }

            List<LocationChoice> locationChoices() {
                return delegate.locationChoices().stream()
                        .map(LocationChoice::from)
                        .toList();
            }

            long selectWidgetToken() {
                return delegate.selectWidgetToken();
            }

            long allocationDecreaseWidgetToken() {
                return delegate.allocationDecreaseWidgetToken();
            }

            long allocationIncreaseWidgetToken() {
                return delegate.allocationIncreaseWidgetToken();
            }

            long moveUpWidgetToken() {
                return delegate.moveUpWidgetToken();
            }

            long moveDownWidgetToken() {
                return delegate.moveDownWidgetToken();
            }

            long removeWidgetToken() {
                return delegate.removeWidgetToken();
            }

            long sceneSaveWidgetToken() {
                return delegate.sceneSaveWidgetToken();
            }

            long sceneDraftWidgetToken() {
                return delegate.sceneDraftWidgetToken();
            }

            long addLootWidgetToken() {
                return delegate.addLootWidgetToken();
            }

            List<LootModel> lootPlaceholders() {
                return delegate.lootPlaceholders().stream()
                        .map(LootModel::from)
                        .toList();
            }
        }

        record LocationChoice(long id, String label) {

            LocationChoice {
                id = Math.max(0L, id);
                label = SessionPlannerVocabulary.text(label);
            }

            static LocationChoice from(SessionPlannerTimelineMainContentModel.Projection.LocationChoice choice) {
                return new LocationChoice(choice.id(), choice.label());
            }

            static LocationChoice from(SessionPlannerTimelineMainContentModel.LocationOption option) {
                return new LocationChoice(option.id(), option.name());
            }

            @Override
            public String toString() {
                return id <= 0L ? label : "#" + id + " | " + label;
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

            static RestGapModel from(SessionPlannerTimelineMainContentModel.Projection.RestGapModel gap) {
                return new RestGapModel(
                        gap.gapIndex(),
                        gap.leftSceneToken(),
                        gap.rightSceneToken(),
                        SessionPlannerVocabulary.text(gap.label()),
                        gap.hasAssignedRest(),
                        gap.shortRestWidgetToken(),
                        gap.longRestWidgetToken(),
                        gap.clearRestWidgetToken());
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

            static LootModel from(SessionPlannerTimelineMainContentModel.Projection.LootModel loot) {
                return new LootModel(loot.token(), loot.removeWidgetToken(), loot.label());
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
            return new StateProjection(
                    false,
                    "Keine Session-Szene ausgewaehlt",
                    "Waehle im Planner eine Szene aus, um den vorbereitenden State-Kontext zu sehen.",
                    "",
                    "",
                    "Katalog-Vorbereitung",
                    "Planner-owned read-only Placeholder.");
        }

        static StateProjection from(SessionPlannerStateContentModel.Projection projection) {
            SessionPlannerStateContentModel.Projection safe =
                    projection == null ? SessionPlannerStateContentModel.Projection.empty() : projection;
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
            SessionPlannerTimelineMainViewInputEvent legacyInput = new SessionPlannerTimelineMainViewInputEvent(
                    widgetToken,
                    sceneToken,
                    leftSceneToken,
                    rightSceneToken,
                    lootToken,
                    participantId,
                    participantChoiceIndex,
                    encounterDaysText,
                    sceneTitleText,
                    sceneNotesText,
                    locationId);
            widgetToken = legacyInput.widgetToken();
            sceneToken = legacyInput.sceneToken();
            leftSceneToken = legacyInput.leftSceneToken();
            rightSceneToken = legacyInput.rightSceneToken();
            lootToken = legacyInput.lootToken();
            participantId = legacyInput.participantId();
            participantChoiceIndex = legacyInput.participantChoiceIndex();
            encounterDaysText = legacyInput.encounterDaysText();
            sceneTitleText = legacyInput.sceneTitleText();
            sceneNotesText = legacyInput.sceneNotesText();
            locationId = legacyInput.locationId();
        }

    }

    record SetupState(SessionPlannerTimelineMainContentModel.SetupState delegate) {

        SetupState {
            delegate = delegate == null ? SessionPlannerTimelineMainContentModel.SetupState.empty() : delegate;
        }

        static SetupState from(
                SessionPlannerSessionSnapshot sessionSnapshot,
                SessionPlannerParticipantsProjection participantsProjection
        ) {
            return new SetupState(SessionPlannerTimelineMainContentModel.SetupState.from(
                    sessionSnapshot,
                    participantsProjection));
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
        SCENE_ADD;

        static TimelineWidgetKind from(SessionPlannerTimelineMainContentModel.TimelineWidgetKind kind) {
            return kind == null ? NONE : valueOf(kind.name());
        }
    }

    private static <T> List<T> safeCopy(List<T> values) {
        return values == null ? List.of() : List.copyOf(values);
    }
}
