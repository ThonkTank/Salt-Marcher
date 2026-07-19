package platform.persistence;

/** Result of preparing one feature-owned SQLite schema. */
public enum FeatureStoreReadiness {
    READY,
    MIGRATION_FAILED,
    NEWER_SCHEMA,
    CORRUPT
}
