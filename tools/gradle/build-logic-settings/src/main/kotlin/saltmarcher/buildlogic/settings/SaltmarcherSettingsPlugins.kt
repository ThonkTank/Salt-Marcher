package saltmarcher.buildlogic.settings

import java.io.File
import org.gradle.api.Plugin
import org.gradle.api.initialization.Settings
import saltmarcher.buildlogic.enforcement.standardEnforcementBundleCatalog
import saltmarcher.buildlogic.enforcement.standardEnforcementDiagnosticSurfaceCatalog
import saltmarcher.buildlogic.enforcement.VerificationTaskRequestClassifier

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
        val requestFacts = VerificationTaskRequestClassifier(bundleCatalog, diagnosticSurfaceCatalog).classify(
            requestedTaskNames = requestedTaskNames,
            focusedVerificationPaths = systemList("saltmarcher.focusedVerificationPaths"),
            focusedVerificationAreas = systemList("saltmarcher.focusedVerificationAreas")
        )
        val requestScope = requestFacts.requestScope

        System.setProperty("saltmarcher.focusedEnforcementBundleMode", requestFacts.focusedEnforcementBundleMode.toString())
        System.setProperty("saltmarcher.activeEnforcementBundleIds", requestFacts.activeEnforcementBundleIds.joinToString(","))
        System.setProperty("saltmarcher.includeBuildHarness", requestScope.includeBuildHarness.toString())
        System.setProperty("saltmarcher.includeQualityRules", requestScope.includeQualityRules.toString())
        System.setProperty("saltmarcher.includeQualityRulesErrorProne", requestScope.includeQualityRulesErrorProne.toString())
        System.setProperty("saltmarcher.includeJqassistant", requestScope.includeJqassistant.toString())
        System.setProperty("saltmarcher.discoveryBuildRequest", requestScope.discoveryBuildRequest.toString())
        System.setProperty("saltmarcher.focusedDiagnosticSurfaceIds", requestFacts.focusedDiagnosticSurfaceIds.joinToString(","))

        if (requestScope.includeBuildHarness || requestScope.includeQualityRulesErrorProne) {
            includeSaltmarcherBuild(settings, "tools/quality/architecture-policy")
        }
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

private fun systemList(propertyName: String): List<String> = System.getProperty(propertyName)
    ?.split(',')
    .orEmpty()
    .map(String::trim)
    .map { value -> value.replace('\\', '/').removePrefix("./").removeSuffix("/") }
    .filter(String::isNotEmpty)
    .distinct()

private fun findRepositoryRoot(startDirectory: File): File {
    return generateSequence(startDirectory.canonicalFile) { directory -> directory.parentFile }
        .firstOrNull { directory ->
            File(directory, "AGENTS.md").isFile && File(directory, "gradlew").isFile
        }
        ?: startDirectory.canonicalFile
}
