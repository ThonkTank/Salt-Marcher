package saltmarcher.quality.pmd.data;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import net.sourceforge.pmd.lang.java.ast.ASTCompilationUnit;
import net.sourceforge.pmd.lang.java.rule.AbstractJavaRule;
import saltmarcher.quality.pmd.data.DataQueryPmdSupport.CarrierMetadata;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

public final class DataQueryForeignPublishedCarrierCandidateRule extends AbstractJavaRule {

    private static final int MIN_ACCESSOR_COUNT = 6;
    private static final int MIN_UNUSED_ACCESSOR_COUNT = 2;

    @Override
    public Object visit(ASTCompilationUnit node, Object data) {
        SaltMarcherSourceFacts sourceFacts = SaltMarcherSourceFacts.from(node);
        if (!sourceFacts.isUnderMainSourceRoots() || !DataQueryPmdSupport.isQuery(sourceFacts)) {
            return data;
        }

        String queryFeature = DataQueryPmdSupport.queryFeatureName(sourceFacts);
        String sanitizedSourceText = DataQueryPmdSupport.codeTextWithoutCommentsAndStrings(sourceFacts.text());
        List<String> findings = new ArrayList<>();
        for (Map.Entry<String, String> importEntry : DataQueryPmdSupport.importedTypes(sourceFacts.text()).entrySet()) {
            Matcher importMatcher = DataQueryPmdSupport.FOREIGN_PUBLISHED_IMPORT.matcher(importEntry.getValue());
            if (!importMatcher.matches()) {
                continue;
            }
            String foreignFeature = importMatcher.group(1);
            if (foreignFeature.equals(queryFeature)) {
                continue;
            }
            inspectImportedCarrier(sourceFacts, sanitizedSourceText, importEntry.getKey(), importEntry.getValue(), findings);
        }

        if (findings.isEmpty()) {
            return data;
        }
        asCtx(data).addViolationWithMessage(
                node,
                "Data query foreign published carrier thinning candidate '" + sourceFacts.relativePath() + "': "
                        + String.join("; ", findings));
        return data;
    }

    private static void inspectImportedCarrier(
            SaltMarcherSourceFacts sourceFacts,
            String sanitizedSourceText,
            String importedSimpleName,
            String importedQualifiedName,
            List<String> findings
    ) {
        CarrierMetadata importedMetadata =
                DataQueryPmdSupport.loadCarrierMetadata(sourceFacts, importedQualifiedName).orElse(null);
        if (importedMetadata == null) {
            return;
        }

        Set<String> variableNames = DataQueryPmdSupport.variableNamesForType(sanitizedSourceText, importedSimpleName);
        if (variableNames.isEmpty()) {
            return;
        }

        reportCarrierUse(importedMetadata, variableNames, sanitizedSourceText, findings, null);
        for (Map.Entry<String, String> chainedCarrier : importedMetadata.chainedCarrierTypes().entrySet()) {
            CarrierMetadata chainedMetadata =
                    DataQueryPmdSupport.loadCarrierMetadata(sourceFacts, chainedCarrier.getValue()).orElse(null);
            if (chainedMetadata == null) {
                continue;
            }
            reportCarrierUse(chainedMetadata, variableNames, sanitizedSourceText, findings, chainedCarrier.getKey());
        }
    }

    private static void reportCarrierUse(
            CarrierMetadata carrierMetadata,
            Set<String> variableNames,
            String sanitizedSourceText,
            List<String> findings,
            String chainAccessor
    ) {
        if (carrierMetadata.accessors().size() < MIN_ACCESSOR_COUNT) {
            return;
        }

        Set<String> usedAccessors = new LinkedHashSet<>();
        for (String variableName : variableNames) {
            usedAccessors.addAll(chainAccessor == null
                    ? DataQueryPmdSupport.usedAccessors(sanitizedSourceText, variableName)
                    : DataQueryPmdSupport.usedChainedAccessors(sanitizedSourceText, variableName, chainAccessor));
        }
        if (usedAccessors.isEmpty() || usedAccessors.size() >= carrierMetadata.accessors().size()) {
            return;
        }

        List<String> unusedAccessors = carrierMetadata.accessors().stream()
                .filter(accessor -> !usedAccessors.contains(accessor))
                .toList();
        if (unusedAccessors.size() < MIN_UNUSED_ACCESSOR_COUNT) {
            return;
        }

        String accessPath = chainAccessor == null ? carrierMetadata.simpleName() : chainAccessor + "() -> " + carrierMetadata.simpleName();
        findings.add("foreign published carrier '" + accessPath
                + "' uses accessors " + usedAccessors
                + " but leaves " + unusedAccessors
                + " unused. This matches the consumer-private transport seam / over-broad foreign published carrier "
                + "anti-pattern. Correct pattern: publish a thinner shared carrier or published-state slice that matches "
                + "the stable foreign facts instead of relaying a broader internal-shaped carrier into query-local facts.");
    }
}
