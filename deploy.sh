#!/usr/bin/env bash
set -euo pipefail

BUILD_DIR="dist"
DEPLOY_BRANCH="deploy"

if [ ! -d "$BUILD_DIR" ]; then
  echo "Error: $BUILD_DIR directory not found. Run 'npm run build' first."
  exit 1
fi

# Save current branch to return to it later
CURRENT_BRANCH=$(git symbolic-ref --short HEAD)

# Create a new tree object from the build directory
TREE=$(git -c core.autocrlf=false add --dry-run "$BUILD_DIR" 2>/dev/null || true)

# Use a temporary work tree to avoid touching the working directory
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

cp -a "$BUILD_DIR"/. "$TMPDIR"/

# Set up a temporary index
export GIT_INDEX_FILE=$(mktemp)
trap 'rm -f "$GIT_INDEX_FILE"; rm -rf "$TMPDIR"' EXIT

# Add all build files to the temporary index
git --work-tree="$TMPDIR" add -A

# Write the tree
TREE=$(git write-tree)

# Get parent commit of deploy branch if it exists
if git rev-parse --verify "$DEPLOY_BRANCH" >/dev/null 2>&1; then
  PARENT="-p $(git rev-parse "$DEPLOY_BRANCH")"
else
  PARENT=""
fi

# Create commit
COMMIT=$(echo "Deploy $(date -u '+%Y-%m-%d %H:%M:%S UTC')" | git commit-tree $TREE $PARENT)

# Update the deploy branch
git update-ref "refs/heads/$DEPLOY_BRANCH" "$COMMIT"

echo "Deployed to branch '$DEPLOY_BRANCH' ($(git rev-parse --short "$COMMIT"))"
