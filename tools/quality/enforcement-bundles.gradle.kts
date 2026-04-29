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

val rootHostScriptsByBundleId = mapOf(
    "view" to "tools/quality/view-view-enforcement/root-host.gradle.kts",
    "viewContribution" to "tools/quality/view-contribution-enforcement/root-host.gradle.kts",
    "viewBinder" to "tools/quality/view-binder-enforcement/root-host.gradle.kts",
    "viewLayer" to "tools/quality/view-layer-enforcement/root-host.gradle.kts",
    "viewInspectorEntry" to "tools/quality/view-inspector-entry-enforcement/root-host.gradle.kts",
    "viewInputEvent" to "tools/quality/viewinputevent-enforcement/root-host.gradle.kts",
    "viewPublishedEvent" to "tools/quality/publishedevent-enforcement/root-host.gradle.kts",
    "viewIntentHandler" to "tools/quality/viewintenthandler-enforcement/root-host.gradle.kts",
    "viewContributionModel" to "tools/quality/view-contributionmodel-enforcement/root-host.gradle.kts",
    "viewContentModel" to "tools/quality/view-content-model-enforcement/root-host.gradle.kts"
)

val buildHarnessHostScriptsByBundleId = mapOf(
    "viewLayer" to "../../quality/view-layer-enforcement/build-harness-host.gradle.kts",
    "viewInspectorEntry" to "../../quality/view-inspector-entry-enforcement/build-harness-host.gradle.kts",
    "viewInputEvent" to "../../quality/viewinputevent-enforcement/build-harness-host.gradle.kts",
    "viewIntentHandler" to "../../quality/viewintenthandler-enforcement/build-harness-host.gradle.kts",
    "viewContributionModel" to "../../quality/view-contributionmodel-enforcement/build-harness-host.gradle.kts",
    "viewContentModel" to "../../quality/view-content-model-enforcement/build-harness-host.gradle.kts"
)

val errorProneHostScriptsByBundleId = mapOf(
    "view" to "../../view-view-enforcement/errorprone-host.gradle.kts",
    "viewContribution" to "../../view-contribution-enforcement/errorprone-host.gradle.kts",
    "viewBinder" to "../../view-binder-enforcement/errorprone-host.gradle.kts",
    "viewInspectorEntry" to "../../view-inspector-entry-enforcement/errorprone-host.gradle.kts",
    "viewInputEvent" to "../../viewinputevent-enforcement/errorprone-host.gradle.kts",
    "viewPublishedEvent" to "../../publishedevent-enforcement/errorprone-host.gradle.kts",
    "viewIntentHandler" to "../../viewintenthandler-enforcement/errorprone-host.gradle.kts",
    "viewContributionModel" to "../../view-contributionmodel-enforcement/errorprone-host.gradle.kts",
    "viewContentModel" to "../../view-content-model-enforcement/errorprone-host.gradle.kts"
)

val errorProneSourceDirsByBundleId = mapOf(
    "view" to "../../view-view-enforcement/errorprone/src/main/java",
    "viewContribution" to "../../view-contribution-enforcement/errorprone/src/main/java",
    "viewBinder" to "../../view-binder-enforcement/errorprone/src/main/java",
    "viewInspectorEntry" to "../../view-inspector-entry-enforcement/errorprone/src/main/java",
    "viewInputEvent" to "../../viewinputevent-enforcement/errorprone/src/main/java",
    "viewPublishedEvent" to "../../publishedevent-enforcement/errorprone/src/main/java",
    "viewIntentHandler" to "../../viewintenthandler-enforcement/errorprone/src/main/java",
    "viewContributionModel" to "../../view-contributionmodel-enforcement/errorprone/src/main/java",
    "viewContentModel" to "../../view-content-model-enforcement/errorprone/src/main/java"
)

val errorProneServiceFilesByBundleId = mapOf(
    "view" to "../../view-view-enforcement/errorprone/src/main/resources/META-INF/services/com.google.errorprone.bugpatterns.BugChecker",
    "viewContribution" to "../../view-contribution-enforcement/errorprone/src/main/resources/META-INF/services/com.google.errorprone.bugpatterns.BugChecker",
    "viewBinder" to "../../view-binder-enforcement/errorprone/src/main/resources/META-INF/services/com.google.errorprone.bugpatterns.BugChecker",
    "viewInspectorEntry" to "../../view-inspector-entry-enforcement/errorprone/src/main/resources/META-INF/services/com.google.errorprone.bugpatterns.BugChecker",
    "viewInputEvent" to "../../viewinputevent-enforcement/errorprone/src/main/resources/META-INF/services/com.google.errorprone.bugpatterns.BugChecker",
    "viewPublishedEvent" to "../../publishedevent-enforcement/errorprone/src/main/resources/META-INF/services/com.google.errorprone.bugpatterns.BugChecker",
    "viewIntentHandler" to "../../viewintenthandler-enforcement/errorprone/src/main/resources/META-INF/services/com.google.errorprone.bugpatterns.BugChecker",
    "viewContributionModel" to "../../view-contributionmodel-enforcement/errorprone/src/main/resources/META-INF/services/com.google.errorprone.bugpatterns.BugChecker",
    "viewContentModel" to "../../view-content-model-enforcement/errorprone/src/main/resources/META-INF/services/com.google.errorprone.bugpatterns.BugChecker"
)

val pmdHostScriptsByBundleId = mapOf(
    "viewContribution" to "../../view-contribution-enforcement/pmd-host.gradle.kts"
)

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
