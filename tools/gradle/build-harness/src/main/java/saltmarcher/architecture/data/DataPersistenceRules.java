package saltmarcher.architecture.data;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.SourceKind;
import saltmarcher.architecture.ViolationSink;

public final class DataPersistenceRules implements ArchitectureRule {

    private static final Pattern SCHEMA_TABLE_NAME_PATTERN =
            Pattern.compile("\\btable\\s*\\(\\s*\"([^\"]+)\"");
    private static final Pattern SCHEMA_TABLE_CONSTANT_PATTERN =
            Pattern.compile("\\b[A-Z][A-Z0-9_]*_TABLE\\s*=\\s*\"([^\"]+)\"");
    private static final Pattern SCHEMA_CREATE_TABLE_PATTERN =
            Pattern.compile("\\bCREATE\\s+(?:TEMP\\s+)?TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?([A-Za-z_][A-Za-z0-9_]*)\\b",
                    Pattern.CASE_INSENSITIVE);
    private static final Pattern JAVA_STRING_LITERAL_PATTERN =
            Pattern.compile("\"(?:\\\\.|[^\"\\\\])*\"");
    private static final Pattern SQL_TABLE_REFERENCE_PATTERN =
            Pattern.compile("\\b(?:FROM|JOIN|INTO|UPDATE|TABLE|REFERENCES)\\b");

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
                violations.add("src/data/" + featureName, "data-feature-composition-root-presence",
                        "Persistence-exporting data feature '" + featureName + "' must expose exactly one composition adapter root."
                                + " Found: " + files);
            }

            if (schemas.size() != 1) {
                String files = schemas.isEmpty()
                        ? "none found"
                        : schemas.stream().map(SourceFile::relativePath).collect(Collectors.joining(", "));
                violations.add("src/data/" + featureName, "data-feature-schema-contract",
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
            Set<String> tableNames = tableNamesByFeature.computeIfAbsent(
                    sourceFile.featureName(),
                    ignored -> new TreeSet<>());
            collectMatches(SCHEMA_TABLE_NAME_PATTERN, sourceFile.content(), tableNames);
            collectMatches(SCHEMA_TABLE_CONSTANT_PATTERN, sourceFile.content(), tableNames);
            collectMatches(SCHEMA_CREATE_TABLE_PATTERN, sourceFile.content(), tableNames);
        }

        for (SourceFile sourceFile : sourceFiles) {
            if (!sourceFile.isUnderDataFeatureRoot() || sourceFile.kind() == SourceKind.DATA_SCHEMA) {
                continue;
            }
            Set<String> tableNames = tableNamesByFeature.getOrDefault(sourceFile.featureName(), Set.of());
            Matcher stringLiteralMatcher = JAVA_STRING_LITERAL_PATTERN.matcher(sourceFile.content());
            while (stringLiteralMatcher.find()) {
                String literal = unquoteJavaStringLiteral(stringLiteralMatcher.group());
                if (!SQL_TABLE_REFERENCE_PATTERN.matcher(literal).find()) {
                    continue;
                }
                for (String tableName : tableNames) {
                    if (containsTableName(literal, tableName)) {
                        violations.add(sourceFile.relativePath(), "data-schema-table-name-owned-by-schema",
                                "Table name literal '" + tableName
                                        + "' must be owned by the feature persistence schema. Reference the schema constant instead of duplicating the literal.");
                    }
                }
            }
        }
    }

    private static void collectMatches(Pattern pattern, String content, Set<String> matches) {
        Matcher matcher = pattern.matcher(content);
        while (matcher.find()) {
            matches.add(matcher.group(1));
        }
    }

    private static String unquoteJavaStringLiteral(String literal) {
        if (literal.length() < 2) {
            return literal;
        }
        return literal.substring(1, literal.length() - 1);
    }

    private static boolean containsTableName(String literal, String tableName) {
        return Pattern.compile("(?i)(?<![A-Za-z0-9_])" + Pattern.quote(tableName) + "(?![A-Za-z0-9_])")
                .matcher(literal)
                .find();
    }
}
