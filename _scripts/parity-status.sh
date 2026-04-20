#!/usr/bin/env bash
#
# parity-status.sh — list parity status across all features.
#
# Reads specs/features/*/parity.md and extracts the first status emoji
# from each platform's "Status:" line.
#
# Usage:
#   specs/_scripts/parity-status.sh              # full table
#   specs/_scripts/parity-status.sh --outdated   # only features where Flutter lags Angular
#   specs/_scripts/parity-status.sh --markdown   # emit a Markdown row set for README.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SPECS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FEATURES_DIR="$SPECS_DIR/features"

MODE="table"
while [ "$#" -gt 0 ]; do
    case "$1" in
        --outdated) MODE="outdated"; shift ;;
        --markdown) MODE="markdown"; shift ;;
        -h | --help)
            sed -n '3,12p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'
            exit 0
            ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

extract_status() {
    local file="$1"
    local section="$2"
    awk -v sec="$section" '
        $0 ~ "^## " sec "$" { in_section = 1; next }
        /^## / { in_section = 0; next }
        in_section && /\*\*Status:\*\*/ { print; exit }
    ' "$file"
}

status_emoji() {
    local line="$1"
    if   [[ "$line" == *"✅"* ]]; then echo "✅"
    elif [[ "$line" == *"🚧"* ]]; then echo "🚧"
    elif [[ "$line" == *"❌"* ]]; then echo "❌"
    elif [[ "$line" == *"⏳"* ]]; then echo "⏳"
    else echo "?"
    fi
}

is_outdated() {
    # Flutter lags Angular when Angular is ✅ or 🚧 but Flutter is ⏳ or ?
    local ang="$1" flu="$2"
    case "$ang:$flu" in
        "✅:⏳"|"✅:?"|"🚧:⏳"|"🚧:?") return 0 ;;
        *) return 1 ;;
    esac
}

shopt -s nullglob
feature_dirs=("$FEATURES_DIR"/*/)

if [ ${#feature_dirs[@]} -eq 0 ]; then
    echo "No features found under $FEATURES_DIR" >&2
    exit 0
fi

case "$MODE" in
    table)
        printf "%-40s %-10s %-10s\n" "FEATURE" "ANGULAR" "FLUTTER"
        printf "%-40s %-10s %-10s\n" "----------------------------------------" "-------" "-------"
        ;;
esac

for dir in "${feature_dirs[@]}"; do
    slug="$(basename "$dir")"
    parity_file="$dir/parity.md"

    if [ ! -f "$parity_file" ]; then
        case "$MODE" in
            table) printf "%-40s %-10s %-10s  (no parity.md)\n" "$slug" "?" "?" ;;
        esac
        continue
    fi

    ang_line="$(extract_status "$parity_file" "Angular")"
    flu_line="$(extract_status "$parity_file" "Flutter")"
    ang="$(status_emoji "$ang_line")"
    flu="$(status_emoji "$flu_line")"

    case "$MODE" in
        table)
            printf "%-40s %-10s %-10s\n" "$slug" "$ang" "$flu"
            ;;
        outdated)
            if is_outdated "$ang" "$flu"; then
                printf "%-40s Angular=%s  Flutter=%s\n" "$slug" "$ang" "$flu"
            fi
            ;;
        markdown)
            title="$(echo "$slug" | tr '-' ' ' | awk '{for(i=1;i<=NF;i++) $i = toupper(substr($i,1,1)) substr($i,2)} 1')"
            printf "| %s | %s | %s | [%s/](./features/%s/spec.md) |\n" "$title" "$ang" "$flu" "$slug" "$slug"
            ;;
    esac
done
