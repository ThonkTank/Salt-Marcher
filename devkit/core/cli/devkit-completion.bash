#!/bin/bash
# Bash completion for Salt Marcher DevKit
# Installation:
#   source devkit/core/cli/devkit-completion.bash
# Or add to ~/.bashrc:
#   source /path/to/salt-marcher/devkit/core/cli/devkit-completion.bash

_devkit_completion() {
    local cur prev opts
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"

    # Main commands
    local main_commands="test debug ui migrate workflow backup generate hooks reload logs validate version --help -h"

    # Test subcommands
    local test_commands="run generate validate watch"

    # Debug subcommands
    local debug_commands="enable disable logs marker analyze config"

    # UI subcommands
    local ui_commands="open validate measure inspect find"

    # Workflow subcommands
    local workflow_commands="list run create"

    # Backup subcommands
    local backup_commands="create list restore delete"

    # Generate subcommands
    local generate_commands="entity ipc-command cli-command migration test"

    # Hooks subcommands
    local hooks_commands="install uninstall status configure"

    # Entity types for 'ui open'
    local entity_types="creature spell item equipment"

    # Validation modes
    local validation_modes="all labels steppers"

    # Common options
    local common_options="--help --verbose --dry-run --force"

    # Get the main command (first word after 'devkit')
    local main_cmd=""
    for i in "${!COMP_WORDS[@]}"; do
        if [[ $i -gt 0 && "${COMP_WORDS[$i]}" != -* ]]; then
            main_cmd="${COMP_WORDS[$i]}"
            break
        fi
    done

    # Complete based on position and previous word
    case "${prev}" in
        devkit|./devkit)
            # Complete main commands
            COMPREPLY=( $(compgen -W "${main_commands}" -- ${cur}) )
            return 0
            ;;
        test)
            # Complete test subcommands
            COMPREPLY=( $(compgen -W "${test_commands}" -- ${cur}) )
            return 0
            ;;
        debug)
            # Complete debug subcommands
            COMPREPLY=( $(compgen -W "${debug_commands}" -- ${cur}) )
            return 0
            ;;
        ui)
            # Complete UI subcommands
            COMPREPLY=( $(compgen -W "${ui_commands}" -- ${cur}) )
            return 0
            ;;
        workflow)
            # Complete workflow subcommands
            COMPREPLY=( $(compgen -W "${workflow_commands}" -- ${cur}) )
            return 0
            ;;
        backup)
            # Complete backup subcommands
            COMPREPLY=( $(compgen -W "${backup_commands}" -- ${cur}) )
            return 0
            ;;
        generate)
            # Complete generate subcommands
            COMPREPLY=( $(compgen -W "${generate_commands}" -- ${cur}) )
            return 0
            ;;
        hooks)
            # Complete hooks subcommands
            COMPREPLY=( $(compgen -W "${hooks_commands}" -- ${cur}) )
            return 0
            ;;
        migrate)
            # Complete available migrations from devkit/migration/migrations/
            local script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
            local migrations_dir="$script_dir/../../migration/migrations"
            if [ -d "$migrations_dir" ]; then
                local migrations=$(ls "$migrations_dir"/migrate-*.mjs 2>/dev/null | xargs -n1 basename | sed 's/migrate-//g' | sed 's/.mjs//g')
                COMPREPLY=( $(compgen -W "${migrations} --help --dry-run --no-backup" -- ${cur}) )
            fi
            return 0
            ;;
        open)
            # Complete entity types for 'ui open'
            if [[ "${COMP_WORDS[1]}" == "ui" ]]; then
                COMPREPLY=( $(compgen -W "${entity_types}" -- ${cur}) )
            fi
            return 0
            ;;
        validate)
            # Complete validation modes
            if [[ "${COMP_WORDS[1]}" == "ui" || "${COMP_WORDS[1]}" == "test" ]]; then
                COMPREPLY=( $(compgen -W "${validation_modes} --report" -- ${cur}) )
            fi
            return 0
            ;;
        run)
            # Complete workflow names or test suite names depending on context
            if [[ "${COMP_WORDS[1]}" == "workflow" ]]; then
                # Complete workflow names from workflows.json
                local script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
                local workflows_file="$script_dir/../../workflows/workflows.json"
                if [ -f "$workflows_file" ]; then
                    local workflows=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' "$workflows_file" | sed 's/"name"[[:space:]]*:[[:space:]]*"\([^"]*\)"/\1/g')
                    COMPREPLY=( $(compgen -W "${workflows}" -- ${cur}) )
                fi
            elif [[ "${COMP_WORDS[1]}" == "test" ]]; then
                # Complete test suite names from devkit/testing/integration/cases/
                local script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
                local cases_dir="$script_dir/../../testing/integration/cases"
                if [ -d "$cases_dir" ]; then
                    local suites=$(ls "$cases_dir"/*.yaml 2>/dev/null | xargs -n1 basename | sed 's/.yaml//g')
                    COMPREPLY=( $(compgen -W "${suites} all" -- ${cur}) )
                fi
            fi
            return 0
            ;;
        watch)
            # Complete test suite names from devkit/testing/integration/cases/
            local script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
            local cases_dir="$script_dir/../../testing/integration/cases"
            if [ -d "$cases_dir" ]; then
                local suites=$(ls "$cases_dir"/*.yaml 2>/dev/null | xargs -n1 basename | sed 's/.yaml//g')
                COMPREPLY=( $(compgen -W "${suites} all" -- ${cur}) )
            fi
            return 0
            ;;
        restore|delete)
            # Complete backup IDs if the command is backup
            if [[ "${COMP_WORDS[1]}" == "backup" ]]; then
                local script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
                local plugin_root="$script_dir/../../.."
                local backups_dir="$plugin_root/backups"
                if [ -d "$backups_dir" ]; then
                    local backups=$(ls "$backups_dir" 2>/dev/null | sed 's/.tar.gz//g')
                    COMPREPLY=( $(compgen -W "${backups} --force --dry-run" -- ${cur}) )
                fi
            fi
            return 0
            ;;
        enable)
            # Complete debug enable options
            if [[ "${COMP_WORDS[1]}" == "debug" ]]; then
                COMPREPLY=( $(compgen -W "--fields --categories --all" -- ${cur}) )
            fi
            return 0
            ;;
        logs)
            # Suggest common log line counts
            if [[ "${COMP_WORDS[0]}" == "devkit" || "${COMP_WORDS[0]}" == "./devkit" ]]; then
                COMPREPLY=( $(compgen -W "50 100 200 500 1000" -- ${cur}) )
            fi
            return 0
            ;;
        measure|find)
            # For CSS selectors, suggest common prefixes
            COMPREPLY=( $(compgen -W "input select button .class #id [data-" -- ${cur}) )
            return 0
            ;;
        *)
            # Default: suggest common options if we're after a known command
            case "$main_cmd" in
                test|debug|ui|migrate|workflow|backup|generate|hooks)
                    COMPREPLY=( $(compgen -W "${common_options}" -- ${cur}) )
                    ;;
            esac
            return 0
            ;;
    esac
}

# Register completion function
complete -F _devkit_completion devkit
complete -F _devkit_completion ./devkit

# If sourced from the devkit directory, also register for relative paths
if [ -f "./devkit" ]; then
    complete -F _devkit_completion ./devkit
fi

echo "✓ DevKit bash completion loaded"
echo "  Try: devkit <TAB> to see available commands"
