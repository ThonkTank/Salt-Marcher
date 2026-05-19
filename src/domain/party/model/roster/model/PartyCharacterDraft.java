package src.domain.party.model.roster.model;

import java.util.Objects;
import org.jspecify.annotations.Nullable;

@SuppressWarnings("PMD.DataClass")
public final class PartyCharacterDraft {

    private final String name;
    private final String playerName;
    private final int level;
    private final int passivePerception;
    private final int armorClass;

    public PartyCharacterDraft(
            @Nullable String name,
            @Nullable String playerName,
            int level,
            int passivePerception,
            int armorClass
    ) {
        this.name = name == null ? "" : name.trim();
        this.playerName = playerName == null ? "" : playerName.trim();
        this.level = level;
        this.passivePerception = passivePerception;
        this.armorClass = armorClass;
    }

    public String name() {
        return name;
    }

    public String playerName() {
        return playerName;
    }

    public int level() {
        return level;
    }

    public int passivePerception() {
        return passivePerception;
    }

    public int armorClass() {
        return armorClass;
    }

    public boolean isValid() {
        return !name.isEmpty()
                && level >= 1
                && level <= 20
                && passivePerception >= 1
                && passivePerception <= 99
                && armorClass >= 1
                && armorClass <= 99;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof PartyCharacterDraft draft)) {
            return false;
        }
        return level == draft.level
                && passivePerception == draft.passivePerception
                && armorClass == draft.armorClass
                && name.equals(draft.name)
                && playerName.equals(draft.playerName);
    }

    @Override
    public int hashCode() {
        return Objects.hash(name, playerName, level, passivePerception, armorClass);
    }
}
