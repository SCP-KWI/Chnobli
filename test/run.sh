#!/usr/bin/env bash
# Starts the server on a throwaway port, runs the socket.io integration test
# against it, then cleans up. The test always answers every question so it
# never actually waits out a question's timer — it relies on auto-reveal
# instead, so the (student-chosen, 10-40s) question duration doesn't affect
# how long the suite takes to run.
set -uo pipefail
cd "$(dirname "$0")/.."

PORT="${TEST_PORT:-3987}"
export TEST_PORT="$PORT"

(PORT="$PORT" timeout 30 node server/index.js > /tmp/chnobli-test-server.log 2>&1 &)
sleep 1.5

timeout 25 node test/integration.js
CODE=$?

pkill -f "timeout 30 node server/index.js" >/dev/null 2>&1 || true
exit $CODE
