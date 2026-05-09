# Explicit dead-code keep rules are the narrow fallback for runtime reachability
# that cannot be derived from JavaFX roots, contribution roots, FXML metadata,
# or META-INF/services providers.
#
# Add native ProGuard keep rules here only when a production runtime seam is
# intentionally dynamic and cannot be expressed through the structural scanners.
