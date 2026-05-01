package saltmarcher.quality.pmd.data;

import java.util.regex.Pattern;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.ast.ASTStringLiteral;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

public final class DataModelSchemaDdlPlacementRule extends AbstractJavaRule {

    private static final Pattern SCHEMA_DDL_TEXT_PATTERN = Pattern.compile(
            "\\b(?:CREATE\\s+(?:TEMP\\s+)?(?:TABLE|INDEX|UNIQUE\\s+INDEX)|ALTER\\s+TABLE|DROP\\s+TABLE)\\b",
            Pattern.CASE_INSENSITIVE);

    @Override
    public Object visit(ASTCompilationUnit node, Object data) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(node);
        if (!sourceFacts.isUnderMainSourceRoots()) {
            return data;
        }
        if (isFeaturePersistenceSchema(sourceFacts) || sourceFacts.relativePath().startsWith("src/data/persistencecore/")) {
            return data;
        }
        for (ASTStringLiteral literalNode : node.descendants(ASTStringLiteral.class)) {
            String literal = literalNode.getConstValue();
            if (SCHEMA_DDL_TEXT_PATTERN.matcher(literal).find()) {
                asCtx(data).addViolationWithMessage(literalNode,
                        "Feature schema DDL must live in the owning data model/<Feature>PersistenceSchema.java declaration.");
                return data;
            }
        }
        return data;
    }

    private static boolean isFeaturePersistenceSchema(SaltMarcherSourceFacts sourceFacts) {
        return sourceFacts.relativePath().startsWith("src/data/")
                && sourceFacts.relativePath().contains("/model/")
                && sourceFacts.isExpectedPersistenceSchemaFileName();
    }
}
