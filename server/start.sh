#!/bin/bash
cd "$(dirname "$0")"
while true; do
  node counsel-api.js >> /tmp/counsel-api.log 2>&1
  echo "Server crashed, restarting in 3s..." >> /tmp/counsel-api.log
  sleep 3
done
