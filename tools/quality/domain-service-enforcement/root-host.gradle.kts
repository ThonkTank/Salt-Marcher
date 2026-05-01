import org.gradle.api.plugins.ExtensionAware
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.registering
import org.gradle.kotlin.dsl.withGroovyBuilder

tasks.named<JavaCompile>("compileJava") {
    val errorproneOptions = (options as ExtensionAware).extensions.getByName("errorprone")
    errorproneOptions.withGroovyBuilder {
        listOf(
            "DomainServiceRoleShape",
            "DomainServiceStatelessness"
        ).forEach { checkName ->
            "error"(checkName)
        }
    }
}

val checkDomainServiceEnforcement by tasks.registering {
    group = "verification"
    description = "Run the focused Domain Service enforcement bundle through one root entrypoint."
    dependsOn("compileJava")
    dependsOn(gradle.includedBuild("build-harness").task(":domainServiceEnforcementDocumentationCheck"))
}

tasks.matching { it.name == "checkArchitecture" }.configureEach {
    dependsOn(checkDomainServiceEnforcement)
}

tasks.named("check") {
    dependsOn(checkDomainServiceEnforcement)
}
