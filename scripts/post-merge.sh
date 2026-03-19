#!/bin/bash
set -e

echo "=== Post-merge setup ==="

echo "Installing dependencies..."
npm install --legacy-peer-deps < /dev/null

echo "Pushing database schema..."
npm run db:push --force < /dev/null || true

echo "=== Post-merge setup complete ==="
