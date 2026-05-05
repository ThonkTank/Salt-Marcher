package saltmarcher.quality.pmd.indirection;

import net.sourceforge.pmd.lang.rule.RuleTargetSelector;
import net.sourceforge.pmd.lang.java.ast.ASTClassDeclaration;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;
import net.sourceforge.pmd.properties.PropertyDescriptor;
import net.sourceforge.pmd.properties.PropertyFactory;
import saltmarcher.quality.pmd.indirection.CeremonialRoleCatalog.Role;
import saltmarcher.quality.pmd.indirection.CeremonialRoleCatalog.RuleKind;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

public final class CeremonialIndirectionRule extends AbstractJavaRule {

    private static final PropertyDescriptor<RuleKind> RULE_KIND =
            PropertyFactory.conventionalEnumProperty("ruleKind", RuleKind.class)
                    .desc("Selects which ceremonial-indirection role surface this rule enforces.")
                    .defaultValue(RuleKind.DOMAIN_SERVICE)
                    .build();

    public CeremonialIndirectionRule() {
        definePropertyDescriptor(RULE_KIND);
    }

    @Override
    protected RuleTargetSelector buildTargetSelector() {
        return RuleTargetSelector.forTypes(ASTClassDeclaration.class);
    }

    @Override
    public Object visit(ASTClassDeclaration node, Object data) {
        if (!node.isRegularClass() || node.ancestors(ASTClassDeclaration.class).first() != null) {
            return data;
        }

        ASTCompilationUnit compilationUnit = node.ancestors(ASTCompilationUnit.class).first();
        if (compilationUnit == null) {
            return data;
        }
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(compilationUnit);
        if (!sourceFacts.simpleName().equals(node.getSimpleName())) {
            return data;
        }
        RuleKind ruleKind = getProperty(RULE_KIND);
        Role role = CeremonialRoleCatalog.roleFor(ruleKind, sourceFacts).orElse(null);
        if (role == null) {
            return data;
        }

        CeremonialMethodAnalysis.Analysis analysis = CeremonialMethodAnalysis.analyze(node, sourceFacts);
        if (!analysis.ceremonial()) {
            return data;
        }

        String message = ruleKind == RuleKind.THIN_CANDIDATES
                ? "Thin-role indirection candidate [" + role.label() + "] '" + sourceFacts.relativePath()
                + "': all non-constructor methods merely "
                + String.join(", ", analysis.trivialDescriptions())
                + "; report-only because " + role.reportOnlyReason() + "."
                : "Domain " + role.label().toLowerCase() + " role '" + sourceFacts.relativePath()
                + "' is ceremonial indirection only: all non-constructor methods merely "
                + String.join(", ", analysis.trivialDescriptions())
                + ". " + role.blockerExpectation() + analysis.collaboratorTarget() + ".";
        asCtx(data).addViolationWithMessage(node, message);
        return data;
    }
}
