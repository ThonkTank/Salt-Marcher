package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;

public record SessionPlannerTimelineMainViewInputEvent(
        SelectionSnapshot selection,
        MutationSnapshot mutation,
        RestSnapshot rest,
        LootSnapshot loot,
        SceneSnapshot scene,
        SceneDraftSnapshot sceneDraft,
        SetupSnapshot setup
) {

    public SessionPlannerTimelineMainViewInputEvent(SelectionSnapshot selection) {
        this(
                selection,
                new MutationSnapshot(0L, 0, 0L),
                new RestSnapshot(0L, 0L, RestSelection.NONE),
                new LootSnapshot(0L, 0L),
                new SceneSnapshot(0L, "", "", 0L),
                new SceneDraftSnapshot(0L, "", "", 0L),
                new SetupSnapshot(-1, 0L, "", false));
    }

    public SessionPlannerTimelineMainViewInputEvent(MutationSnapshot mutation) {
        this(
                new SelectionSnapshot(0L, 0L, BigDecimal.ZERO),
                mutation,
                new RestSnapshot(0L, 0L, RestSelection.NONE),
                new LootSnapshot(0L, 0L),
                new SceneSnapshot(0L, "", "", 0L),
                new SceneDraftSnapshot(0L, "", "", 0L),
                new SetupSnapshot(-1, 0L, "", false));
    }

    public SessionPlannerTimelineMainViewInputEvent(RestSnapshot rest) {
        this(
                new SelectionSnapshot(0L, 0L, BigDecimal.ZERO),
                new MutationSnapshot(0L, 0, 0L),
                rest,
                new LootSnapshot(0L, 0L),
                new SceneSnapshot(0L, "", "", 0L),
                new SceneDraftSnapshot(0L, "", "", 0L),
                new SetupSnapshot(-1, 0L, "", false));
    }

    public SessionPlannerTimelineMainViewInputEvent(LootSnapshot loot) {
        this(
                new SelectionSnapshot(0L, 0L, BigDecimal.ZERO),
                new MutationSnapshot(0L, 0, 0L),
                new RestSnapshot(0L, 0L, RestSelection.NONE),
                loot,
                new SceneSnapshot(0L, "", "", 0L),
                new SceneDraftSnapshot(0L, "", "", 0L),
                new SetupSnapshot(-1, 0L, "", false));
    }

    public SessionPlannerTimelineMainViewInputEvent(SceneSnapshot scene) {
        this(
                new SelectionSnapshot(0L, 0L, BigDecimal.ZERO),
                new MutationSnapshot(0L, 0, 0L),
                new RestSnapshot(0L, 0L, RestSelection.NONE),
                new LootSnapshot(0L, 0L),
                scene,
                new SceneDraftSnapshot(0L, "", "", 0L),
                new SetupSnapshot(-1, 0L, "", false));
    }

    public SessionPlannerTimelineMainViewInputEvent(SceneDraftSnapshot sceneDraft) {
        this(
                new SelectionSnapshot(0L, 0L, BigDecimal.ZERO),
                new MutationSnapshot(0L, 0, 0L),
                new RestSnapshot(0L, 0L, RestSelection.NONE),
                new LootSnapshot(0L, 0L),
                new SceneSnapshot(0L, "", "", 0L),
                sceneDraft,
                new SetupSnapshot(-1, 0L, "", false));
    }

    public SessionPlannerTimelineMainViewInputEvent(SetupSnapshot setup) {
        this(
                new SelectionSnapshot(0L, 0L, BigDecimal.ZERO),
                new MutationSnapshot(0L, 0, 0L),
                new RestSnapshot(0L, 0L, RestSelection.NONE),
                new LootSnapshot(0L, 0L),
                new SceneSnapshot(0L, "", "", 0L),
                new SceneDraftSnapshot(0L, "", "", 0L),
                setup);
    }

    public SessionPlannerTimelineMainViewInputEvent {
        selection = selection == null ? new SelectionSnapshot(0L, 0L, BigDecimal.ZERO) : selection;
        mutation = mutation == null ? new MutationSnapshot(0L, 0, 0L) : mutation;
        rest = rest == null ? new RestSnapshot(0L, 0L, RestSelection.NONE) : rest;
        loot = loot == null ? new LootSnapshot(0L, 0L) : loot;
        scene = scene == null ? new SceneSnapshot(0L, "", "", 0L) : scene;
        sceneDraft = sceneDraft == null ? new SceneDraftSnapshot(0L, "", "", 0L) : sceneDraft;
        setup = setup == null ? new SetupSnapshot(-1, 0L, "", false) : setup;
    }

    record SelectionSnapshot(
            long selectedSceneToken,
            long allocationSceneToken,
            BigDecimal targetAllocationPercentage
    ) {

        SelectionSnapshot {
            selectedSceneToken = Math.max(0L, selectedSceneToken);
            allocationSceneToken = Math.max(0L, allocationSceneToken);
            targetAllocationPercentage = targetAllocationPercentage == null
                    ? BigDecimal.ZERO
                    : targetAllocationPercentage;
        }
    }

    record MutationSnapshot(
            long moveSceneToken,
            int moveDirection,
            long sceneTokenToRemove
    ) {

        MutationSnapshot {
            moveSceneToken = Math.max(0L, moveSceneToken);
            moveDirection = Integer.compare(moveDirection, 0);
            sceneTokenToRemove = Math.max(0L, sceneTokenToRemove);
        }
    }

    record RestSnapshot(
            long leftSceneToken,
            long rightSceneToken,
            RestSelection selection
    ) {

        RestSnapshot(long leftSceneToken, long rightSceneToken, boolean shortRest, boolean longRest) {
            this(leftSceneToken, rightSceneToken, shortRest
                    ? RestSelection.SHORT_REST
                    : longRest ? RestSelection.LONG_REST : RestSelection.NONE);
        }

        RestSnapshot {
            leftSceneToken = Math.max(0L, leftSceneToken);
            rightSceneToken = Math.max(0L, rightSceneToken);
            selection = selection == null ? RestSelection.NONE : selection;
        }
    }

    enum RestSelection {
        NONE,
        SHORT_REST,
        LONG_REST
    }

    record LootSnapshot(
            long sceneTokenToAdd,
            long tokenToRemove
    ) {

        LootSnapshot {
            sceneTokenToAdd = Math.max(0L, sceneTokenToAdd);
            tokenToRemove = Math.max(0L, tokenToRemove);
        }
    }

    record SceneSnapshot(
            long sceneToken,
            String title,
            String notes,
            long locationId
    ) {

        SceneSnapshot {
            sceneToken = Math.max(0L, sceneToken);
            title = title == null ? "" : title.trim();
            notes = notes == null ? "" : notes.trim();
            locationId = Math.max(0L, locationId);
        }
    }

    record SceneDraftSnapshot(
            long sceneToken,
            String title,
            String notes,
            long locationId
    ) {

        SceneDraftSnapshot {
            sceneToken = Math.max(0L, sceneToken);
            title = title == null ? "" : title;
            notes = notes == null ? "" : notes;
            locationId = Math.max(0L, locationId);
        }
    }

    record SetupSnapshot(
            int participantChoiceIndex,
            long participantToRemoveId,
            String encounterDaysText,
            boolean addSceneRequested
    ) {

        SetupSnapshot {
            participantChoiceIndex = Math.max(-1, participantChoiceIndex);
            participantToRemoveId = Math.max(0L, participantToRemoveId);
            encounterDaysText = encounterDaysText == null ? "" : encounterDaysText.trim();
        }
    }
}
