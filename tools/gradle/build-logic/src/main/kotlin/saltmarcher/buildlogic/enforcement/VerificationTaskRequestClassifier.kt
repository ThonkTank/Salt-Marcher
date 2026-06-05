package saltmarcher.buildlogic.enforcement

import saltmarcher.buildlogic.shared.CheckTaskName
import saltmarcher.buildlogic.shared.FocusedHandoffTaskName
import saltmarcher.buildlogic.shared.ProductionHandoffCompileIntegrityTaskName
import saltmarcher.buildlogic.shared.ProductionHandoffHygieneTaskName
import saltmarcher.buildlogic.shared.ProductionHandoffStructureTaskName
import saltmarcher.buildlogic.shared.ProductionHandoffSurfaceId
import saltmarcher.buildlogic.shared.ProductionHandoffTaskName

internal data class VerificationTaskRequestFacts(
    val focusedDiagnosticSurfaceIds: List<String>,
    val focusedEnforcementBundleMode: Boolean,
    val activeEnforcementBundleIds: List<String>,
    val requestScope: VerificationRequestScope
)

internal data class VerificationRequestScope(
    val includeBuildHarness: Boolean,
    val includeQualityRules: Boolean,
    val includeQualityRulesErrorProne: Boolean,
    val includeJqassistant: Boolean,
    val discoveryBuildRequest: Boolean
)

internal class VerificationTaskRequestClassifier(
    private val bundleCatalog: EnforcementBundleCatalog,
    private val diagnosticSurfaceCatalog: EnforcementDiagnosticSurfaceCatalog
) {
    fun classify(
        requestedTaskNames: Set<String>,
        focusedVerificationPaths: List<String>,
        focusedVerificationAreas: List<String>
    ): VerificationTaskRequestFacts {
        val broadBuildTaskNames = standardBroadBuildTaskNames()
        val internalSelectorTaskToBundleId = bundleCatalog.selectorTaskToBundleId
        val diagnosticSurfaceTaskNames = diagnosticSurfaceCatalog.diagnosticTaskToBundleIds.keys
        val buildHarnessTaskToBundleIds = buildHarnessTaskToBundleIds()
        val archunitTaskToBundleIds = archunitTaskToBundleIds()
        val focusedHandoffSurfaceIds = if (FocusedHandoffTaskName in requestedTaskNames) {
            focusedHandoffSurfaceIds(focusedVerificationPaths, focusedVerificationAreas)
        } else {
            emptyList()
        }
        val focusedDiagnosticSurfaceIds = (requestedTaskNames
            .flatMap(::diagnosticSurfaceIdsForTaskName) + focusedHandoffSurfaceIds)
            .distinct()
        val discoveryBuildRequest = requestedTaskNames.isEmpty() ||
            requestedTaskNames.any(::isDiscoveryTaskName)
        val allBundleVerificationRequest = discoveryBuildRequest ||
            requestedTaskNames.any(::isAllBundleVerificationTaskName) ||
            requestedTaskNames.any(::isDocumentationTaskName) ||
            requestedTaskNames.any(::isFocusedCompileTaskName)
        val requestedBundleIds = requestedTaskNames
            .flatMap { taskName ->
                if (taskName == FocusedHandoffTaskName) {
                    focusedHandoffSurfaceIds.flatMap { surfaceId -> diagnosticSurfaceCatalog.surface(surfaceId).bundleIds }
                } else {
                    diagnosticSurfaceCatalog.diagnosticTaskToBundleIds[taskName]
                        ?: internalSelectorTaskToBundleId[taskName]?.let(::listOf)
                        ?: buildHarnessTaskToBundleIds[taskName]
                        ?: archunitTaskToBundleIds[taskName]
                        ?: emptyList()
                }
            }
            .distinct()
        val focusedTaskNames = internalSelectorTaskToBundleId.keys +
            diagnosticSurfaceTaskNames +
            buildHarnessTaskToBundleIds.keys +
            archunitTaskToBundleIds.keys +
            setOf(FocusedHandoffTaskName)
        val focusedEnforcementBundleMode = requestedTaskNames.isNotEmpty() &&
            requestedBundleIds.isNotEmpty() &&
            requestedTaskNames.none { taskName -> taskName in broadBuildTaskNames } &&
            requestedTaskNames.any { taskName -> taskName in focusedTaskNames }
        val activeEnforcementBundleIds = if (focusedEnforcementBundleMode) {
            bundleCatalog.expandedBundleIds(requestedBundleIds)
        } else if (allBundleVerificationRequest) {
            bundleCatalog.bundleIdsInOrder
        } else {
            emptyList()
        }
        val requestScope = requestScope(
            requestedTaskNames,
            activeEnforcementBundleIds.map(bundleCatalog::descriptor),
            discoveryBuildRequest
        )
        return VerificationTaskRequestFacts(
            focusedDiagnosticSurfaceIds = focusedDiagnosticSurfaceIds,
            focusedEnforcementBundleMode = focusedEnforcementBundleMode,
            activeEnforcementBundleIds = activeEnforcementBundleIds,
            requestScope = requestScope
        )
    }

    private fun diagnosticSurfaceIdsForTaskName(taskName: String): List<String> = diagnosticSurfaceCatalog.surfacesInOrder
        .filter { surface ->
            taskName == surface.diagnosticTaskName ||
                BuildHarnessTaskKind.values().any { kind -> taskName == surface.buildHarnessTaskName(kind) }
        }
        .map(EnforcementDiagnosticSurfaceSpec::surfaceId)

    private fun focusedHandoffSurfaceIds(
        focusedVerificationPaths: List<String>,
        focusedVerificationAreas: List<String>
    ): List<String> {
        if (focusedVerificationAreas.isNotEmpty()) {
            return diagnosticSurfaceCatalog.focusedSurfaceIdsForAreas(focusedVerificationAreas)
        }
        return diagnosticSurfaceCatalog.focusedSurfaceIdsForPaths(focusedVerificationPaths)
    }

    private fun buildHarnessTaskToBundleIds(): Map<String, List<String>> {
        val taskToBundleIds = linkedMapOf<String, List<String>>()
        diagnosticSurfaceCatalog.surfacesInOrder.forEach { surface ->
            BuildHarnessTaskKind.values().forEach { kind ->
                taskToBundleIds[surface.buildHarnessTaskName(kind)] = surface.bundleIds
            }
        }
        taskToBundleIds["allBuildHarnessTopologyCheck"] = bundleCatalog.bundleIdsInOrder.filter { bundleId ->
            bundleCatalog.descriptor(bundleId).buildHarnessTasks.any { task ->
                task.kind == BuildHarnessTaskKind.TOPOLOGY
            }
        }
        return taskToBundleIds
    }

    private fun archunitTaskToBundleIds(): Map<String, List<String>> =
        bundleCatalog.descriptorsById.values
            .mapNotNull { descriptor ->
                descriptor.archunit?.let {
                    val sourceSetName = "${descriptor.bundleId.replaceFirstChar(Char::lowercaseChar)}EnforcementArchunit"
                    listOf(
                        it.taskName,
                        "compile${sourceSetName.replaceFirstChar(Char::uppercaseChar)}Java",
                        "${sourceSetName}Classes",
                        "process${sourceSetName.replaceFirstChar(Char::uppercaseChar)}Resources"
                    ).map { taskName -> taskName to listOf(descriptor.bundleId) }
                }
            }
            .flatten()
            .toMap()

    private fun requestScope(
        requestedTaskNames: Set<String>,
        activeDescriptors: List<EnforcementBundleDescriptor>,
        discoveryBuildRequest: Boolean
    ): VerificationRequestScope {
        val broadProductionRequest = requestedTaskNames.any(::isAllBundleVerificationTaskName)
        val productionHandoffStructureRequest = requestedTaskNames.any(::isProductionHandoffStructureTaskName)
        val documentationRequest = requestedTaskNames.any(::isDocumentationTaskName)
        val focusedEnforcementRequest = requestedTaskNames.any(::isFocusedEnforcementTaskName)
        val sourceHygieneRequest = requestedTaskNames.any(::isQualityRulesTaskName)
        val descriptorBackedRequest = broadProductionRequest || focusedEnforcementRequest
        val descriptorEngineSources = activeDescriptors.takeIf { descriptorBackedRequest }.orEmpty()
        val errorProneRequest = broadProductionRequest ||
            descriptorEngineSources.any { descriptor -> descriptor.errorProneCheckers.isNotEmpty() } ||
            requestedTaskNames.any(::isNearMissTaskName) ||
            requestedTaskNames.any(::isFocusedCompileTaskName)
        val buildHarnessRequest = broadProductionRequest ||
            documentationRequest ||
            descriptorEngineSources.any { descriptor -> descriptor.buildHarnessTasks.isNotEmpty() } ||
            requestedTaskNames.any(::isBuildHarnessTaskName)
        val jqassistantRequest = broadProductionRequest ||
            requestedTaskNames.any(::isJqassistantTaskName) ||
            descriptorEngineSources.any { descriptor -> descriptor.jqassistant != null }

        return VerificationRequestScope(
            includeBuildHarness = discoveryBuildRequest || productionHandoffStructureRequest || buildHarnessRequest,
            includeQualityRules = discoveryBuildRequest || broadProductionRequest || sourceHygieneRequest,
            includeQualityRulesErrorProne = discoveryBuildRequest || errorProneRequest,
            includeJqassistant = discoveryBuildRequest || jqassistantRequest,
            discoveryBuildRequest = discoveryBuildRequest
        )
    }

    companion object {
        fun productionHandoffRequested(requestedTaskNames: Set<String>): Boolean = requestedTaskNames.any(
            setOf(
                ProductionHandoffSurfaceId,
                ProductionHandoffTaskName,
                ProductionHandoffCompileIntegrityTaskName,
                ProductionHandoffStructureTaskName,
                ProductionHandoffHygieneTaskName,
                CheckTaskName,
                "build"
            )::contains
        )

        fun nearMissVerificationRequested(requestedTaskNames: Set<String>): Boolean = requestedTaskNames.any(
            setOf(
                ProductionHandoffSurfaceId,
                ProductionHandoffTaskName,
                ProductionHandoffHygieneTaskName,
                CheckTaskName,
                "build",
                "checkRewriteNearMisses"
            )::contains
        )
    }
}

private fun standardBroadBuildTaskNames(): Set<String> = setOf(
    ProductionHandoffTaskName,
    CheckTaskName,
    ProductionHandoffCompileIntegrityTaskName,
    ProductionHandoffHygieneTaskName,
    ProductionHandoffStructureTaskName,
    "assemble",
    "architectureTest",
    "build",
    "checkNoDeadCode",
    "classes",
    "compileJava",
    "desktop-install",
    "installDesktopApp",
    "installDist",
    "jar",
    "run",
    "test"
)

private fun isDiscoveryTaskName(taskName: String): Boolean =
    taskName == "help" ||
        taskName == "tasks" ||
        taskName == "projects" ||
        taskName == "properties" ||
        taskName == "dependencies" ||
        taskName == "dependencyInsight" ||
        taskName.startsWith("help")

private fun isAllBundleVerificationTaskName(taskName: String): Boolean =
    taskName == ProductionHandoffTaskName ||
        taskName == ProductionHandoffHygieneTaskName ||
        taskName == CheckTaskName ||
        taskName == "build"

private fun isProductionHandoffStructureTaskName(taskName: String): Boolean =
    taskName == ProductionHandoffStructureTaskName

private fun isDocumentationTaskName(taskName: String): Boolean =
    taskName == "checkDocumentationEnforcement" ||
        taskName.endsWith("BuildHarnessDocumentationCheck") ||
        taskName == "documentationEnforcementCheck"

private fun isFocusedEnforcementTaskName(taskName: String): Boolean =
    taskName == FocusedHandoffTaskName ||
        (taskName != "checkDocumentationEnforcement" && taskName.startsWith("check") && taskName.endsWith("Enforcement")) ||
        (taskName.startsWith("verify") && taskName.endsWith("Bundle"))

private fun isQualityRulesTaskName(taskName: String): Boolean =
    taskName == "pmdMain" ||
        taskName == "pmdStrictMain" ||
        isNearMissTaskName(taskName)

private fun isNearMissTaskName(taskName: String): Boolean =
    taskName == "checkRewriteNearMisses"

private fun isFocusedCompileTaskName(taskName: String): Boolean =
    taskName.startsWith("compileFocusedVerification") && taskName.endsWith("Java")

private fun isBuildHarnessTaskName(taskName: String): Boolean =
    taskName == "architectureCheck" ||
        taskName.endsWith("BuildHarnessTopologyCheck") ||
        taskName.endsWith("BuildHarnessDocumentationCheck")

private fun isJqassistantTaskName(taskName: String): Boolean =
    taskName.startsWith("jqassistantScan") ||
        taskName.startsWith("jqassistantAnalyze")
