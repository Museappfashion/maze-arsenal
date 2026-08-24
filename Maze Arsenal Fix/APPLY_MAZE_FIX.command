#!/bin/zsh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ -f "$SCRIPT_DIR/package.json" && -f "$SCRIPT_DIR/src/App.jsx" ]]; then
  REPO_DIR="$SCRIPT_DIR"
elif [[ -f "$SCRIPT_DIR/../package.json" && -f "$SCRIPT_DIR/../src/App.jsx" ]]; then
  REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
else
  echo ""
  echo "Maze Arsenal repo not found."
  echo ""
  echo "Put the entire 'Maze Arsenal Fix' folder inside the root of your"
  echo "maze-arsenal repo, next to package.json and the src folder."
  echo ""
  read -k 1 "?Press any key to close..."
  exit 1
fi

echo ""
echo "Maze Arsenal repo:"
echo "$REPO_DIR"
echo ""
echo "Applying leaderboard, personal-best, mode-switch warning,"
echo "end-screen, analytics, runtime, and tooling fixes..."
echo ""

cd "$REPO_DIR"
node "$SCRIPT_DIR/maze-arsenal-fix.mjs"

echo ""
echo "Patch applied."
echo ""
echo "NEXT:"
echo "1. In Supabase, enable Authentication > Anonymous Sign-Ins."
echo "2. Run the UPDATED supabase/setup.sql in Supabase SQL Editor."
echo "3. Run npm install / npm run check before deploying."
echo "4. Delete the 'Maze Arsenal Fix' folder before committing."
echo ""
read -k 1 "?Press any key to close..."
