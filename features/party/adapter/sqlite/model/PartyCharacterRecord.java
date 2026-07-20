package features.party.adapter.sqlite.model;

import org.jspecify.annotations.Nullable;

public record PartyCharacterRecord(
        long id,
        Identity identity,
        Progress progress,
        Combat combat,
        String membership,
        Travel travel
) {
    public record Identity(String name, String playerName) {
    }

    public record Progress(
            int level,
            int currentXp,
            int xpSinceLongRest,
            int xpSinceShortRest,
            int shortRestsTakenSinceLongRest
    ) {
    }

    public record Combat(int passivePerception, int armorClass) {
    }

    public record Travel(
            String locationKind,
            @Nullable Long dungeonMapId,
            String dungeonLocationKind,
            @Nullable Long dungeonOwnerId,
            @Nullable Integer dungeonQ,
            @Nullable Integer dungeonR,
            @Nullable Integer dungeonLevel,
            String dungeonHeading,
            @Nullable Long overworldMapId,
            @Nullable Long overworldTileId,
            boolean attachedToPartyToken
    ) {
        public Travel {
            locationKind = locationKind == null ? "" : locationKind.trim();
            dungeonLocationKind = dungeonLocationKind == null ? "" : dungeonLocationKind.trim();
            dungeonHeading = dungeonHeading == null ? "" : dungeonHeading.trim();
        }
    }
}
