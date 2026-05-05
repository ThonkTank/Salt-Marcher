package saltmarcher.buildlogic.verification

import org.gradle.api.Plugin
import org.gradle.api.Project
import org.gradle.api.plugins.quality.Pmd
import org.gradle.kotlin.dsl.getByType
import org.gradle.kotlin.dsl.register
import saltmarcher.buildlogic.enforcement.EnforcementBundlesExtension

class SaltmarcherLayeringArchitectureEnforcementPlugin : Plugin<Project> {
    override fun apply(project: Project) {
        project.pluginManager.apply("saltmarcher.enforcement-bundles")
        project.configureLayeringArchitectureEnforcement()
    }
}

internal fun Project.configureLayeringArchitectureEnforcement() {
    val enforcementBundles = extensions.getByType(EnforcementBundlesExtension::class.java)
    val verificationHarness = extensions.getByType<VerificationHarnessExtension>()
    val descriptor = enforcementBundles.descriptor("layeringArchitecture")

    val checkLayeringIndirectionCandidates = tasks.register<Pmd>("checkLayeringIndirectionCandidates") {
        group = "verification"
        description = "Run the report-only thin-role indirection candidate PMD scan."
        dependsOn(gradle.includedBuild("quality-rules").task(":jar"))

        ignoreFailures = true
        isConsoleOutput = true
        ruleSets = listOf()
        ruleSetFiles = files(project.file("tools/quality/layering-architecture-enforcement/pmd/ruleset.xml"))
        source = project.files("src").asFileTree.matching {
            include("**/*.java")
        }
        classpath = files()
        reports {
            html.required.set(true)
            xml.required.set(true)
        }
    }

    val checkLayeringArchitectureEnforcement = tasks.register("checkLayeringArchitectureEnforcement") {
        group = "verification"
        description = "Run the dedicated Layering Architecture enforcement bundle through one root entrypoint."
        dependsOn(gradle.includedBuild("build-harness").task(":layeringArchitectureTopologyCheck"))
    }

    verificationHarness.checkArchitecture.configure {
        dependsOn(checkLayeringArchitectureEnforcement)
    }
    verificationHarness.check.configure {
        dependsOn(checkLayeringArchitectureEnforcement)
    }

    require("checkLayeringIndirectionCandidates" in descriptor.taskNames) {
        "Layering Architecture enforcement bundle must declare checkLayeringIndirectionCandidates in taskNames."
    }
}
