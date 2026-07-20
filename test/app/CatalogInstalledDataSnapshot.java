package app;

import platform.persistence.SqliteDatabase;

import java.nio.file.Path;

/** Operator-invoked creation of the isolated copy consumed by Catalog migration rehearsal. */
public final class CatalogInstalledDataSnapshot {

    private CatalogInstalledDataSnapshot() {}

    public static void main(String[] arguments) throws Exception {
        if (arguments.length != 2) {
            throw new IllegalArgumentException(
                    "Expected absolute source and new snapshot database paths.");
        }
        Path source = absolutePath(arguments[0], "source");
        Path target = absolutePath(arguments[1], "target");
        SqliteDatabase.createVerifiedSnapshot(source, target);
        System.out.println("CATALOG_SNAPSHOT_READY");
    }

    private static Path absolutePath(String value, String role) {
        Path path = Path.of(value);
        if (!path.isAbsolute()) {
            throw new IllegalArgumentException("Catalog snapshot " + role + " path must be absolute.");
        }
        return path.normalize();
    }
}
