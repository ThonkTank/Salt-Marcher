package saltmarcher.quality.pmd.hygiene;

import net.sourceforge.pmd.lang.java.ast.ASTClassDeclaration;
import net.sourceforge.pmd.lang.java.ast.ASTMethodDeclaration;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.ast.ASTTypeDeclaration;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRulechainRule;

public final class SourceShapeTooManyMethodsRule extends AbstractJavaRulechainRule {

    private static final int DEFAULT_METHOD_LIMIT = 10;

    public SourceShapeTooManyMethodsRule() {
        super(ASTClassDeclaration.class);
    }

    @Override
    public Object visitJavaNode(net.sourceforge.pmd.lang.java.ast.JavaNode node, Object data) {
        if (node instanceof ASTClassDeclaration classDeclaration) {
            checkTypeDeclaration(classDeclaration, data);
        }
        return null;
    }

    private void checkTypeDeclaration(ASTTypeDeclaration typeDeclaration, Object data) {
        if (SourceShapeMetricSupport.isViewShapeMetricType(typeDeclaration)
                || SourceShapeMetricSupport.isTopLevelDomainPublishedBoundarySource(typeDeclaration)
                || SourceShapeMetricSupport.isFeatureRuntimeArchitectureMetricSource(
                        (ASTCompilationUnit) typeDeclaration.getRoot())) {
            return;
        }
        int operationCount = typeDeclaration.getOperations()
                .filterIs(ASTMethodDeclaration.class)
                .filterNot(SourceShapeTooManyMethodsRule::isSimpleAccessor)
                .count();
        if (operationCount > DEFAULT_METHOD_LIMIT) {
            asCtx(data).addViolation(typeDeclaration);
        }
    }

    private static boolean isSimpleAccessor(ASTMethodDeclaration methodDeclaration) {
        String name = methodDeclaration.getName();
        return (name.startsWith("get") || name.startsWith("set") || name.startsWith("is"))
                && (methodDeclaration.getBody() == null || methodDeclaration.getBody().getNumChildren() <= 1);
    }
}
