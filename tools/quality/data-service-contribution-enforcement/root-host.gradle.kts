import org.gradle.api.plugins.ExtensionAware
import org.gradle.api.plugins.quality.Pmd
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.kotlin.dsl.registering
import org.gradle.kotlin.dsl.withGroovyBuilder

val dataServiceContributionRulesetFile = layout.projectDirectory.file(
    "tools/quality/data-service-contribution-enforcement/pmd/ruleset.xml"
)

tasks.named<JavaCompile>("compileJava") {
    val errorproneOptions = (options as ExtensionAware).extensions.getByName("errorprone")
    errorproneOptions.withGroovyBuilder {
        listOf(
            "DataServiceContributionConstructionPurity",
            "DataServiceContributionShellApiAllowlist",
            "DataServiceContributionRegisterExportShape"
        ).forEach { checkName ->
            "error"(checkName)
        }
    }
}

val pmdDataServiceContributionEnforcement by tasks.registering(Pmd::class) {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Run the dedicated Data ServiceContribution PMD enforcement bundle."
    dependsOn(gradle.includedBuild("quality-rules").task(":jar"))

    ignoreFailures = false
    ruleSets = listOf()
    ruleSetFiles = files(dataServiceContributionRulesetFile)
    source = fileTree("src/data") {
        include("**/*.java")
    }
    classpath = files()

    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Architecture gate diagnostics must be produced by the current invocation.") { true }
    reports {
        html.required.set(true)
        xml.required.set(true)
    }
}

val checkDataServiceContributionEnforcement by tasks.registering {
    group = "verification"
    description = "Run the dedicated Data ServiceContribution enforcement bundle through one root entrypoint."
    dependsOn("compileJava")
    dependsOn(pmdDataServiceContributionEnforcement)
    dependsOn(gradle.includedBuild("build-harness").task(":dataServiceContributionDocumentationEnforcementCheck"))
}

tasks.matching { it.name == "checkArchitecture" }.configureEach {
    dependsOn(checkDataServiceContributionEnforcement)
}

tasks.named("check") {
    dependsOn(checkDataServiceContributionEnforcement)
}
