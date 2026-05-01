package saltmarcher.quality.pmd.domain;

import java.util.regex.Pattern;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

public final class DomainApplicationServiceSourcePolicyRule extends AbstractJavaRule {

    private static final Pattern ROOT_APPLICATION_SERVICE_COMPOSITION_PATTERN =
            Pattern.compile("\\bnew\\s+[A-Za-z_][A-Za-z0-9_$.]*(?:Repository|Gateway|DataSource|Persistence|Jdbc|Sqlite)\\b");
    private static final Pattern ROOT_APPLICATION_SERVICE_STATIC_BACKEND_PATTERN =
            Pattern.compile("\\b(?:Repository|Gateway|DataSource|Persistence|Jdbc|Sqlite)\\s+[A-Za-z_][A-Za-z0-9_]*\\s*=");

    @Override
    public Object visit(ASTCompilationUnit node, Object data) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(node);
        if (!sourceFacts.isUnderMainSourceRoots() || !sourceFacts.isDomainRoot()) {
            return data;
        }

        if (ROOT_APPLICATION_SERVICE_COMPOSITION_PATTERN.matcher(sourceFacts.text()).find()
                || sourceFacts.text().contains(".shared(")
                || sourceFacts.text().contains(".getInstance(")
                || ROOT_APPLICATION_SERVICE_STATIC_BACKEND_PATTERN.matcher(sourceFacts.text()).find()) {
            asCtx(data).addViolationWithMessage(node,
                    "Root application services must stay thin and must not instantiate or cache data port-adapter or source-adapter infrastructure directly.");
        }
        return data;
    }
}
