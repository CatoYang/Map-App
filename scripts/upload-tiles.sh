#!/usr/bin/env bash
# Upload a folder of map tiles to Cloudflare R2.
#
#   1. Put R2 credentials in .env.r2.local (gitignored — never commit it):
#        R2_ACCOUNT_ID=...
#        R2_ACCESS_KEY_ID=...
#        R2_SECRET_ACCESS_KEY=...
#        R2_BUCKET=map-tiles
#   2. bash scripts/upload-tiles.sh <local folder> <name in bucket>
#        e.g. bash scripts/upload-tiles.sh public/tiles/shanghai-1932 shanghai-1932
#
# Safe to re-run: files already uploaded and unchanged are skipped.
set -euo pipefail
cd "$(dirname "$0")/.."

src=${1:?usage: upload-tiles.sh <local folder> <name in bucket>}
dest=${2:?usage: upload-tiles.sh <local folder> <name in bucket>}

command -v rclone >/dev/null || { echo "rclone is not installed: sudo apt install rclone"; exit 1; }
[ -f .env.r2.local ] || { echo "Missing .env.r2.local (see the top of this script)"; exit 1; }
set -a; source .env.r2.local; set +a

# rclone reads its remote settings from these variables, so nothing is written to disk
export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_R2_ENDPOINT="https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com"

rclone copy "$src" "r2:$R2_BUCKET/$dest" \
  --transfers 32 --checkers 32 \
  --s3-no-check-bucket \
  --header-upload "Cache-Control: public, max-age=2592000" \
  --progress

echo "Done. Files are under $dest/ in bucket $R2_BUCKET."
