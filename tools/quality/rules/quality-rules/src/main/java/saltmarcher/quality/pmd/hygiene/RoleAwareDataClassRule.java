package saltmarcher.quality.pmd.hygiene;

import net.sourceforge.pmd.lang.java.ast.ASTTypeDeclaration;
import net.sourceforge.pmd.lang.java.ast.JavaNode;
import net.sourceforge.pmd.lang.java.rule.design.DataClassRule;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

public final class RoleAwareDataClassRule extends DataClassRule {

    @Override
    public Object visitJavaNode(JavaNode node, Object data) {
        if (node instanceof ASTTypeDeclaration typeDeclaration && isExpectedPassiveCarrier(typeDeclaration)) {
            return null;
        }
        return super.visitJavaNode(node, data);
    }

    private static boolean isExpectedPassiveCarrier(ASTTypeDeclaration typeDeclaration) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(typeDeclaration.getRoot());
        return sourceFacts.isDataPersistenceSchemaSource()
                || sourceFacts.isDataSourceModelRecordSource()
                || sourceFacts.isDomainPublishedSource();
    }
}
