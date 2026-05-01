import java.io.File
import java.util.Properties

data class EnforcementBundleDescriptor(
    val bundleId: String,
    val order: Int,
    val taskNames: List<String>,
    val rootHostScript: String?,
    val buildHarnessHostScript: String?,
    val errorProneHostScript: String?,
    val errorProneSourceDir: String?,
    val errorProneServiceFile: String?,
    val pmdHostScript: String?
)

fun Properties.requiredTrimmed(name: String): String = getProperty(name)
    ?.trim()
    ?.takeIf(String::isNotEmpty)
    ?: error("Missing required enforcement bundle property '$name'.")

fun Properties.optionalTrimmed(name: String): String? = getProperty(name)
    ?.trim()
    ?.takeIf(String::isNotEmpty)

fun Properties.list(name: String): List<String> = getProperty(name)
    ?.split(',')
    ?.map(String::trim)
    ?.filter(String::isNotEmpty)
    ?: emptyList()

fun Properties.boolean(name: String): Boolean = getProperty(name)
    ?.trim()
    ?.equals("true", ignoreCase = true)
    ?: false

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
                    taskNames = properties.list("taskNames"),
                    rootHostScript = properties.optionalTrimmed("rootHostScript"),
                    buildHarnessHostScript = properties.optionalTrimmed("buildHarnessHostScript"),
                    errorProneHostScript = properties.optionalTrimmed("errorProneHostScript"),
                    errorProneSourceDir = properties.optionalTrimmed("errorProneSourceDir"),
                    errorProneServiceFile = properties.optionalTrimmed("errorProneServiceFile"),
                    pmdHostScript = properties.optionalTrimmed("pmdHostScript")
                )
            }
        }
        .filterNotNull()
        .associateBy(EnforcementBundleDescriptor::bundleId)
}

val repoRootDir = System.getProperty("saltmarcher.repoRootDir")
    ?.let(::File)
    ?: error("saltmarcher.repoRootDir must be set before applying enforcement-bundles.gradle.kts.")

val enforcementBundleDescriptorsById = loadEnforcementBundleDescriptors(repoRootDir)

val legacyEnforcementBundleIdsInOrder = listOf(
    "view",
    "viewLayer",
    "viewInspectorEntry",
    "viewPublishedEvent",
    "viewContributionModel",
    "viewContentModel"
)

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

val legacyRootHostScriptsByBundleId = mapOf(
    "view" to "tools/quality/view-view-enforcement/root-host.gradle.kts",
    "viewLayer" to "tools/quality/view-layer-enforcement/root-host.gradle.kts",
    "viewInspectorEntry" to "tools/quality/view-inspector-entry-enforcement/root-host.gradle.kts",
    "viewPublishedEvent" to "tools/quality/publishedevent-enforcement/root-host.gradle.kts",
    "viewContributionModel" to "tools/quality/view-contributionmodel-enforcement/root-host.gradle.kts",
    "viewContentModel" to "tools/quality/view-content-model-enforcement/root-host.gradle.kts"
)

val descriptorRootHostScriptsByBundleId = enforcementBundleDescriptorsById.values
    .mapNotNull { descriptor -> descriptor.rootHostScript?.let { scriptPath -> descriptor.bundleId to scriptPath } }
    .toMap()

val rootHostScriptsByBundleId = legacyRootHostScriptsByBundleId + descriptorRootHostScriptsByBundleId

val legacyBuildHarnessHostScriptsByBundleId = mapOf(
    "viewLayer" to "../../quality/view-layer-enforcement/build-harness-host.gradle.kts",
    "viewInspectorEntry" to "../../quality/view-inspector-entry-enforcement/build-harness-host.gradle.kts",
    "viewContributionModel" to "../../quality/view-contributionmodel-enforcement/build-harness-host.gradle.kts",
    "viewContentModel" to "../../quality/view-content-model-enforcement/build-harness-host.gradle.kts"
)

val descriptorBuildHarnessHostScriptsByBundleId = enforcementBundleDescriptorsById.values
    .mapNotNull { descriptor -> descriptor.buildHarnessHostScript?.let { scriptPath -> descriptor.bundleId to scriptPath } }
    .toMap()

val buildHarnessHostScriptsByBundleId = legacyBuildHarnessHostScriptsByBundleId + descriptorBuildHarnessHostScriptsByBundleId

val legacyErrorProneHostScriptsByBundleId = mapOf(
    "view" to "../../view-view-enforcement/errorprone-host.gradle.kts",
    "viewInspectorEntry" to "../../view-inspector-entry-enforcement/errorprone-host.gradle.kts",
    "viewPublishedEvent" to "../../publishedevent-enforcement/errorprone-host.gradle.kts",
    "viewContributionModel" to "../../view-contributionmodel-enforcement/errorprone-host.gradle.kts",
    "viewContentModel" to "../../view-content-model-enforcement/errorprone-host.gradle.kts"
)

val descriptorErrorProneHostScriptsByBundleId = enforcementBundleDescriptorsById.values
    .mapNotNull { descriptor -> descriptor.errorProneHostScript?.let { scriptPath -> descriptor.bundleId to scriptPath } }
    .toMap()

val errorProneHostScriptsByBundleId = legacyErrorProneHostScriptsByBundleId + descriptorErrorProneHostScriptsByBundleId

val legacyErrorProneSourceDirsByBundleId = mapOf(
    "view" to "../../view-view-enforcement/errorprone/src/main/java",
    "viewInspectorEntry" to "../../view-inspector-entry-enforcement/errorprone/src/main/java",
    "viewPublishedEvent" to "../../publishedevent-enforcement/errorprone/src/main/java",
    "viewContributionModel" to "../../view-contributionmodel-enforcement/errorprone/src/main/java",
    "viewContentModel" to "../../view-content-model-enforcement/errorprone/src/main/java"
)

val descriptorErrorProneSourceDirsByBundleId = enforcementBundleDescriptorsById.values
    .mapNotNull { descriptor -> descriptor.errorProneSourceDir?.let { sourceDir -> descriptor.bundleId to sourceDir } }
    .toMap()

val errorProneSourceDirsByBundleId = legacyErrorProneSourceDirsByBundleId + descriptorErrorProneSourceDirsByBundleId

val legacyErrorProneServiceFilesByBundleId = mapOf(
    "view" to "../../view-view-enforcement/errorprone/src/main/resources/META-INF/services/com.google.errorprone.bugpatterns.BugChecker",
    "viewInspectorEntry" to "../../view-inspector-entry-enforcement/errorprone/src/main/resources/META-INF/services/com.google.errorprone.bugpatterns.BugChecker",
    "viewPublishedEvent" to "../../publishedevent-enforcement/errorprone/src/main/resources/META-INF/services/com.google.errorprone.bugpatterns.BugChecker",
    "viewContributionModel" to "../../view-contributionmodel-enforcement/errorprone/src/main/resources/META-INF/services/com.google.errorprone.bugpatterns.BugChecker",
    "viewContentModel" to "../../view-content-model-enforcement/errorprone/src/main/resources/META-INF/services/com.google.errorprone.bugpatterns.BugChecker"
)

val descriptorErrorProneServiceFilesByBundleId = enforcementBundleDescriptorsById.values
    .mapNotNull { descriptor -> descriptor.errorProneServiceFile?.let { serviceFile -> descriptor.bundleId to serviceFile } }
    .toMap()

val errorProneServiceFilesByBundleId = legacyErrorProneServiceFilesByBundleId + descriptorErrorProneServiceFilesByBundleId

val legacyPmdHostScriptsByBundleId = emptyMap<String, String>()

val descriptorPmdHostScriptsByBundleId = enforcementBundleDescriptorsById.values
    .mapNotNull { descriptor -> descriptor.pmdHostScript?.let { scriptPath -> descriptor.bundleId to scriptPath } }
    .toMap()

val pmdHostScriptsByBundleId = legacyPmdHostScriptsByBundleId + descriptorPmdHostScriptsByBundleId

val requestedTaskNames = gradle.startParameter.taskNames
    .map { taskName -> taskName.substringAfterLast(":") }
    .toSet()

val requestedBundleIds = requestedTaskNames
    .mapNotNull(enforcementBundleTaskToId::get)
    .distinct()

val locallyFocusedEnforcementBundleMode = requestedTaskNames.isNotEmpty()
    && requestedBundleIds.isNotEmpty()
    && requestedTaskNames.none { taskName -> taskName in fullBuildTaskNames }
    && requestedTaskNames.all { taskName -> taskName in enforcementBundleAwareTasks }

val propagatedFocusedEnforcementBundleMode = System.getProperty("saltmarcher.focusedEnforcementBundleMode")
    ?.trim()
    ?.takeIf { value -> value.isNotEmpty() }
    ?.toBoolean()

val propagatedActiveEnforcementBundleIds = System.getProperty("saltmarcher.activeEnforcementBundleIds")
    ?.split(',')
    ?.map(String::trim)
    ?.filter(String::isNotEmpty)
    ?.takeIf(List<String>::isNotEmpty)

val focusedEnforcementBundleMode = propagatedFocusedEnforcementBundleMode ?: locallyFocusedEnforcementBundleMode

val activeEnforcementBundleIds = if (propagatedActiveEnforcementBundleIds != null) {
    enforcementBundleIdsInOrder.filter { bundleId -> bundleId in propagatedActiveEnforcementBundleIds }
} else if (locallyFocusedEnforcementBundleMode) {
    enforcementBundleIdsInOrder.filter { bundleId -> bundleId in requestedBundleIds }
} else {
    enforcementBundleIdsInOrder
}

extra["saltmarcherFocusedEnforcementBundleMode"] = focusedEnforcementBundleMode
extra["saltmarcherActiveEnforcementBundleIds"] = activeEnforcementBundleIds
extra["saltmarcherRootHostScriptsByBundleId"] = rootHostScriptsByBundleId
extra["saltmarcherBuildHarnessHostScriptsByBundleId"] = buildHarnessHostScriptsByBundleId
extra["saltmarcherErrorProneHostScriptsByBundleId"] = errorProneHostScriptsByBundleId
extra["saltmarcherErrorProneSourceDirsByBundleId"] = errorProneSourceDirsByBundleId
extra["saltmarcherErrorProneServiceFilesByBundleId"] = errorProneServiceFilesByBundleId
extra["saltmarcherPmdHostScriptsByBundleId"] = pmdHostScriptsByBundleId
