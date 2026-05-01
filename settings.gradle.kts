import java.io.File
import java.util.Properties

pluginManagement {
    val includedBuildRoot = System.getenv("SALTMARCHER_INCLUDED_BUILD_ROOT")
        ?.trim()
        ?.takeIf(String::isNotEmpty)
    includeBuild(
        includedBuildRoot?.let { File(it, "tools/gradle/build-logic").absolutePath }
            ?: "tools/gradle/build-logic"
    )
}

apply(from = "tools/gradle/build-isolation.settings.gradle.kts")

data class EnforcementBundleDescriptor(
    val bundleId: String,
    val order: Int,
    val taskNames: List<String>
)

fun Properties.requiredTrimmed(name: String): String = getProperty(name)
    ?.trim()
    ?.takeIf(String::isNotEmpty)
    ?: error("Missing required enforcement bundle property '$name'.")

fun Properties.list(name: String): List<String> = getProperty(name)
    ?.split(',')
    ?.map(String::trim)
    ?.filter(String::isNotEmpty)
    ?: emptyList()

fun Properties.boolean(name: String): Boolean = getProperty(name)
    ?.trim()
    ?.equals("true", ignoreCase = true)
    ?: false

fun includedBuildPath(relativePath: String): String {
    val includedBuildRoot = System.getenv("SALTMARCHER_INCLUDED_BUILD_ROOT")
        ?.trim()
        ?.takeIf(String::isNotEmpty)
    return includedBuildRoot?.let { root -> File(root, relativePath).absolutePath } ?: relativePath
}

fun loadEnforcementBundleDescriptors(repoRootDir: File): Map<String, EnforcementBundleDescriptor> {
    val qualityDir = File(repoRootDir, "tools/quality")
    if (!qualityDir.isDirectory) {
        return emptyMap()
    }
    return qualityDir.walkTopDown()
        .filter { file -> file.isFile && file.name == "bundle.properties" }
        .map { descriptorFile ->
            val properties = Properties()
            descriptorFile.inputStream().use(properties::load)
            if (!properties.boolean("descriptorOwned")) {
                null
            } else {
                EnforcementBundleDescriptor(
                    bundleId = properties.requiredTrimmed("bundleId"),
                    order = properties.requiredTrimmed("order").toInt(),
                    taskNames = properties.list("taskNames")
                )
            }
        }
        .filterNotNull()
        .associateBy(EnforcementBundleDescriptor::bundleId)
}

val legacyEnforcementBundleIdsInOrder = listOf(
    "view",
    "viewLayer",
    "viewInspectorEntry",
    "viewPublishedEvent",
    "viewContributionModel",
    "viewContentModel"
)

val enforcementBundleDescriptorsById = loadEnforcementBundleDescriptors(rootDir)

val enforcementBundleIdsInOrder = (
    legacyEnforcementBundleIdsInOrder.mapIndexed { index, bundleId -> bundleId to index } +
        enforcementBundleDescriptorsById.values.map { descriptor -> descriptor.bundleId to descriptor.order }
    )
    .sortedBy { (_, order) -> order }
    .map { (bundleId, _) -> bundleId }
    .distinct()

val legacyEnforcementBundleTaskToId = mapOf(
    "checkViewEnforcement" to "view",
    "viewSurfaceArchitectureTest" to "view",
    "checkViewFxmlResources" to "view",
    "jqassistantScanViewEnforcement" to "view",
    "jqassistantAnalyzeViewEnforcement" to "view",
    "checkViewLayerEnforcement" to "viewLayer",
    "viewLayerArchitectureTest" to "viewLayer",
    "viewLayerTopologyCheck" to "viewLayer",
    "checkViewInspectorEntryEnforcement" to "viewInspectorEntry",
    "jqassistantScanViewInspectorEntryEnforcement" to "viewInspectorEntry",
    "jqassistantAnalyzeViewInspectorEntryEnforcement" to "viewInspectorEntry",
    "viewInspectorEntryTopologyCheck" to "viewInspectorEntry",
    "checkViewPublishedEventEnforcement" to "viewPublishedEvent",
    "viewPublishedEventArchitectureTest" to "viewPublishedEvent",
    "checkViewContributionModelEnforcement" to "viewContributionModel",
    "viewContributionModelArchitectureTest" to "viewContributionModel",
    "jqassistantScanViewContributionModelEnforcement" to "viewContributionModel",
    "jqassistantAnalyzeViewContributionModelEnforcement" to "viewContributionModel",
    "viewContributionModelTopologyCheck" to "viewContributionModel",
    "checkViewContentModelEnforcement" to "viewContentModel"
)

val descriptorEnforcementBundleTaskToId = enforcementBundleDescriptorsById.values
    .flatMap { descriptor -> descriptor.taskNames.map { taskName -> taskName to descriptor.bundleId } }
    .toMap()

val enforcementBundleTaskToId = legacyEnforcementBundleTaskToId + descriptorEnforcementBundleTaskToId

val enforcementBundleAwareTasks = enforcementBundleTaskToId.keys
val fullBuildTaskNames = setOf(
    "build",
    "check",
    "assemble",
    "classes",
    "compileJava",
    "jar",
    "test",
    "installDesktopApp",
    "installDist",
    "run",
    "checkArchitecture",
    "checkViewArchitecture",
    "architectureTest",
    "pmdArchitectureMain",
    "jqassistantEffectiveRules"
)

val requestedTaskNames = gradle.startParameter.taskNames
    .map { taskName -> taskName.substringAfterLast(":") }
    .toSet()

val requestedBundleIds = requestedTaskNames
    .mapNotNull(enforcementBundleTaskToId::get)
    .distinct()

val focusedEnforcementBundleMode = requestedTaskNames.isNotEmpty()
    && requestedBundleIds.isNotEmpty()
    && requestedTaskNames.none { taskName -> taskName in fullBuildTaskNames }
    && requestedTaskNames.all { taskName -> taskName in enforcementBundleAwareTasks }

val activeEnforcementBundleIds = if (focusedEnforcementBundleMode) {
    enforcementBundleIdsInOrder.filter { bundleId -> bundleId in requestedBundleIds }
} else {
    enforcementBundleIdsInOrder
}

System.setProperty("saltmarcher.focusedEnforcementBundleMode", focusedEnforcementBundleMode.toString())
System.setProperty("saltmarcher.activeEnforcementBundleIds", activeEnforcementBundleIds.joinToString(","))
System.setProperty("saltmarcher.repoRootDir", rootDir.absolutePath)

rootProject.name = "SaltMarcher"

includeBuild(includedBuildPath("tools/gradle/build-harness"))
includeBuild(includedBuildPath("tools/quality/rules/quality-rules"))
includeBuild(includedBuildPath("tools/quality/incubator/quality-rules-errorprone"))
