#!/usr/bin/env bash
#
# new-spec.sh — scaffold a new feature spec from the template.
#
# Usage:
#   specs/_scripts/new-spec.sh <feature-slug> [--title "Display Name"]
#
# Example:
#   specs/_scripts/new-spec.sh appointment-reminder
#   specs/_scripts/new-spec.sh appointment-reminder --title "Appointment Reminder"
#
# Behavior:
#   - Creates specs/features/<slug>/ by copying _templates/feature/
#   - Substitutes <Name>, <name>, and YYYY-MM-DD placeholders
#   - Refuses to overwrite an existing spec directory
#   - Prints a reminder to update specs/README.md's parity matrix

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SPECS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE_DIR="$SPECS_DIR/_templates/feature"
FEATURES_DIR="$SPECS_DIR/features"

usage() {
    sed -n '3,17p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'
    exit 1
}

if [ "$#" -lt 1 ]; then
    usage
fi

SLUG="$1"
shift

TITLE=""
while [ "$#" -gt 0 ]; do
    case "$1" in
        --title)
            TITLE="${2:-}"
            shift 2
            ;;
        -h | --help)
            usage
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage
            ;;
    esac
done

if ! [[ "$SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
    echo "Error: slug must be lowercase kebab-case (e.g. 'appointment-reminder')" >&2
    echo "Got: '$SLUG'" >&2
    exit 1
fi

TARGET_DIR="$FEATURES_DIR/$SLUG"

if [ -e "$TARGET_DIR" ]; then
    echo "Error: $TARGET_DIR already exists. Refusing to overwrite." >&2
    exit 1
fi

if [ ! -d "$TEMPLATE_DIR" ]; then
    echo "Error: template not found at $TEMPLATE_DIR" >&2
    exit 1
fi

if [ -z "$TITLE" ]; then
    TITLE="$(echo "$SLUG" | tr '-' ' ' | awk '{for(i=1;i<=NF;i++) $i = toupper(substr($i,1,1)) substr($i,2)} 1')"
fi

OWNER="$(git config user.name 2>/dev/null || echo 'unknown')"
TODAY="$(date +%Y-%m-%d)"

cp -R "$TEMPLATE_DIR" "$TARGET_DIR"

for file in "$TARGET_DIR"/*.md; do
    # macOS/BSD sed requires an argument after -i; use '' for in-place without backup.
    sed -i '' \
        -e "s|<Name>|$TITLE|g" \
        -e "s|<Feature>|$TITLE|g" \
        -e "s|<name>|$OWNER|g" \
        -e "s|YYYY-MM-DD|$TODAY|g" \
        "$file"
done

echo "Created spec skeleton: specs/features/$SLUG/"
echo ""
echo "Files:"
for file in "$TARGET_DIR"/*.md; do
    echo "  - specs/features/$SLUG/$(basename "$file")"
done
echo ""
echo "Next steps:"
echo "  1. Fill in spec.md, contracts.md, parity.md"
echo "  2. Add an entry to specs/README.md's parity matrix:"
echo "     | $TITLE | ⏳ | ⏳ | [$SLUG/](./features/$SLUG/spec.md) |"
