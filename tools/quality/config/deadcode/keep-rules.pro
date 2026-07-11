# Explicit dead-code keep rules are the narrow fallback for runtime reachability
# that cannot be derived from JavaFX roots, contribution roots, FXML metadata,
# or META-INF/services providers.
#
# Add native ProGuard keep rules here only when a production runtime seam is
# intentionally dynamic and cannot be expressed through the structural scanners.

# M2 Hex migration: keep the published model compatibility constructors named
# by docs/project/architecture/architecture-migration-hex-target-design.md.
-keepclassmembers class src.domain.hex.published.HexEditorModel {
    public <init>(java.util.function.Supplier,java.util.function.Function);
}
-keepclassmembers class src.domain.hex.published.HexTravelModel {
    public <init>(java.util.function.Supplier,java.util.function.Function);
}

# M3 Party migration: keep byte-compatible published helper accessors named by
# docs/project/architecture/architecture-migration-party-target-design.md while
# adjacent consumers migrate independently.
-keepclassmembers class src.domain.party.published.CreateCharacterCommand {
    public java.lang.String membershipName();
}
-keepclassmembers class src.domain.party.published.SetPartyMembershipCommand {
    public java.lang.String membershipName();
}
-keepclassmembers class src.domain.party.published.PerformPartyRestCommand {
    public java.lang.String restTypeName();
}
-keepclassmembers interface src.domain.party.published.PartyTravelLocationSnapshot {
    public long mapId();
    public boolean isDungeon();
    public boolean isOverworld();
    public java.lang.String dungeonLocationKindName();
    public long dungeonOwnerId();
    public int dungeonTileQ();
    public int dungeonTileR();
    public int dungeonTileLevel();
    public java.lang.String dungeonHeadingName();
    public long overworldTileId();
}
-keepclassmembers class src.domain.party.published.PartyDungeonTravelLocationSnapshot {
    public boolean isDungeon();
    public java.lang.String dungeonLocationKindName();
    public long dungeonOwnerId();
    public int dungeonTileQ();
    public int dungeonTileR();
    public int dungeonTileLevel();
    public java.lang.String dungeonHeadingName();
}
-keepclassmembers class src.domain.party.published.PartyOverworldTravelLocationSnapshot {
    public boolean isOverworld();
    public long overworldTileId();
}

# M4.3 Dungeon Travel migration: direct refresh is the behavior-parity service
# seam used by harnesses. The Travel tab must not auto-refresh during migration,
# because that would change the existing first-bind visible state.
-keepclassmembers class src.domain.dungeon.DungeonTravelRuntimeApplicationService {
    public void refresh();
}
