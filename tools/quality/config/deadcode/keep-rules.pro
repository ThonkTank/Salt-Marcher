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
