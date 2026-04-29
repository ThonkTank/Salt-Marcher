import java.io.File
import java.util.Properties

pluginManagement {
    includeBuild("tools/gradle/build-logic")
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
            EnforcementBundleDescriptor(
                bundleId = properties.requiredTrimmed("bundleId"),
                order = properties.requiredTrimmed("order").toInt(),
                taskNames = properties.list("taskNames")
            )
        }
        .associateBy(EnforcementBundleDescriptor::bundleId)
}

val legacyEnforcementBundleIdsInOrder = listOf(
    "view",
    "viewContribution",
    "viewBinder",
    "viewLayer",
    "viewInspectorEntry",
    "viewInputEvent",
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

val legacyEnforcementBundleTaskToId = mapOf(
    "checkViewEnforcement" to "view",
    "viewSurfaceArchitectureTest" to "view",
    "checkViewFxmlResources" to "view",
    "jqassistantScanViewEnforcement" to "view",
    "jqassistantAnalyzeViewEnforcement" to "view",
    "checkViewContributionEnforcement" to "viewContribution",
    "viewContributionArchitectureTest" to "viewContribution",
    "pmdViewContributionEnforcement" to "viewContribution",
    "checkViewBinderEnforcement" to "viewBinder",
    "viewBinderArchitectureTest" to "viewBinder",
    "jqassistantScanViewBinderEnforcement" to "viewBinder",
    "jqassistantAnalyzeViewBinderEnforcement" to "viewBinder",
    "checkViewLayerEnforcement" to "viewLayer",
    "viewLayerArchitectureTest" to "viewLayer",
    "viewLayerTopologyCheck" to "viewLayer",
    "checkViewInspectorEntryEnforcement" to "viewInspectorEntry",
    "jqassistantScanViewInspectorEntryEnforcement" to "viewInspectorEntry",
    "jqassistantAnalyzeViewInspectorEntryEnforcement" to "viewInspectorEntry",
    "viewInspectorEntryTopologyCheck" to "viewInspectorEntry",
    "checkViewInputEventEnforcement" to "viewInputEvent",
    "viewInputEventArchitectureTest" to "viewInputEvent",
    "viewInputEventTopologyCheck" to "viewInputEvent",
    "checkViewPublishedEventEnforcement" to "viewPublishedEvent",
    "viewPublishedEventArchitectureTest" to "viewPublishedEvent",
    "checkViewContributionModelEnforcement" to "viewContributionModel",
    "viewContributionModelArchitectureTest" to "viewContributionModel",
    "jqassistantScanViewContributionModelEnforcement" to "viewContributionModel",
    "jqassistantAnalyzeViewContributionModelEnforcement" to "viewContributionModel",
    "viewContributionModelTopologyCheck" to "viewContributionModel",
    "checkViewContentModelEnforcement" to "viewContentModel",
    "viewContentModelArchitectureTest" to "viewContentModel",
    "jqassistantScanViewContentModelEnforcement" to "viewContentModel",
    "jqassistantAnalyzeViewContentModelEnforcement" to "viewContentModel",
    "viewContentModelTopologyCheck" to "viewContentModel"
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

includeBuild("tools/gradle/build-harness")
includeBuild("tools/quality/rules/quality-rules")
includeBuild("tools/quality/incubator/quality-rules-errorprone")
