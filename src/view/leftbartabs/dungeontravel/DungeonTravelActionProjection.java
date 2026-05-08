package src.view.leftbartabs.dungeontravel;

record DungeonTravelActionProjection(
        String actionId,
        String label,
        String description
) {

    DungeonTravelActionProjection {
        actionId = actionId == null ? "" : actionId.trim();
        label = label == null || label.isBlank() ? DungeonTravelUiText.DEFAULT_ACTION_LABEL : label.trim();
        description = description == null ? "" : description.trim();
    }
}
