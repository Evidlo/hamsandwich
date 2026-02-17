#!/usr/bin/env bash
set -euo pipefail

BUILD_DIR="dist"
DEPLOY_BRANCH="deploy"

if [ ! -d "$BUILD_DIR" ]; then
  echo "Error: $BUILD_DIR directory not found. Run 'npm run build' first."
  exit 1
fi

# Use a temporary work tree and index to avoid touching the working directory
TMPDIR=$(mktemp -d)
export GIT_INDEX_FILE="$TMPDIR/.git-index"
trap 'rm -rf "$TMPDIR"' EXIT

cp -a "$BUILD_DIR"/. "$TMPDIR"/

# Add all build files to the temporary index (index is created fresh by git)
git --work-tree="$TMPDIR" add -A

# Write the tree
TREE=$(git write-tree)

# Get parent commit of deploy branch if it exists
PARENT_ARG=""
if git rev-parse --verify "$DEPLOY_BRANCH" >/dev/null 2>&1; then
  PARENT_ARG="-p $(git rev-parse "$DEPLOY_BRANCH")"
fi

# Create commit
COMMIT=$(echo "Deploy $(date -u '+%Y-%m-%d %H:%M:%S UTC')" | git commit-tree "$TREE" $PARENT_ARG)

# Update the deploy branch
git update-ref "refs/heads/$DEPLOY_BRANCH" "$COMMIT"

git push --force origin "$DEPLOY_BRANCH"

echo "Deployed to branch '$DEPLOY_BRANCH' ($(git rev-parse --short "$COMMIT"))"
