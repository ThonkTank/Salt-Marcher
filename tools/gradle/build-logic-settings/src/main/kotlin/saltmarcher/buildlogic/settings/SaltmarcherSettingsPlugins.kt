package saltmarcher.buildlogic.settings

import java.io.File
import org.gradle.api.Plugin
import org.gradle.api.initialization.Settings
import saltmarcher.buildlogic.enforcement.BuildHarnessTaskKind
import saltmarcher.buildlogic.enforcement.EnforcementBundleCatalog
import saltmarcher.buildlogic.enforcement.EnforcementBundleDescriptor
import saltmarcher.buildlogic.enforcement.EnforcementDiagnosticSurfaceCatalog
import saltmarcher.buildlogic.enforcement.standardEnforcementBundleCatalog
import saltmarcher.buildlogic.enforcement.standardEnforcementDiagnosticSurfaceCatalog
import saltmarcher.buildlogic.shared.CheckTaskName
import saltmarcher.buildlogic.shared.ProductionHandoffCompileIntegrityTaskName
import saltmarcher.buildlogic.shared.ProductionHandoffHygieneTaskName
import saltmarcher.buildlogic.shared.ProductionHandoffStructureTaskName
import saltmarcher.buildlogic.shared.ProductionHandoffTaskName

class SaltmarcherRootSettingsPlugin : Plugin<Settings> {
    override fun apply(settings: Settings) {
        val repoRootDir = System.getProperty("saltmarcher.repoRootDir")
            ?.trim()
            ?.takeIf(String::isNotEmpty)
            ?.let(::File)
            ?.canonicalFile
            ?: findRepositoryRoot(settings.settingsDir)
        System.setProperty("saltmarcher.repoRootDir", repoRootDir.absolutePath)

        val requestedTaskNames = settings.gradle.startParameter.taskNames
            .map { taskName -> taskName.substringAfterLast(":") }
            .toSet()
        val bundleCatalog = standardEnforcementBundleCatalog()
        val diagnosticSurfaceCatalog = standardEnforcementDiagnosticSurfaceCatalog(bundleCatalog)
        val broadBuildTaskNames = standardBroadBuildTaskNames()
        val internalSelectorTaskToBundleId = bundleCatalog.selectorTaskToBundleId
        val diagnosticSurfaceTaskNames = diagnosticSurfaceCatalog.diagnosticTaskToBundleIds.keys
        val buildHarnessTaskToBundleIds = buildHarnessTaskToBundleIds(diagnosticSurfaceCatalog, bundleCatalog)
        val discoveryBuildRequest = requestedTaskNames.isEmpty() ||
            requestedTaskNames.any(::isDiscoveryTaskName)
        val allBundleVerificationRequest = discoveryBuildRequest ||
            requestedTaskNames.any(::isAllBundleVerificationTaskName) ||
            requestedTaskNames.any(::isDocumentationTaskName) ||
            requestedTaskNames.any(::isFocusedCompileTaskName)
        val requestedBundleIds = requestedTaskNames
            .flatMap { taskName ->
                diagnosticSurfaceCatalog.diagnosticTaskToBundleIds[taskName]
                    ?: internalSelectorTaskToBundleId[taskName]?.let(::listOf)
                    ?: buildHarnessTaskToBundleIds[taskName]
                    ?: emptyList()
            }
            .distinct()
        val focusedEnforcementBundleMode = requestedTaskNames.isNotEmpty() &&
            requestedBundleIds.isNotEmpty() &&
            requestedTaskNames.none { taskName -> taskName in broadBuildTaskNames } &&
            requestedTaskNames.all { taskName ->
                taskName in internalSelectorTaskToBundleId.keys ||
                    taskName in diagnosticSurfaceTaskNames ||
                    taskName in buildHarnessTaskToBundleIds.keys
        }
        val activeEnforcementBundleIds = if (focusedEnforcementBundleMode) {
            bundleCatalog.expandedBundleIds(requestedBundleIds)
        } else if (allBundleVerificationRequest) {
            bundleCatalog.bundleIdsInOrder
        } else {
            emptyList()
        }
        val requestScope = verificationRequestScope(
            requestedTaskNames,
            activeEnforcementBundleIds.map(bundleCatalog::descriptor),
            discoveryBuildRequest
        )

        System.setProperty("saltmarcher.focusedEnforcementBundleMode", focusedEnforcementBundleMode.toString())
        System.setProperty("saltmarcher.activeEnforcementBundleIds", activeEnforcementBundleIds.joinToString(","))
        System.setProperty("saltmarcher.includeBuildHarness", requestScope.includeBuildHarness.toString())
        System.setProperty("saltmarcher.includeQualityRules", requestScope.includeQualityRules.toString())
        System.setProperty("saltmarcher.includeQualityRulesErrorProne", requestScope.includeQualityRulesErrorProne.toString())
        System.setProperty("saltmarcher.includeJqassistant", requestScope.includeJqassistant.toString())
        System.setProperty("saltmarcher.discoveryBuildRequest", requestScope.discoveryBuildRequest.toString())

        if (requestScope.includeBuildHarness) {
            includeSaltmarcherBuild(settings, "tools/gradle/build-harness")
        }
        if (requestScope.includeQualityRules) {
            includeSaltmarcherBuild(settings, "tools/quality/rules/quality-rules")
        }
        if (requestScope.includeQualityRulesErrorProne) {
            includeSaltmarcherBuild(settings, "tools/quality/incubator/quality-rules-errorprone")
        }
    }
}

private fun includeSaltmarcherBuild(settings: Settings, relativePath: String) = settings.includeBuild(relativePath)

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

private fun buildHarnessTaskToBundleIds(
    diagnosticSurfaceCatalog: EnforcementDiagnosticSurfaceCatalog,
    bundleCatalog: EnforcementBundleCatalog
): Map<String, List<String>> {
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

private data class VerificationRequestScope(
    val includeBuildHarness: Boolean,
    val includeQualityRules: Boolean,
    val includeQualityRulesErrorProne: Boolean,
    val includeJqassistant: Boolean,
    val discoveryBuildRequest: Boolean
)

private fun verificationRequestScope(
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

private fun findRepositoryRoot(startDirectory: File): File {
    return generateSequence(startDirectory.canonicalFile) { directory -> directory.parentFile }
        .firstOrNull { directory ->
            File(directory, "AGENTS.md").isFile && File(directory, "gradlew").isFile
        }
        ?: startDirectory.canonicalFile
}
