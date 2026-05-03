import org.gradle.api.plugins.ExtensionAware
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.TaskProvider
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.api.tasks.testing.Test
import org.gradle.kotlin.dsl.creating
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.registering
import org.gradle.kotlin.dsl.the
import org.gradle.kotlin.dsl.withGroovyBuilder
import saltmarcher.buildlogic.enforcement.EnforcementBundlesExtension

plugins {
    id("saltmarcher.enforcement-bundles")
}

private val passiveViewCallbackSeamTechnicalBaseViews = listOf(
    "src.view.slotcontent.primitives.mapcanvas.MapCanvasView",
    "src.view.slotcontent.primitives.popup.AnchoredPopupView",
    "src.view.slotcontent.topbar.dropdown.DropdownPopupView"
).joinToString(",")

val enforcementBundles = extensions.getByType(EnforcementBundlesExtension::class.java)
val focusedEnforcementBundleMode = enforcementBundles.focusedEnforcementBundleMode

@Suppress("UNCHECKED_CAST")
val registerFocusedVerificationCompileTask = extra["saltmarcherRegisterFocusedVerificationCompileTask"] as
    (String, List<String>, String) -> TaskProvider<JavaCompile>
@Suppress("UNCHECKED_CAST")
val registerFocusedArchunitTestTask = extra["saltmarcherRegisterFocusedArchunitTestTask"] as
    (String, String, String, TaskProvider<JavaCompile>, List<String>, List<String>, List<String>, Boolean) -> TaskProvider<Test>
@Suppress("UNCHECKED_CAST")
val registerFocusedJqassistantTaskPair = extra["saltmarcherRegisterFocusedJqassistantTaskPair"] as
    (String, String, String, String, String, String, String, String, TaskProvider<JavaCompile>) -> Pair<TaskProvider<*>, TaskProvider<*>>

val sourceSets = the<SourceSetContainer>()
val viewViewEnforcementSupport by sourceSets.creating {
    java.srcDir("tools/quality/view-view-enforcement/support/src/main/java")
}

val viewCheckerNames = listOf(
    "PassiveViewDependencyBoundaries",
    "PassiveViewModelReadApis",
    "PassiveViewModelMutationBoundary",
    "ViewPresentationDecisionLeak",
    "ViewInputEventApi",
    "PassiveViewCallbackSeamBoundary"
)
val compileViewVerificationJava = registerFocusedVerificationCompileTask(
    "view",
    viewCheckerNames,
    "Compile only the passive View verification slice with the passive View Error Prone checks enabled."
)
compileViewVerificationJava.configure {
    val errorproneOptions = (options as ExtensionAware).extensions.getByName("errorprone")
    errorproneOptions.withGroovyBuilder {
        "option"(
            "PassiveViewCallbackSeamBoundary:TechnicalBaseViews",
            passiveViewCallbackSeamTechnicalBaseViews
        )
    }
}
val selectedViewCompileJava = if (focusedEnforcementBundleMode) {
    compileViewVerificationJava
} else {
    tasks.named<JavaCompile>("compileJava")
}

tasks.named<JavaCompile>("compileJava") {
    val errorproneOptions = (options as ExtensionAware).extensions.getByName("errorprone")
    errorproneOptions.withGroovyBuilder {
        viewCheckerNames.forEach { checkName ->
            "error"(checkName)
        }
        "option"(
            "PassiveViewCallbackSeamBoundary:TechnicalBaseViews",
            passiveViewCallbackSeamTechnicalBaseViews
        )
    }
}

val viewSurfaceArchitectureTest = registerFocusedArchunitTestTask(
    "view",
    "viewSurfaceArchitectureTest",
    "Run only the passive View-focused architecture test suite.",
    selectedViewCompileJava,
    listOf(project.file("tools/quality/view-view-enforcement/archunit/src/test/java").absolutePath),
    listOf("architecture/**"),
    listOf("architecture/view/view/**"),
    false
)

val checkViewFxmlResources by tasks.registering(org.gradle.api.tasks.JavaExec::class) {
    group = "verification"
    description = "Validate declarative passive-view FXML resource placement and controller ownership."
    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Architecture gate diagnostics must be produced by the current invocation.") { true }
    classpath = viewViewEnforcementSupport.runtimeClasspath
    mainClass = "saltmarcher.quality.viewview.fxml.ViewFxmlResourceCheckMain"
    args = listOf(layout.projectDirectory.asFile.absolutePath)
}

val (_, jqassistantAnalyzeViewEnforcement) = registerFocusedJqassistantTaskPair(
    "view",
    "jqassistantScanViewEnforcement",
    "jqassistantAnalyzeViewEnforcement",
    "Scan SaltMarcher passive View topology for the dedicated passive View enforcement bundle.",
    "Analyze SaltMarcher passive View topology constraints through the dedicated passive View bundle.",
    project.file("tools/quality/view-view-enforcement/jqassistant/config.yml").absolutePath,
    project.file("tools/quality/view-view-enforcement/jqassistant/rules").absolutePath,
    "reports/jqassistant-view-view-enforcement",
    selectedViewCompileJava
)

tasks.register("checkViewEnforcement") {
    group = "verification"
    description = "Run all currently active passive View enforcement checks through one root entrypoint."
    dependsOn(selectedViewCompileJava)
    dependsOn(viewSurfaceArchitectureTest)
    dependsOn(checkViewFxmlResources)
    dependsOn(jqassistantAnalyzeViewEnforcement)
}

tasks.matching { it.name == "checkArchitecture" }.configureEach {
    dependsOn("checkViewEnforcement")
}

tasks.named("check") {
    dependsOn("checkViewEnforcement")
}
