#!/bin/bash
set -e

echo "==> Building @jellyos/agent..."
npm run build

echo ""
echo "Current version: $(node -p "require('./package.json').version")"
echo "Bump type? (patch / minor / major)"
read -r BUMP

npm version "$BUMP" --no-git-tag-version

NEW_VERSION=$(node -p "require('./package.json').version")
echo ""
echo "==> Publishing v$NEW_VERSION to npm..."
npm publish --access public

echo ""
echo "✓ Published @jellyos/agent@$NEW_VERSION"
echo "  https://www.npmjs.com/package/@jellyos/agent"
