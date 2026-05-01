import org.gradle.api.plugins.ExtensionAware
import org.gradle.api.tasks.compile.JavaCompile
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.registering
import org.gradle.kotlin.dsl.withGroovyBuilder

tasks.named<JavaCompile>("compileJava") {
    val errorproneOptions = (options as ExtensionAware).extensions.getByName("errorprone")
    errorproneOptions.withGroovyBuilder {
        "error"("DomainEntityRoleShape")
    }
}

val checkDomainEntityEnforcement by tasks.registering {
    group = "verification"
    description = "Run the focused Domain Entity enforcement bundle through one root entrypoint."
    dependsOn("compileJava")
    dependsOn(gradle.includedBuild("build-harness").task(":domainEntityEnforcementDocumentationCheck"))
}
