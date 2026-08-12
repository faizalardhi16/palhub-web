#!/bin/bash
BASE="http://localhost:8787/mcp"
SID=$(curl -s --max-time 5 -D /tmp/h.txt -o /dev/null -X POST $BASE \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"t","version":"1.0"}}}')
SID=$(grep -i mcp-session-id /tmp/h.txt | tr -d '\r' | awk '{print $2}')
echo "SID=$SID"
echo "--- CALL TOOL (streaming, max 20s) ---"
curl -s -N --max-time 20 -X POST $BASE \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SID" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"finance_web_search","arguments":{"prompt":"batas waktu SPT tahunan"}}}'
echo ""
echo "--- done ---"
