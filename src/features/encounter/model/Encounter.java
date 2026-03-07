package features.encounter.model;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Immutable encounter snapshot returned by {@link features.encounter.service.generation.EncounterGenerator}.
 * Slots are defensively copied and exposed as read-only snapshots.
 */
public record Encounter(
    List<EncounterSlot> slots,
    String difficulty,
    int averageLevel,
    int partySize,
    int xpBudget,
    /** Human-readable encounter shape from {@link features.encounter.service.generation.EncounterScoring#deriveShapeLabel}. */
    String shapeLabel
) {
    public Encounter {
        List<EncounterSlot> safeSlots = new ArrayList<>();
        if (slots != null) {
            for (EncounterSlot slot : slots) {
                if (slot != null) {
                    safeSlots.add(slot.copy());
                }
            }
        }
        slots = Collections.unmodifiableList(safeSlots);
    }

    @Override
    public List<EncounterSlot> slots() {
        List<EncounterSlot> snapshot = new ArrayList<>(slots.size());
        for (EncounterSlot slot : slots) {
            snapshot.add(slot.copy());
        }
        return Collections.unmodifiableList(snapshot);
    }
}
