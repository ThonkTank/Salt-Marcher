package saltmarcher.buildlogic.settings

import java.io.File
import org.gradle.api.Plugin
import org.gradle.api.initialization.Settings
import saltmarcher.buildlogic.enforcement.standardEnforcementBundleCatalog
import saltmarcher.buildlogic.enforcement.standardVerificationSurfaceCatalog

class SaltmarcherRootSettingsPlugin : Plugin<Settings> {
    override fun apply(settings: Settings) {
        val repoRootDir = System.getProperty("saltmarcher.repoRootDir")
            ?.trim()
            ?.takeIf(String::isNotEmpty)
            ?.let(::File)
            ?.canonicalFile
            ?: findRepositoryRoot(settings.settingsDir)
        System.setProperty("saltmarcher.repoRootDir", repoRootDir.absolutePath)

        val bundleCatalog = standardEnforcementBundleCatalog()
        val publicVerificationSurfaceCatalog = standardVerificationSurfaceCatalog(bundleCatalog)
        val requestedTaskNames = settings.gradle.startParameter.taskNames
            .map { taskName -> taskName.substringAfterLast(":") }
            .toSet()
        val broadBuildTaskNames = standardBroadBuildTaskNames()
        val internalSelectorTaskToBundleId = bundleCatalog.selectorTaskToBundleId
        val publicSurfaceTaskNames = publicVerificationSurfaceCatalog.taskToBundleIds.keys
        val requestedBundleIds = requestedTaskNames
            .flatMap { taskName ->
                publicVerificationSurfaceCatalog.taskToBundleIds[taskName]
                    ?: internalSelectorTaskToBundleId[taskName]?.let(::listOf)
                    ?: emptyList()
            }
            .distinct()
        val focusedEnforcementBundleMode = requestedTaskNames.isNotEmpty() &&
            requestedBundleIds.isNotEmpty() &&
            requestedTaskNames.none { taskName -> taskName in broadBuildTaskNames } &&
            requestedTaskNames.all { taskName ->
                taskName in internalSelectorTaskToBundleId.keys ||
                    taskName in publicSurfaceTaskNames
            }
        val activeEnforcementBundleIds = if (focusedEnforcementBundleMode) {
            bundleCatalog.expandedBundleIds(requestedBundleIds)
        } else {
            bundleCatalog.bundleIdsInOrder
        }

        System.setProperty("saltmarcher.focusedEnforcementBundleMode", focusedEnforcementBundleMode.toString())
        System.setProperty("saltmarcher.activeEnforcementBundleIds", activeEnforcementBundleIds.joinToString(","))

        includeSaltmarcherBuild(settings, "tools/gradle/build-harness")
        includeSaltmarcherBuild(settings, "tools/quality/rules/quality-rules")
        includeSaltmarcherBuild(settings, "tools/quality/incubator/quality-rules-errorprone")
    }
}

private fun includeSaltmarcherBuild(settings: Settings, relativePath: String) = settings.includeBuild(relativePath)

private fun standardBroadBuildTaskNames(): Set<String> = setOf(
    "assemble",
    "architectureTest",
    "build",
    "check",
    "checkArchitecture",
    "checkNoDeadCode",
    "classes",
    "compileJava",
    "desktop-install",
    "installDesktopApp",
    "installDist",
    "jar",
    "productionHarness",
    "production-handoff",
    "run",
    "test"
)

private fun findRepositoryRoot(startDirectory: File): File {
    return generateSequence(startDirectory.canonicalFile) { directory -> directory.parentFile }
        .firstOrNull { directory ->
            File(directory, "AGENTS.md").isFile && File(directory, "gradlew").isFile
        }
        ?: startDirectory.canonicalFile
}
