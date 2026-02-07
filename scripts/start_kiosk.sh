#!/bin/bash

# Export display to ensure Chromium knows where to render
export DISPLAY=:0

# Kill any existing Chromium instances to start fresh
killall chromium 2>/dev/null
killall -9 chromium 2>/dev/null

# Clean up lock files (just in case of crash)
rm -rf ~/.config/chromium/Singleton*

# Start Chromium in Kiosk mode
# - No first run checks
# - Kiosk mode (fullscreen, no bars)
# - No Incognito (so it saves login session)
# - Force scaling to 0.6 for better fit on 24" screens
chromium \
  --no-first-run \
  --no-default-browser-check \
  --kiosk \
  --force-device-scale-factor=0.6 \
  http://127.0.0.1:4028 &
