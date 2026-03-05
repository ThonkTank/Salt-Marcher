package entities;

import java.util.List;

/**
 * Immutable encounter snapshot returned by {@link services.EncounterGenerator}.
 * {@code slots} is the one mutable element; all other components are set at construction
 * and never reassigned.
 */
public record Encounter(
    List<EncounterSlot> slots,
    String difficulty,
    int averageLevel,
    int partySize,
    int xpBudget,
    /** Human-readable encounter shape from {@link services.EncounterTemplate#deriveLabel}, e.g. "Einzelgegner", "Schwarm", "Anführer + Schergen". */
    String shapeLabel
) {}
