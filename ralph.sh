#!/bin/bash

set -e

PLAN_FILE="IMPLEMENTATION_PLAN.md"
PROMPT_FILE="PROMPT.md"

while true; do
    next_task=$(grep -m1 '^\- \[ \]' "$PLAN_FILE" || true)

    if [ -z "$next_task" ]; then
        echo "All tasks complete!"
        exit 0
    fi

    echo "========================================"
    echo "Next task: $next_task"
    echo "========================================"

    cc_sandbox -p --dangerously-skip-permissions < "$PROMPT_FILE"
done
