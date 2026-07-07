#!/usr/bin/env bash
# Starts the server on a throwaway port with a short question duration (so
# the test doesn't have to wait out the real 20s timer), runs the socket.io
# integration test against it, then cleans up.
set -uo pipefail
cd "$(dirname "$0")/.."

PORT="${TEST_PORT:-3987}"
export TEST_PORT="$PORT"

(PORT="$PORT" QUESTION_DURATION_MS=4000 timeout 30 node server/index.js > /tmp/chnobli-test-server.log 2>&1 &)
sleep 1.5

timeout 25 node test/integration.js
CODE=$?

pkill -f "timeout 30 node server/index.js" >/dev/null 2>&1 || true
exit $CODE
