package saltmarcher.quality.pmd.data;

import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.ast.ASTMethodDeclaration;
import net.sourceforge.pmd.lang.java.ast.ModifierOwner;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

public final class DataQueryReadOnlySourceShapeRule extends AbstractJavaRule {

    @Override
    public Object visit(ASTCompilationUnit node, Object data) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(node);
        if (!sourceFacts.isUnderMainSourceRoots() || !DataQueryPmdSupport.isQuery(sourceFacts)) {
            return data;
        }

        for (ASTMethodDeclaration method : node.descendants(ASTMethodDeclaration.class)) {
            if (!method.getEffectiveVisibility().isAtLeast(ModifierOwner.Visibility.V_PROTECTED)) {
                continue;
            }
            String methodName = method.getName();
            if (DataQueryPmdSupport.isMutationMethodName(methodName)) {
                asCtx(data).addViolationWithMessage(method,
                        "Data query/ adapters must stay read-only and must not expose mutation method '"
                                + methodName + "'.");
            }
        }
        return data;
    }
}
