package saltmarcher.buildlogic.settings

import java.io.File
import java.util.Properties
import org.gradle.api.Plugin
import org.gradle.api.initialization.Settings

class SaltmarcherRootSettingsPlugin : Plugin<Settings> {
    override fun apply(settings: Settings) {
        val repoRootDir = System.getProperty("saltmarcher.repoRootDir")
            ?.trim()
            ?.takeIf(String::isNotEmpty)
            ?.let(::File)
            ?.canonicalFile
            ?: findRepositoryRoot(settings.settingsDir)
        System.setProperty("saltmarcher.repoRootDir", repoRootDir.absolutePath)

        val verificationSurfaceCatalog = loadProperties(File(repoRootDir, "tools/gradle/verification-surface-catalog.properties"))
        val bundleCatalog = loadBundleCatalog(repoRootDir)
        val requestedTaskNames = settings.gradle.startParameter.taskNames
            .map { taskName -> taskName.substringAfterLast(":") }
            .toSet()
        val broadBuildTaskNames = verificationSurfaceCatalog.list("broadBuildTaskNames").toSet()
        val taskToBundleId = bundleCatalog.values
            .flatMap { descriptor -> descriptor.taskNames.map { taskName -> taskName to descriptor.bundleId } }
            .toMap()
        val requestedBundleIds = requestedTaskNames.mapNotNull(taskToBundleId::get).distinct()
        val focusedEnforcementBundleMode = requestedTaskNames.isNotEmpty() &&
            requestedBundleIds.isNotEmpty() &&
            requestedTaskNames.none { taskName -> taskName in broadBuildTaskNames } &&
            requestedTaskNames.all { taskName -> taskName in taskToBundleId.keys }
        val activeEnforcementBundleIds = if (focusedEnforcementBundleMode) {
            bundleCatalog.values
                .sortedBy(MinimalEnforcementBundleDescriptor::order)
                .map(MinimalEnforcementBundleDescriptor::bundleId)
                .filter { bundleId -> bundleId in requestedBundleIds }
        } else {
            bundleCatalog.values
                .sortedBy(MinimalEnforcementBundleDescriptor::order)
                .map(MinimalEnforcementBundleDescriptor::bundleId)
        }

        System.setProperty("saltmarcher.focusedEnforcementBundleMode", focusedEnforcementBundleMode.toString())
        System.setProperty("saltmarcher.activeEnforcementBundleIds", activeEnforcementBundleIds.joinToString(","))

        includeSaltmarcherBuild(settings, "tools/gradle/build-harness")
        includeSaltmarcherBuild(settings, "tools/quality/rules/quality-rules")
        includeSaltmarcherBuild(settings, "tools/quality/incubator/quality-rules-errorprone")
    }
}

private data class MinimalEnforcementBundleDescriptor(
    val bundleId: String,
    val order: Int,
    val taskNames: List<String>
)

private fun includeSaltmarcherBuild(settings: Settings, relativePath: String) = settings.includeBuild(relativePath)

private fun findRepositoryRoot(startDirectory: File): File {
    return generateSequence(startDirectory.canonicalFile) { directory -> directory.parentFile }
        .firstOrNull { directory ->
            File(directory, "AGENTS.md").isFile && File(directory, "gradlew").isFile
        }
        ?: startDirectory.canonicalFile
}

private fun loadProperties(file: File): Properties = Properties().apply {
    file.inputStream().use(::load)
}

private fun Properties.requiredTrimmed(name: String): String = getProperty(name)
    ?.trim()
    ?.takeIf(String::isNotEmpty)
    ?: error("Missing required enforcement bundle property '$name'.")

private fun Properties.list(name: String): List<String> = getProperty(name)
    ?.split(',')
    ?.map(String::trim)
    ?.filter(String::isNotEmpty)
    ?: emptyList()

private fun Properties.boolean(name: String): Boolean = getProperty(name)
    ?.trim()
    ?.equals("true", ignoreCase = true)
    ?: false

private fun loadBundleCatalog(
    repoRootDir: File
): Map<String, MinimalEnforcementBundleDescriptor> {
    val qualityDir = File(repoRootDir, "tools/quality")
    if (!qualityDir.isDirectory) {
        return emptyMap()
    }
    return qualityDir.walkTopDown()
        .filter { file -> file.isFile && file.name == "bundle.properties" }
        .mapNotNull { descriptorFile ->
            val properties = loadProperties(descriptorFile)
            if (!properties.boolean("descriptorOwned")) {
                null
            } else {
                MinimalEnforcementBundleDescriptor(
                    bundleId = properties.requiredTrimmed("bundleId"),
                    order = properties.requiredTrimmed("order").toInt(),
                    taskNames = properties.list("taskNames")
                )
            }
        }
        .associateBy(MinimalEnforcementBundleDescriptor::bundleId)
}
