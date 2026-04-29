pluginManagement {
    includeBuild("tools/gradle/build-logic")
}

apply(from = "tools/gradle/build-isolation.settings.gradle.kts")

val enforcementBundleIdsInOrder = listOf(
    "view",
    "viewContribution",
    "viewBinder",
    "viewLayer",
    "viewInspectorEntry",
    "viewInputEvent",
    "viewPublishedEvent",
    "viewIntentHandler",
    "viewContributionModel",
    "viewContentModel"
)

val enforcementBundleTaskToId = mapOf(
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
    "checkViewIntentHandlerEnforcement" to "viewIntentHandler",
    "viewIntentHandlerArchitectureTest" to "viewIntentHandler",
    "viewIntentHandlerTopologyCheck" to "viewIntentHandler",
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

rootProject.name = "SaltMarcher"

includeBuild("tools/gradle/build-harness")
includeBuild("tools/quality/rules/quality-rules")
includeBuild("tools/quality/incubator/quality-rules-errorprone")
