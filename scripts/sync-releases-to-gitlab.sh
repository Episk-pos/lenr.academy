#!/usr/bin/env bash
# Sync GitHub Releases to the GitLab mirror (episkopos/lenr.academy).
#
# The git mirror (.github/workflows/mirror-to-gitlab.yml) only carries refs, so
# releases are recreated on GitLab through its API: same name and notes, with
# each GitHub asset added as a link back to its GitHub download URL.
# Idempotent: existing GitLab releases are updated and missing links added.
#
# Usage:
#   scripts/sync-releases-to-gitlab.sh <tag>...       sync these releases
#   scripts/sync-releases-to-gitlab.sh --all          sync every published release
#   scripts/sync-releases-to-gitlab.sh --delete <tag> delete a GitLab release
#
# Env: GITLAB_RELEASE_TOKEN (GitLab token, api scope), GH_TOKEN or gh login.
# Optional: GITHUB_REPO, GITLAB_API, GITLAB_PROJECT (URL-encoded path).
#
# Note: release events run the workflow and this script from the tagged commit,
# so only releases tagged after this script landed get event-driven syncs;
# older ones are covered by the daily full sync (except deletions).

set -euo pipefail

GITHUB_REPO="${GITHUB_REPO:-Episk-pos/lenr.academy}"
GITLAB_API="${GITLAB_API:-https://work.episkopos.community/api/v4}"
GITLAB_PROJECT="${GITLAB_PROJECT:-episkopos%2Flenr.academy}"
: "${GITLAB_RELEASE_TOKEN:?GITLAB_RELEASE_TOKEN is not set}"

GL_OUT=$(mktemp)
GH_ERR=$(mktemp)
trap 'rm -f "$GL_OUT" "$GH_ERR"' EXIT

# gl METHOD PATH [JSON] -> prints the HTTP status; response body in $GL_OUT
gl() {
  local args=(-sS -o "$GL_OUT" -w '%{http_code}' -X "$1"
    -H "PRIVATE-TOKEN: $GITLAB_RELEASE_TOKEN" -H 'Content-Type: application/json')
  if [ -n "${3:-}" ]; then args+=(--data "$3"); fi
  curl "${args[@]}" "$GITLAB_API/projects/$GITLAB_PROJECT$2"
}

expect() { # expect STATUS ALLOWED... (fails loudly on anything else)
  local status=$1; shift
  for ok in "$@"; do [ "$status" = "$ok" ] && return 0; done
  echo "GitLab API returned HTTP $status: $(head -c 500 "$GL_OUT")" >&2
  exit 1
}

uri() { jq -rn --arg v "$1" '$v|@uri'; }

sync_release() {
  local tag=$1 enc rel status
  enc=$(uri "$tag")

  if ! rel=$(gh api "repos/$GITHUB_REPO/releases/tags/$enc" 2>"$GH_ERR"); then
    if grep -q 'HTTP 404' "$GH_ERR"; then
      echo "skip $tag: no published GitHub release (draft or missing)"
      return 0
    fi
    cat "$GH_ERR" >&2
    return 1
  fi

  # The tag arrives via the mirror workflow; give it a moment on fresh releases.
  for _ in $(seq 1 18); do
    status=$(gl GET "/repository/tags/$enc")
    [ "$status" = 200 ] && break
    sleep 10
  done
  expect "$status" 200

  local payload
  payload=$(jq -c '{
      tag_name,
      name: (.name // .tag_name),
      description: ((.body // "") + "\n\n---\nMirrored from GitHub: " + .html_url),
      released_at: .published_at
    }' <<<"$rel")

  status=$(gl GET "/releases/$enc")
  if [ "$status" = 200 ]; then
    expect "$(gl PUT "/releases/$enc" "$payload")" 200
    echo "updated $tag"
  else
    expect "$status" 404
    expect "$(gl POST /releases "$payload")" 201
    echo "created $tag"
  fi

  expect "$(gl GET "/releases/$enc/assets/links?per_page=100")" 200
  local existing
  existing=$(jq -r '.[].name' "$GL_OUT")

  while read -r link; do
    local name
    name=$(jq -r .name <<<"$link")
    if grep -qxF "$name" <<<"$existing"; then continue; fi
    expect "$(gl POST "/releases/$enc/assets/links" "$link")" 201
    echo "  linked $name"
  done < <(jq -c '.assets[] | {name, url: .browser_download_url, link_type: "package"}' <<<"$rel")
}

delete_release() {
  local status
  status=$(gl DELETE "/releases/$(uri "$1")")
  expect "$status" 200 404
  echo "deleted $1 (HTTP $status)"
}

case "${1:-}" in
  --all)
    tags=$(gh api --paginate "repos/$GITHUB_REPO/releases" --jq '.[] | select(.draft | not) | .tag_name')
    for tag in $tags; do sync_release "$tag"; done
    ;;
  --delete)
    delete_release "${2:?--delete needs a tag}"
    ;;
  "" | -h | --help)
    sed -n '2,19p' "$0"
    exit 1
    ;;
  *)
    for tag in "$@"; do sync_release "$tag"; done
    ;;
esac
