package saltmarcher.buildlogic.verification

import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.plugins.ExtensionAware
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.kotlin.dsl.getByType
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.register
import org.gradle.kotlin.dsl.withGroovyBuilder
import saltmarcher.buildlogic.enforcement.EnforcementBundlesExtension
import saltmarcher.buildlogic.tasks.CheckViewFxmlResourcesTask

class SaltmarcherViewViewEnforcementPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        project.pluginManager.apply("saltmarcher.enforcement-bundles")
        project.configureViewViewEnforcement()
    }
}

internal fun Project.configureViewViewEnforcement() {
    val enforcementBundles = extensions.getByType(EnforcementBundlesExtension::class.java)
    val focusedEnforcementBundleMode = enforcementBundles.focusedEnforcementBundleMode
    val verificationHarness = extensions.getByType<VerificationHarnessExtension>()
    val descriptor = enforcementBundles.descriptor("view")

    val viewCheckerNames = descriptor.errorProneCheckers
    val compileViewVerificationJava = verificationHarness.registerFocusedVerificationCompileTask(
        "view",
        viewCheckerNames,
        "Compile only the passive View verification slice with the passive View Error Prone checks enabled."
    )
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
        }
    }

    val viewSurfaceArchitectureTest = verificationHarness.registerFocusedArchunitTestTask(
        "view",
        "viewSurfaceArchitectureTest",
        "Run only the passive View-focused architecture test suite.",
        selectedViewCompileJava,
        listOf(
            project.file("tools/quality/view-view-enforcement/archunit/src/test/java").absolutePath,
            project.file("test").absolutePath
        ),
        listOf("architecture/**"),
        listOf("architecture/view/view/**"),
        false
    )

    val checkViewFxmlResources = tasks.register<CheckViewFxmlResourcesTask>("checkViewFxmlResources") {
        group = "verification"
        description = "Validate declarative passive-view FXML resource placement and controller ownership."
        projectRoot.set(layout.projectDirectory)
        verificationInputs.from(
            layout.projectDirectory.asFileTree.matching {
                include("resources/**")
                include("shell/**")
                include("src/**")
                exclude("**/.gradle/**")
                exclude("**/build/**")
                exclude("**/.git/**")
            }
        )
        successMarker.set(layout.buildDirectory.file("verification-markers/checkViewFxmlResources/success.marker"))
    }

    val jqassistant = descriptor.jqassistantTasks.single { it.taskName == "checkViewEnforcement" }
    val jqassistantViewEnforcementTasks = verificationHarness.registerFocusedJqassistantTaskPair(
        "view",
        jqassistant.scanTaskName,
        jqassistant.analyzeTaskName,
        jqassistant.scanDescription,
        jqassistant.analyzeDescription,
        jqassistant.ruleGroups,
        jqassistant.rulesDirPaths,
        jqassistant.reportsDirPath,
        selectedViewCompileJava
    )

    val checkViewEnforcement = tasks.register("checkViewEnforcement") {
        group = "verification"
        description = "Run all currently active passive View enforcement checks through one root entrypoint."
        dependsOn(selectedViewCompileJava)
        dependsOn(viewSurfaceArchitectureTest)
        dependsOn(checkViewFxmlResources)
        dependsOn(jqassistantViewEnforcementTasks.analyzeTask)
    }

    verificationHarness.checkArchitecture.configure {
        dependsOn(checkViewEnforcement)
    }
    verificationHarness.check.configure {
        dependsOn(checkViewEnforcement)
    }
}
