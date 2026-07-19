package platform.persistence;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.regex.Pattern;

/** Immutable schema definition for one feature-owned store in the shared database file. */
public record FeatureStoreDefinition(
        String owner,
        List<SqliteMigration> migrations,
        Validator validator
) {

    private static final Pattern OWNER_PATTERN = Pattern.compile("[a-z][a-z0-9-]*");

    public FeatureStoreDefinition {
        owner = normalizeOwner(owner);
        migrations = normalizeMigrations(migrations);
        validator = Objects.requireNonNull(validator, "validator");
    }

    public static FeatureStoreDefinition of(String owner, SqliteMigration... migrations) {
        return new FeatureStoreDefinition(
                owner,
                Arrays.asList(migrations == null ? new SqliteMigration[0] : migrations),
                connection -> { });
    }

    public static FeatureStoreDefinition validated(
            String owner,
            Validator validator,
            SqliteMigration... migrations
    ) {
        return new FeatureStoreDefinition(
                owner,
                Arrays.asList(migrations == null ? new SqliteMigration[0] : migrations),
                validator);
    }

    int supportedVersion() {
        return migrations.isEmpty() ? 0 : migrations.getLast().version();
    }

    private static String normalizeOwner(String owner) {
        String safeOwner = Objects.requireNonNull(owner, "owner").toLowerCase(Locale.ROOT);
        if (!OWNER_PATTERN.matcher(safeOwner).matches()) {
            throw new IllegalArgumentException("invalid migration owner");
        }
        return safeOwner;
    }

    private static List<SqliteMigration> normalizeMigrations(List<SqliteMigration> migrations) {
        List<SqliteMigration> plan = new ArrayList<>(Objects.requireNonNull(migrations, "migrations"));
        if (plan.stream().anyMatch(Objects::isNull)) {
            throw new IllegalArgumentException("migration plan must not contain null");
        }
        plan.sort(Comparator.comparingInt(SqliteMigration::version));
        int expected = 1;
        for (SqliteMigration migration : plan) {
            if (migration.version() != expected++) {
                throw new IllegalArgumentException("migration versions must be contiguous from one");
            }
        }
        return List.copyOf(plan);
    }

    @FunctionalInterface
    public interface Validator {
        void validate(Connection connection) throws SQLException;
    }
}
