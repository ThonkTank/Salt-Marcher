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

    @Test
    void refusesSymlinkResolvingInsideTheInstalledApplicationDataDirectory() throws Exception {
        Path installed = SqliteDatabase.resolveDatabasePath(
                SqliteDatabase.DEFAULT_DATABASE_FILE_NAME);
        Files.createDirectories(installed.getParent());
        Path otherInstalledDatabase = installed.resolveSibling("other.db");
        Files.writeString(otherInstalledDatabase, "proof-only");
        Path aliasDirectory = Files.createTempDirectory(
                installed.getParent().getParent(), "catalog-rehearsal-alias-");
        Path alias = aliasDirectory.resolve("outside.db");
        try {
            Files.createSymbolicLink(alias, otherInstalledDatabase);

            assertThrows(
                    IllegalArgumentException.class,
                    () -> CatalogInstalledDataRehearsal.main(
                            new String[] {alias.toString()}));
        } finally {
            Files.deleteIfExists(alias);
            Files.deleteIfExists(aliasDirectory);
        }
    }

    @Test
    void refusesHardlinkToTheInstalledDatabaseOutsideTheApplicationDataDirectory()
            throws Exception {
        Path installed = SqliteDatabase.resolveDatabasePath(
                SqliteDatabase.DEFAULT_DATABASE_FILE_NAME);
        Files.createDirectories(installed.getParent());
        Files.writeString(installed, "proof-only");
        Path aliasDirectory = Files.createTempDirectory(
                installed.getParent().getParent(), "catalog-rehearsal-alias-");
        Path alias = aliasDirectory.resolve("outside.db");
        try {
            Files.createLink(alias, installed);

            assertThrows(
                    IllegalArgumentException.class,
                    () -> CatalogInstalledDataRehearsal.main(
                            new String[] {alias.toString()}));
        } finally {
            Files.deleteIfExists(alias);
            Files.deleteIfExists(aliasDirectory);
        }
    }
}
