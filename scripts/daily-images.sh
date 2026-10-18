#!/bin/bash
# 매일 아침 자동 실행: AI 아이템 사진을 무료 사용량만큼 만들고 → 새로 생겼으면 Vercel에 배포
# 등록: ~/Library/LaunchAgents/com.fortunecloset.images.plist (매일 09:10)
# 다 만들면 스스로 자동 실행을 꺼요.
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.bun/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1
echo "===== $(date '+%Y-%m-%d %H:%M') 시작 ====="
before=$(ls assets/items/*.jpg 2>/dev/null | wc -l)
out=$(node --env-file=.env.local scripts/generate-items.mjs 2>&1)
echo "$out" | tail -4
after=$(ls assets/items/*.jpg 2>/dev/null | wc -l)
if [ "$after" -gt "$before" ]; then
  echo "새 사진 $((after - before))장 → 배포"
  vercel deploy --prod --yes 2>&1 | grep -E "Aliased|Error"
fi
if echo "$out" | grep -q "ALL_DONE"; then
  echo "모든 사진 완료 → 자동 실행 끔"
  launchctl unload "$HOME/Library/LaunchAgents/com.fortunecloset.images.plist" 2>/dev/null
fi
