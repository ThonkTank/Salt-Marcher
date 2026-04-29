package saltmarcher.quality.pmd.data;

import java.util.Set;
import java.util.regex.Pattern;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.ast.ASTMethodDeclaration;
import net.sourceforge.pmd.lang.java.ast.ASTStringLiteral;
import net.sourceforge.pmd.lang.java.ast.ModifierOwner;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

public final class SaltMarcherDataLayerRoleRule extends AbstractJavaRule {

    private static final Pattern SCHEMA_DDL_TEXT_PATTERN = Pattern.compile(
            "\\b(?:CREATE\\s+(?:TEMP\\s+)?(?:TABLE|INDEX|UNIQUE\\s+INDEX)|ALTER\\s+TABLE|DROP\\s+TABLE)\\b",
            Pattern.CASE_INSENSITIVE);
    private static final Set<String> CONCRETE_SOURCE_TOKENS = Set.of(
            "java.sql.",
            "javax.sql.",
            "java.net.",
            "java.net.http.",
            "okhttp3.",
            "retrofit2.",
            "java.nio.file.",
            "java.io.");
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
            if (isCompositionAdapterRepositoryQueryOrMapper(sourceFacts)) {
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
            if (codeTextWithoutCommentsAndStrings(sourceFacts.text()).contains(token)) {
                asCtx(data).addViolationWithMessage(node,
                        "Data composition adapter, repository/, query/, and mapper/ code must not own concrete source mechanics such as '"
                                + token + "'. Move source-specific work into a source adapter under gateway/.");
            }
        }
    }

    private void validateQueryReadOnlyShape(
            ASTCompilationUnit node,
            Object data,
            SaltMarcherSourceFacts sourceFacts
    ) {
        for (ASTMethodDeclaration method : node.descendants(ASTMethodDeclaration.class)) {
            String methodName = method.getName();
            if (!isPublicOrProtected(method)) {
                continue;
            }
            if (isMutationMethodName(methodName)) {
                asCtx(data).addViolationWithMessage(method,
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
        for (ASTStringLiteral literalNode : node.descendants(ASTStringLiteral.class)) {
            String literal = literalNode.getConstValue();
            if (SCHEMA_DDL_TEXT_PATTERN.matcher(literal).find()) {
                asCtx(data).addViolationWithMessage(literalNode,
                        "Feature schema DDL must live in the owning data model/<Feature>PersistenceSchema.java declaration.");
                return;
            }
        }
    }

    private static boolean isRepositoryQueryOrMapper(SaltMarcherSourceFacts sourceFacts) {
        return isRepository(sourceFacts) || isQuery(sourceFacts) || isMapper(sourceFacts);
    }

    private static boolean isCompositionAdapterRepositoryQueryOrMapper(SaltMarcherSourceFacts sourceFacts) {
        return sourceFacts.isDataRoot() || isRepositoryQueryOrMapper(sourceFacts);
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
                && sourceFacts.isExpectedPersistenceSchemaFileName();
    }

    private static boolean isMutationMethodName(String methodName) {
        String normalized = methodName.toLowerCase();
        return QUERY_MUTATION_METHOD_PREFIXES.stream().anyMatch(normalized::startsWith);
    }

    private static boolean isPublicOrProtected(ASTMethodDeclaration method) {
        return method.getEffectiveVisibility().isAtLeast(ModifierOwner.Visibility.V_PROTECTED);
    }

    private static String codeTextWithoutCommentsAndStrings(String text) {
        StringBuilder result = new StringBuilder(text.length());
        boolean inLineComment = false;
        boolean inBlockComment = false;
        boolean inString = false;
        boolean inChar = false;
        boolean escaped = false;
        for (int index = 0; index < text.length(); index++) {
            char current = text.charAt(index);
            char next = index + 1 < text.length() ? text.charAt(index + 1) : '\0';
            if (inLineComment) {
                if (current == '\n' || current == '\r') {
                    inLineComment = false;
                    result.append(current);
                } else {
                    result.append(' ');
                }
                continue;
            }
            if (inBlockComment) {
                if (current == '*' && next == '/') {
                    inBlockComment = false;
                    result.append("  ");
                    index++;
                } else {
                    result.append(current == '\n' || current == '\r' ? current : ' ');
                }
                continue;
            }
            if (escaped) {
                escaped = false;
                result.append(' ');
                continue;
            }
            if (current == '\\' && (inString || inChar)) {
                escaped = true;
                result.append(' ');
                continue;
            }
            if (inString) {
                if (current == '"') {
                    inString = false;
                }
                result.append(current == '\n' || current == '\r' ? current : ' ');
                continue;
            }
            if (inChar) {
                if (current == '\'') {
                    inChar = false;
                }
                result.append(current == '\n' || current == '\r' ? current : ' ');
                continue;
            }
            if (current == '/' && next == '/') {
                inLineComment = true;
                result.append("  ");
                index++;
                continue;
            }
            if (current == '/' && next == '*') {
                inBlockComment = true;
                result.append("  ");
                index++;
                continue;
            }
            if (current == '"') {
                inString = true;
                result.append(' ');
                continue;
            }
            if (current == '\'') {
                inChar = true;
                result.append(' ');
                continue;
            }
            result.append(current);
        }
        return result.toString();
    }
}
