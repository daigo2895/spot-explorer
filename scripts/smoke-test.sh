#!/usr/bin/env bash
# docker compose で起動したアプリが正しく動いているかを確認する（CI とローカルの両方で使う）
# 使い方: docker compose up --build -d && ./scripts/smoke-test.sh
# 外部の逆ジオコーディングAPIは呼ばない（外部サービスの状態で結果が変わらないようにするため）
set -euo pipefail

API_URL="${API_URL:-http://localhost:3001}"
WEB_URL="${WEB_URL:-http://localhost:3000}"
TIMEOUT_SEC="${TIMEOUT_SEC:-180}"

fail() {
  echo "NG: $*" >&2
  exit 1
}

# URL が応答するまで待つ（初回起動では API はマイグレーションとシードの後に起動する）
wait_for() {
  local url="$1"
  local deadline=$((SECONDS + TIMEOUT_SEC))
  until curl -fsS -o /dev/null "$url" 2>/dev/null; do
    ((SECONDS < deadline)) || fail "${url} が ${TIMEOUT_SEC} 秒以内に応答しませんでした"
    sleep 2
  done
}

echo "API の起動を待っています（最大 ${TIMEOUT_SEC} 秒）"
wait_for "$API_URL/api/health"
echo "OK: API が応答した"

# 東京駅から半径5km：シードデータでは7件あり、近い順に並ぶ
body="$(curl -fsS "$API_URL/api/spots?lat=35.681236&lng=139.767125&radiusKm=5")"
BODY="$body" python3 - <<'PY' || fail "半径検索の結果が想定と違います: $body"
import json, os

d = json.loads(os.environ["BODY"])
dist = [s["distanceM"] for s in d["items"]]
assert d["total"] == 7, f"件数: {d['total']}"
assert len(dist) == 7, f"items の件数: {len(dist)}"
assert dist == sorted(dist), f"近い順になっていない: {dist}"
assert all(m <= 5000 for m in dist), f"半径外が含まれる: {dist}"
PY
echo "OK: 半径検索（7件・近い順・半径内のみ）"

status="$(curl -s -o /dev/null -w '%{http_code}' "$API_URL/api/spots?lat=999&lng=139.767125&radiusKm=5")"
[[ "$status" == "400" ]] || fail "不正な緯度で 400 が返りません（${status}）"
echo "OK: 不正な入力に 400 を返す"

wait_for "$WEB_URL"
echo "OK: 画面が応答した"

echo "すべての確認に合格しました"
