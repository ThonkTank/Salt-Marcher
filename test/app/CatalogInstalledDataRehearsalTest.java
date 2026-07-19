package app;

import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

import platform.persistence.SqliteDatabase;

import java.nio.file.Files;
import java.nio.file.Path;

final class CatalogInstalledDataRehearsalTest {

    @Test
    void requiresOneExplicitAbsoluteCopyPath() {
        assertThrows(
                IllegalArgumentException.class,
                () -> CatalogInstalledDataRehearsal.main(new String[0]));
        assertThrows(
                IllegalArgumentException.class,
                () -> CatalogInstalledDataRehearsal.main(new String[] {"relative.db"}));
    }

    @Test
    void refusesAnyDatabaseInsideTheInstalledApplicationDataDirectory() throws Exception {
        Path installed = SqliteDatabase.resolveDatabasePath(
                SqliteDatabase.DEFAULT_DATABASE_FILE_NAME);
        Files.createDirectories(installed.getParent());
        Files.writeString(installed, "proof-only");

        assertThrows(
                IllegalArgumentException.class,
                () -> CatalogInstalledDataRehearsal.main(
                        new String[] {installed.toString()}));
    }
}
