package features.party.domain.roster;

import java.util.Objects;
import org.jspecify.annotations.Nullable;

public final class PartyCharacterDraft {

    private final String name;
    private final @Nullable String playerName;
    private final @Nullable Integer level;
    private final @Nullable Integer passivePerception;
    private final @Nullable Integer armorClass;

    public PartyCharacterDraft(
            @Nullable String name,
            @Nullable String playerName,
            @Nullable Integer level,
            @Nullable Integer passivePerception,
            @Nullable Integer armorClass
    ) {
        this.name = name == null ? "" : name.trim();
        this.playerName = normalizeOptional(playerName);
        this.level = level;
        this.passivePerception = passivePerception;
        this.armorClass = armorClass;
    }

    public String name() {
        return name;
    }

    public @Nullable String playerName() {
        return playerName;
    }

    public @Nullable Integer level() {
        return level;
    }

    public @Nullable Integer passivePerception() {
        return passivePerception;
    }

    public @Nullable Integer armorClass() {
        return armorClass;
    }

    public boolean isValid() {
        return !name.isEmpty()
                && inRangeWhenPresent(level, 1, 20)
                && inRangeWhenPresent(passivePerception, 1, 99)
                && inRangeWhenPresent(armorClass, 1, 99);
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof PartyCharacterDraft draft)) {
            return false;
        }
        return Objects.equals(level, draft.level)
                && Objects.equals(passivePerception, draft.passivePerception)
                && Objects.equals(armorClass, draft.armorClass)
                && name.equals(draft.name)
                && Objects.equals(playerName, draft.playerName);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, playerName, level, passivePerception, armorClass);
    }

    private static @Nullable String normalizeOptional(@Nullable String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private static boolean inRangeWhenPresent(@Nullable Integer value, int minimum, int maximum) {
        return value == null || value >= minimum && value <= maximum;
    }
}
