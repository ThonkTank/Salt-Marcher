import org.gradle.api.plugins.ExtensionAware
import org.gradle.api.plugins.quality.Pmd
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.registering
import org.gradle.kotlin.dsl.withGroovyBuilder

val domainApplicationServiceRulesetFile = layout.projectDirectory.file(
    "tools/quality/domain-application-service-enforcement/pmd/ruleset.xml"
)

tasks.named<JavaCompile>("compileJava") {
    val errorproneOptions = (options as ExtensionAware).extensions.getByName("errorprone")
    errorproneOptions.withGroovyBuilder {
        "error"("DomainApplicationServiceApiShape")
        "error"("DomainPublicBoundarySignaturePurity")
    }
}

val pmdDomainApplicationServiceEnforcement by tasks.registering(Pmd::class) {
    group = LifecycleBasePlugin.VERIFICATION_GROUP
    description = "Run the dedicated Domain ApplicationService PMD enforcement bundle."
    dependsOn(gradle.includedBuild("quality-rules").task(":jar"))

    ignoreFailures = false
    ruleSets = listOf()
    ruleSetFiles = files(domainApplicationServiceRulesetFile)
    source = files("bootstrap", "shell", "src").asFileTree
    include("**/*.java")
    classpath = files()

    outputs.upToDateWhen { false }
    outputs.doNotCacheIf("Architecture gate diagnostics must be produced by the current invocation.") { true }
    reports {
        html.required.set(true)
        xml.required.set(true)
    }
}

val checkDomainApplicationServiceEnforcement by tasks.registering {
    group = "verification"
    description = "Run the dedicated Domain ApplicationService enforcement bundle through one root entrypoint."
    dependsOn("compileJava")
    dependsOn(pmdDomainApplicationServiceEnforcement)
    dependsOn(gradle.includedBuild("build-harness").task(":domainApplicationServiceTopologyCheck"))
    dependsOn(gradle.includedBuild("build-harness").task(":domainApplicationServiceDocumentationEnforcementCheck"))
}

tasks.matching { it.name == "checkArchitecture" }.configureEach {
    dependsOn(checkDomainApplicationServiceEnforcement)
}
