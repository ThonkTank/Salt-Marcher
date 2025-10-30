#!/bin/bash
# Automatic Claude Code Session Continuation
#
# Starts Claude Code and automatically submits continuation prompts when idle.
# Uses expect for automation and detects completion via inactivity timeout.
#
# Usage:
#   ./auto-continue-claude.sh [--timeout SECONDS] [--max-iterations N]
#
# Options:
#   --timeout SECONDS     Wait time before considering Claude idle (default: 60)
#   --max-iterations N    Maximum auto-continues (default: unlimited)
#   --debug              Enable verbose logging

set -e

# Default configuration
TIMEOUT=60
MAX_ITERATIONS=-1
DEBUG=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --max-iterations)
            MAX_ITERATIONS="$2"
            shift 2
            ;;
        --debug)
            DEBUG=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Check for expect
if ! command -v expect &> /dev/null; then
    echo "Error: 'expect' is not installed."
    echo "Install with: sudo dnf install expect"
    exit 1
fi

# The continuation prompt
CONTINUATION_PROMPT="Lies dir die Arbeitsweisen, Ziele und die Roadmap in CLAUDE.md durch. Mache dich mit der bisherigen Implementation des Projekts vertraut. Stelle sicher, dass die Roadmap aktuell, die nächsten Arbeitsschritte klar formuliert, relevante Dokumentation up to date und die CLAUDE.md nicht länger als 40k zeichen ist (Verändere allerdings NIEMALS die angegebenen Ziele und Arbeitsweisen!). Fahre dann mit der Implementation des Projekts fort. Halte Roadmap und Dokumentation mit deinem Fortschritt aktuell."

# Create expect script
EXPECT_SCRIPT=$(cat <<'EXPECT_EOF'
#!/usr/bin/expect -f

set timeout $env(TIMEOUT)
set max_iterations $env(MAX_ITERATIONS)
set continuation_prompt $env(CONTINUATION_PROMPT)
set debug $env(DEBUG)
set project_root $env(PROJECT_ROOT)

log_user 1

proc debug_log {msg} {
    global debug
    if {$debug == "true"} {
        puts "\n[DEBUG] $msg"
    }
}

proc send_continuation {} {
    global continuation_prompt
    debug_log "Sending continuation prompt..."
    send -- "$continuation_prompt\r"
    debug_log "Prompt sent!"
}

# Change to project directory
cd $project_root

# Start Claude Code
debug_log "Starting Claude Code..."
spawn claude

set iteration 0

# Wait for initial prompt and send first command
expect {
    timeout {
        debug_log "Timeout waiting for initial prompt"
        exit 1
    }
    -re {.*} {
        debug_log "Claude Code started, sending initial prompt"
        send_continuation
    }
}

# Main loop: wait for idle and auto-continue
while {1} {
    if {$max_iterations != -1 && $iteration >= $max_iterations} {
        debug_log "Max iterations reached: $iteration"
        break
    }

    expect {
        timeout {
            # No output for TIMEOUT seconds - Claude is idle
            incr iteration
            puts "\n"
            puts "=========================================="
            puts "Auto-continue triggered (iteration $iteration)"
            puts "=========================================="
            send_continuation
        }
        eof {
            debug_log "Claude Code exited"
            break
        }
        -re {.*} {
            # Got output, keep waiting
            exp_continue
        }
    }
}

debug_log "Script completed after $iteration iterations"
EXPECT_EOF
)

# Export variables for expect
export TIMEOUT
export MAX_ITERATIONS
export CONTINUATION_PROMPT
export DEBUG
export PROJECT_ROOT

echo "=========================================="
echo "Claude Code Auto-Continue"
echo "=========================================="
echo "Configuration:"
echo "  Timeout: ${TIMEOUT}s"
echo "  Max iterations: ${MAX_ITERATIONS:-unlimited}"
echo "  Debug: $DEBUG"
echo "  Project: $PROJECT_ROOT"
echo ""
echo "Starting Claude Code with auto-continue..."
echo "Press Ctrl+C to stop at any time."
echo "=========================================="
echo ""

# Run the expect script
echo "$EXPECT_SCRIPT" | expect

echo ""
echo "Session ended."
