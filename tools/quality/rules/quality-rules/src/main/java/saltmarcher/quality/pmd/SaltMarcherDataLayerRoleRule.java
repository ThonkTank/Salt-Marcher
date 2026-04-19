package saltmarcher.quality.pmd;

import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;

public final class SaltMarcherDataLayerRoleRule extends AbstractJavaRule {

    private static final Pattern PUBLIC_OR_PROTECTED_METHOD_PATTERN = Pattern.compile(
            "(?m)^\\s*(?:public|protected)\\s+(?:final\\s+)?[A-Za-z0-9_<>, ?.@]+\\s+([A-Za-z_][A-Za-z0-9_]*)\\s*\\(");
    private static final Pattern SCHEMA_DDL_LITERAL_PATTERN = Pattern.compile(
            "\"[^\"]*\\b(?:CREATE\\s+(?:TABLE|INDEX|UNIQUE\\s+INDEX)|ALTER\\s+TABLE|DROP\\s+TABLE)\\b[^\"]*\"",
            Pattern.CASE_INSENSITIVE);
    private static final Set<String> CONCRETE_SOURCE_TOKENS = Set.of(
            "java.sql.",
            "javax.sql.",
            "java.net.http.",
            "okhttp3.",
            "retrofit2.",
            "java.nio.file.",
            "java.io.File");
    private static final Set<String> QUERY_MUTATION_METHOD_PREFIXES = Set.of(
            "add",
            "create",
            "delete",
            "insert",
            "mutate",
            "persist",
            "remove",
            "save",
            "set",
            "store",
            "update",
            "upsert",
            "write");

    @Override
    public Object visit(ASTCompilationUnit node, Object data) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(node);
        if (!sourceFacts.isUnderMainSourceRoots()) {
            return data;
        }

        if (sourceFacts.isDataSource()) {
            if (isRepositoryQueryOrMapper(sourceFacts)) {
                validateNoConcreteSourceMechanics(node, data, sourceFacts);
            }
            if (isQuery(sourceFacts)) {
                validateQueryReadOnlyShape(node, data, sourceFacts);
            }
        }
        validateSchemaDdlPlacement(node, data, sourceFacts);
        return data;
    }

    private void validateNoConcreteSourceMechanics(
            ASTCompilationUnit node,
            Object data,
            SaltMarcherSourceFacts sourceFacts
    ) {
        for (String token : CONCRETE_SOURCE_TOKENS) {
            if (sourceFacts.text().contains(token)) {
                asCtx(data).addViolationWithMessage(node,
                        "Data repository/, query/, and mapper/ code must not own concrete source mechanics such as '"
                                + token + "'. Move source-specific work into gateway/.");
            }
        }
    }

    private void validateQueryReadOnlyShape(
            ASTCompilationUnit node,
            Object data,
            SaltMarcherSourceFacts sourceFacts
    ) {
        Matcher matcher = PUBLIC_OR_PROTECTED_METHOD_PATTERN.matcher(sourceFacts.text());
        while (matcher.find()) {
            String methodName = matcher.group(1);
            if (isMutationMethodName(methodName)) {
                asCtx(data).addViolationWithMessage(node,
                        "Data query/ adapters must stay read-only and must not expose mutation method '"
                                + methodName + "'.");
            }
        }
    }

    private void validateSchemaDdlPlacement(
            ASTCompilationUnit node,
            Object data,
            SaltMarcherSourceFacts sourceFacts
    ) {
        if (isFeaturePersistenceSchema(sourceFacts) || sourceFacts.relativePath().startsWith("src/data/persistencecore/")) {
            return;
        }
        if (SCHEMA_DDL_LITERAL_PATTERN.matcher(sourceFacts.text()).find()) {
            asCtx(data).addViolationWithMessage(node,
                    "Feature schema DDL must live in the owning data model/<Feature>PersistenceSchema.java declaration.");
        }
    }

    private static boolean isRepositoryQueryOrMapper(SaltMarcherSourceFacts sourceFacts) {
        return isRepository(sourceFacts) || isQuery(sourceFacts) || isMapper(sourceFacts);
    }

    private static boolean isRepository(SaltMarcherSourceFacts sourceFacts) {
        return sourceFacts.relativePath().startsWith("src/data/")
                && sourceFacts.relativePath().contains("/repository/");
    }

    private static boolean isQuery(SaltMarcherSourceFacts sourceFacts) {
        return sourceFacts.relativePath().startsWith("src/data/")
                && sourceFacts.relativePath().contains("/query/");
    }

    private static boolean isMapper(SaltMarcherSourceFacts sourceFacts) {
        return sourceFacts.relativePath().startsWith("src/data/")
                && sourceFacts.relativePath().contains("/mapper/");
    }

    private static boolean isFeaturePersistenceSchema(SaltMarcherSourceFacts sourceFacts) {
        return sourceFacts.relativePath().startsWith("src/data/")
                && sourceFacts.relativePath().contains("/model/")
                && sourceFacts.fileName().equals(sourceFacts.expectedPersistenceSchemaFileName());
    }

    private static boolean isMutationMethodName(String methodName) {
        String normalized = methodName.toLowerCase();
        return QUERY_MUTATION_METHOD_PREFIXES.stream().anyMatch(normalized::startsWith);
    }
}
