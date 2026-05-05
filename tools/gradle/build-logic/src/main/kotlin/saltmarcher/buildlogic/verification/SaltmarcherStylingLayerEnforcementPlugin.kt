package saltmarcher.buildlogic.verification

import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.plugins.ExtensionAware
import org.gradle.api.plugins.quality.Pmd
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.kotlin.dsl.getByType
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.register
import org.gradle.kotlin.dsl.withGroovyBuilder
import saltmarcher.buildlogic.enforcement.EnforcementBundlesExtension
import saltmarcher.buildlogic.tasks.CheckCentralizedStylesheetsTask
import saltmarcher.buildlogic.tasks.CheckDefinedStyleClassSelectorsTask
import saltmarcher.buildlogic.tasks.CheckStylingCentralStylesheetOwnerTask

class SaltmarcherStylingLayerEnforcementPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        project.pluginManager.apply("saltmarcher.enforcement-bundles")
        project.configureStylingLayerEnforcement()
    }
}

internal fun Project.configureStylingLayerEnforcement() {
    val stylingStylesheetExtensions = listOf("css", "scss", "sass", "less", "styl")
    val stylingCanonicalStylesheetRelativePath = "salt-marcher.css"
    val stylingStylesheetRelativePathProvider = providers.gradleProperty("saltMarcherStylesheet")
        .orElse("resources/$stylingCanonicalStylesheetRelativePath")
    val stylingSourceRoots = files("bootstrap", "shell", "src")
    val stylingLayerRulesetFile = project.file("tools/quality/styling-layer-enforcement/pmd/ruleset.xml")

    val enforcementBundles = extensions.getByType(EnforcementBundlesExtension::class.java)
    val focusedEnforcementBundleMode = enforcementBundles.focusedEnforcementBundleMode
    val verificationHarness = extensions.getByType<VerificationHarnessExtension>()

    val stylingLayerCheckerNames = listOf("ViewProgrammaticStyling")
    val compileStylingLayerVerificationJava = verificationHarness.registerFocusedVerificationCompileTask(
        "stylingLayer",
        stylingLayerCheckerNames,
        "Compile only the centralized styling-layer verification slice with the styling Error Prone checks enabled."
    )
    val selectedStylingLayerCompileJava = if (focusedEnforcementBundleMode) {
        compileStylingLayerVerificationJava
    } else {
        tasks.named<JavaCompile>("compileJava")
    }

    tasks.named<JavaCompile>("compileJava") {
        val errorproneOptions = (options as ExtensionAware).extensions.getByName("errorprone")
        errorproneOptions.withGroovyBuilder {
            stylingLayerCheckerNames.forEach { checkName ->
                "error"(checkName)
            }
        }
    }

    val stylingStylesheetFiles = layout.projectDirectory.asFileTree.matching {
        stylingStylesheetExtensions.forEach { extension -> include("**/*.$extension") }
        exclude("**/.git/**", "**/.gradle/**", "**/build/**")
    }
    val stylingJavaSourceFiles = stylingSourceRoots.asFileTree.matching {
        include("**/*.java")
        exclude("**/build/**")
    }

    val checkCentralizedStylesheets = tasks.register("checkCentralizedStylesheets", CheckCentralizedStylesheetsTask::class) {
        group = "verification"
        description = "Fail if stylesheet files exist outside the central resources/salt-marcher.css file."
        stylesheetFiles.from(stylingStylesheetFiles)
        canonicalStylesheetRelativePath.set("resources/$stylingCanonicalStylesheetRelativePath")
        canonicalStylesheetFile.set(layout.projectDirectory.file("resources/$stylingCanonicalStylesheetRelativePath"))
        successMarker.set(layout.buildDirectory.file("verification-markers/checkCentralizedStylesheets/success.marker"))
    }

    val checkStylingCentralStylesheetOwner = tasks.register("checkStylingCentralStylesheetOwner", CheckStylingCentralStylesheetOwnerTask::class) {
        group = "verification"
        description = "Fail if SaltMarcher styling stops using the canonical resources/salt-marcher.css owner."
        configuredStylesheetPath.set(stylingStylesheetRelativePathProvider)
        canonicalStylesheetRelativePath.set("resources/$stylingCanonicalStylesheetRelativePath")
        canonicalStylesheetFile.set(layout.projectDirectory.file("resources/$stylingCanonicalStylesheetRelativePath"))
        successMarker.set(layout.buildDirectory.file("verification-markers/checkStylingCentralStylesheetOwner/success.marker"))
    }

    val checkDefinedStyleClassSelectors = tasks.register("checkDefinedStyleClassSelectors", CheckDefinedStyleClassSelectorsTask::class) {
        group = "verification"
        description = "Fail if Java-authored style classes are missing from resources/salt-marcher.css selectors."
        stylesheetFiles.from(stylingStylesheetFiles)
        javaSourceFiles.from(stylingJavaSourceFiles)
        successMarker.set(layout.buildDirectory.file("verification-markers/checkDefinedStyleClassSelectors/success.marker"))
    }

    val pmdStylingLayerEnforcement = tasks.register("pmdStylingLayerEnforcement", Pmd::class) {
        group = "verification"
        description = "Run the dedicated styling-layer PMD rule bundle."
        dependsOn(gradle.includedBuild("quality-rules").task(":jar"))

        ignoreFailures = false
        ruleSets = listOf()
        ruleSetFiles = files(stylingLayerRulesetFile)
        source = stylingSourceRoots.asFileTree
        include("**/*.java")
        classpath = files()
        reports {
            html.required.set(true)
            xml.required.set(true)
        }
    }

    val checkStylingLayerEnforcement = tasks.register("checkStylingLayerEnforcement") {
        group = "verification"
        description = "Run the centralized styling-layer enforcement bundle through one root entrypoint."
        dependsOn(selectedStylingLayerCompileJava)
        dependsOn(checkCentralizedStylesheets)
        dependsOn(checkStylingCentralStylesheetOwner)
        dependsOn(checkDefinedStyleClassSelectors)
        dependsOn(pmdStylingLayerEnforcement)
    }

    verificationHarness.checkArchitecture.configure {
        dependsOn(checkStylingLayerEnforcement)
    }
    verificationHarness.check.configure {
        dependsOn(checkStylingLayerEnforcement)
    }
}
