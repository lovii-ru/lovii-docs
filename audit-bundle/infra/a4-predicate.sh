#!/usr/bin/env bash
# Единый источник A4-логики allowlist (используется lovii-deploy и тестом).
# Использование: source a4-predicate.sh; a4_target_allowed TYPE stack svc img pkg_name tag IMAGE_PREFIX
a4_target_allowed() {
  local TYPE="$1" stack="$2" svc="$3" img="$4" pkg_name="$5" tag="$6" IMAGE_PREFIX="${7:-lovii-frontend}"
  local sfx
  if [[ "$pkg_name" == "lovii-app" ]]; then sfx="$svc"; else sfx="${pkg_name#lovii-*-}"; fi
  local sp
  if [[ "$stack" == *-staging ]]; then sp="${stack/-staging/}-staging/"; else sp="$stack/"; fi
  local ok=0
  # Разделители обязательны (ревью арены: boundary bypass):
  #  path-форма   <sp>…/<sfx>[:…]
  #  short-форма  <sp><sfx>[:…]
  #  app-стек     IMAGE_PREFIX:<tag> или точный IMAGE_PREFIX
  [[ "$img" == "${sp}"*"/$sfx" || "$img" == "${sp}"*"/$sfx:"* || "$img" == "${sp}${sfx}:"* || "$img" == "${sp}${sfx}" ]] && ok=1
  if [[ "$TYPE" == "app" ]]; then
    local prefix_env="$IMAGE_PREFIX"
    [[ "$stack" == *-staging ]] && prefix_env="${prefix_env}-staging"
    [[ "$img" == "${prefix_env}:${tag}" || "$img" == "${prefix_env}:latest" || "$img" == "${prefix_env}" ]] && ok=1
  fi
  [[ "$ok" == 1 ]]
}
