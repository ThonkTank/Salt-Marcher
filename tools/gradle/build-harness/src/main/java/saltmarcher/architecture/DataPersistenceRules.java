package saltmarcher.architecture;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

final class DataPersistenceRules implements ArchitectureRule {

    private static final Pattern SCHEMA_TABLE_NAME_PATTERN =
            Pattern.compile("\\btable\\s*\\(\\s*\"([^\"]+)\"");

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        List<SourceFile> sourceFiles = context.sourceFiles(violations);
        validatePersistenceEntrypoints(context, sourceFiles, violations);
        validateSchemaTableNameOwnership(sourceFiles, violations);
    }

    private void validatePersistenceEntrypoints(
            ArchitectureContext context,
            List<SourceFile> sourceFiles,
            ViolationSink violations) {
        TreeMap<String, List<SourceFile>> rootsByFeature = new TreeMap<>();
        TreeMap<String, List<SourceFile>> schemasByFeature = new TreeMap<>();
        for (SourceFile sourceFile : sourceFiles) {
            if (sourceFile.kind() == SourceKind.DATA_ROOT) {
                rootsByFeature.computeIfAbsent(sourceFile.featureName(), ignored -> new ArrayList<>()).add(sourceFile);
            }
            if (sourceFile.kind() == SourceKind.DATA_SCHEMA) {
                schemasByFeature.computeIfAbsent(sourceFile.featureName(), ignored -> new ArrayList<>()).add(sourceFile);
            }
        }

        for (String featureName : context.dataFeatures(violations)) {
            List<SourceFile> roots = rootsByFeature.getOrDefault(featureName, List.of()).stream()
                    .sorted(Comparator.comparing(SourceFile::relativePath))
                    .toList();
            List<SourceFile> schemas = schemasByFeature.getOrDefault(featureName, List.of()).stream()
                    .sorted(Comparator.comparing(SourceFile::relativePath))
                    .toList();

            if (roots.size() != 1) {
                String files = roots.isEmpty()
                        ? "none found"
                        : roots.stream().map(SourceFile::relativePath).collect(Collectors.joining(", "));
                violations.add("src/data/" + featureName, "persistence-root-entrypoint",
                        "Persistence-exporting data feature '" + featureName + "' must expose exactly one composition adapter root."
                                + " Found: " + files);
            }

            if (schemas.size() != 1) {
                String files = schemas.isEmpty()
                        ? "none found"
                        : schemas.stream().map(SourceFile::relativePath).collect(Collectors.joining(", "));
                violations.add("src/data/" + featureName, "persistence-schema-contract",
                        "Persistence-exporting data feature '" + featureName + "' must expose exactly one source-model schema declaration."
                                + " Found: " + files);
            }
        }
    }

    private void validateSchemaTableNameOwnership(List<SourceFile> sourceFiles, ViolationSink violations) {
        TreeMap<String, Set<String>> tableNamesByFeature = new TreeMap<>();
        for (SourceFile sourceFile : sourceFiles) {
            if (sourceFile.kind() != SourceKind.DATA_SCHEMA) {
                continue;
            }
            Matcher matcher = SCHEMA_TABLE_NAME_PATTERN.matcher(sourceFile.content());
            while (matcher.find()) {
                tableNamesByFeature
                        .computeIfAbsent(sourceFile.featureName(), ignored -> new TreeSet<>())
                        .add(matcher.group(1));
            }
        }

        for (SourceFile sourceFile : sourceFiles) {
            if (!sourceFile.isUnderDataFeatureRoot() || sourceFile.kind() == SourceKind.DATA_SCHEMA) {
                continue;
            }
            Set<String> tableNames = tableNamesByFeature.getOrDefault(sourceFile.featureName(), Set.of());
            for (String tableName : tableNames) {
                if (sourceFile.content().contains("\"" + tableName + "\"")) {
                    violations.add(sourceFile.relativePath(), "data-schema-table-name-owned-by-schema",
                            "Table name literal '" + tableName
                                    + "' must be owned by the feature persistence schema. Reference the schema constant instead of duplicating the literal.");
                }
            }
        }
    }
}
