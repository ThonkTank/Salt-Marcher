package src.domain.party.entity;

import src.domain.party.partyAPI;
import src.domain.party.valueobject.PartyMembership;
import src.domain.party.valueobject.PartyRestType;
import src.domain.party.valueobject.PartyXpTables;

import java.util.Objects;

public final class PartyCharacter {

    private final long id;
    private final String name;
    private final String playerName;
    private final int level;
    private final int currentXp;
    private final int xpSinceLongRest;
    private final int xpSinceShortRest;
    private final int passivePerception;
    private final int armorClass;
    private final PartyMembership membership;

    public PartyCharacter(
            long id,
            String name,
            String playerName,
            int level,
            int currentXp,
            int xpSinceLongRest,
            int xpSinceShortRest,
            int passivePerception,
            int armorClass,
            PartyMembership membership
    ) {
        this.id = Math.max(1L, id);
        this.name = normalizeName(name);
        this.playerName = normalizeOptional(playerName);
        this.level = PartyXpTables.clampLevel(level);
        this.currentXp = Math.max(0, currentXp);
        this.xpSinceLongRest = Math.max(0, xpSinceLongRest);
        this.xpSinceShortRest = Math.max(0, xpSinceShortRest);
        this.passivePerception = clampStat(passivePerception);
        this.armorClass = clampStat(armorClass);
        this.membership = Objects.requireNonNullElse(membership, PartyMembership.RESERVE);
    }

    public long id() {
        return id;
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

    public int currentXp() {
        return currentXp;
    }

    public int xpSinceLongRest() {
        return xpSinceLongRest;
    }

    public int xpSinceShortRest() {
        return xpSinceShortRest;
    }

    public int passivePerception() {
        return passivePerception;
    }

    public int armorClass() {
        return armorClass;
    }

    public PartyMembership membership() {
        return membership;
    }

    public boolean isActive() {
        return membership == PartyMembership.ACTIVE;
    }

    public int xpToNextLevel() {
        return PartyXpTables.xpToNextLevel(level, currentXp);
    }

    public boolean readyToLevel() {
        return PartyXpTables.readyToLevel(level, currentXp);
    }

    public PartyCharacter update(partyAPI.CharacterDraft draft) {
        return new PartyCharacter(
                id,
                draft.name(),
                draft.playerName(),
                draft.level(),
                PartyXpTables.normalizeCurrentXpForLevel(draft.level(), currentXp),
                xpSinceLongRest,
                xpSinceShortRest,
                draft.passivePerception(),
                draft.armorClass(),
                membership);
    }

    public PartyCharacter withMembership(PartyMembership nextMembership) {
        return new PartyCharacter(
                id,
                name,
                playerName,
                level,
                currentXp,
                xpSinceLongRest,
                xpSinceShortRest,
                passivePerception,
                armorClass,
                nextMembership);
    }

    public PartyCharacter awardXp(int xpAmount) {
        int safeXp = Math.max(0, xpAmount);
        return new PartyCharacter(
                id,
                name,
                playerName,
                level,
                currentXp + safeXp,
                xpSinceLongRest + safeXp,
                xpSinceShortRest + safeXp,
                passivePerception,
                armorClass,
                membership);
    }

    public PartyCharacter afterRest(PartyRestType restType) {
        return switch (restType) {
            case SHORT_REST -> new PartyCharacter(
                    id,
                    name,
                    playerName,
                    level,
                    currentXp,
                    xpSinceLongRest,
                    0,
                    passivePerception,
                    armorClass,
                    membership);
            case LONG_REST -> new PartyCharacter(
                    id,
                    name,
                    playerName,
                    level,
                    currentXp,
                    0,
                    0,
                    passivePerception,
                    armorClass,
                    membership);
        };
    }

    private static String normalizeName(String value) {
        String normalized = normalizeOptional(value);
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("Character name must not be blank.");
        }
        return normalized;
    }

    private static String normalizeOptional(String value) {
        return value == null ? "" : value.trim();
    }

    private static int clampStat(int value) {
        return Math.max(1, Math.min(99, value));
    }
}
