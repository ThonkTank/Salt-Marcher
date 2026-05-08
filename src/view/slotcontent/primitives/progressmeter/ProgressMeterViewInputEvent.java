package src.view.slotcontent.primitives.progressmeter;

public record ProgressMeterViewInputEvent(
        String actionId,
        int amount
) {

    public ProgressMeterViewInputEvent {
        actionId = actionId == null ? "" : actionId;
        amount = Math.max(1, amount);
    }
}
