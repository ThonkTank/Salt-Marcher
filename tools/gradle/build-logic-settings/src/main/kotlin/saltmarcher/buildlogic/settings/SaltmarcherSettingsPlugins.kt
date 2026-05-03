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

        val enforcementBundleCatalogFile = System.getProperty("saltmarcher.enforcementBundleCatalogFile")
            ?.trim()
            ?.takeIf(String::isNotEmpty)
            ?.let(::File)
            ?.takeIf(File::isFile)
            ?: System.getenv("SALTMARCHER_ENFORCEMENT_BUNDLE_CATALOG")
                ?.trim()
                ?.takeIf(String::isNotEmpty)
                ?.let(::File)
                ?.takeIf(File::isFile)
        enforcementBundleCatalogFile?.let { catalogFile ->
            System.setProperty("saltmarcher.enforcementBundleCatalogFile", catalogFile.absolutePath)
        }

        val verificationSurfaceCatalog = loadProperties(File(repoRootDir, "tools/gradle/verification-surface-catalog.properties"))
        val bundleCatalog = loadBundleCatalog(repoRootDir, enforcementBundleCatalogFile)
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

private fun includeSaltmarcherBuild(settings: Settings, relativePath: String) {
    val includedBuildRoot = System.getenv("SALTMARCHER_INCLUDED_BUILD_ROOT")
        .nonBlankOrNull()
    val path = includedBuildRoot?.let { root -> File(root, relativePath).absolutePath } ?: relativePath
    settings.includeBuild(path)
}

private fun findRepositoryRoot(startDirectory: File): File {
    return generateSequence(startDirectory.canonicalFile) { directory -> directory.parentFile }
        .firstOrNull { directory ->
            File(directory, "AGENTS.md").isFile && File(directory, "gradlew").isFile
        }
        ?: startDirectory.canonicalFile
}

private fun String?.nonBlankOrNull(): String? = this?.trim()?.takeIf(String::isNotEmpty)

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

private fun Properties.catalogBundleIds(): List<String> {
    val explicitIds = list("bundleIdsInOrder")
    if (explicitIds.isNotEmpty()) {
        return explicitIds
    }

    return stringPropertyNames()
        .asSequence()
        .filter { propertyName -> propertyName.startsWith("bundle.") && propertyName.endsWith(".order") }
        .map { propertyName ->
            val bundleId = propertyName.removePrefix("bundle.").removeSuffix(".order")
            Triple(bundleId, requiredTrimmed(propertyName).toInt(), bundleId)
        }
        .sortedWith(compareBy<Triple<String, Int, String>> { it.second }.thenBy { it.third })
        .map { it.first }
        .toList()
}

private fun loadBundleCatalog(
    repoRootDir: File,
    catalogFile: File?
): Map<String, MinimalEnforcementBundleDescriptor> {
    if (catalogFile != null) {
        val properties = loadProperties(catalogFile)
        return properties.catalogBundleIds().associateWith { bundleId ->
            MinimalEnforcementBundleDescriptor(
                bundleId = bundleId,
                order = properties.requiredTrimmed("bundle.$bundleId.order").toInt(),
                taskNames = properties.list("bundle.$bundleId.taskNames")
            )
        }
    }

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
