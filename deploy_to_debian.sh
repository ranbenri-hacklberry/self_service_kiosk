#!/bin/bash
# 🚀 POS Deployment Script for Debian Linux
# This script automates the setup of the Pos App and environment.

set -e # Exit on error

echo "--- 🛠️  Starting Deployment for 'Coffee Cart' Station ---"

# 1. System Prep
echo "📦 Updating system packages..."
sudo apt-get update && sudo apt-get install -y curl git ufw

# 2. Docker & Docker Compose
if ! [ -x "$(command -v docker)" ]; then
    echo "🐳 Installing Docker Engine..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
fi

# 3. Environment Config
echo "⚙️ Configuring Environment..."
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
    echo "✅ Loaded credentials from .env"
else
    echo "⚠️ Warning: .env file not found. Please provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
fi

# 4. Build Application Image
echo "🏗️  Building Kiosk Frontend Image..."
docker build \
  --build-arg VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
  --build-arg VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
  -t kiosk-app .

# 5. Network Firewall
echo "🛡️  Configuring Firewall (allowing 80, 54321 for Supabase)..."
sudo ufw allow 80/tcp
sudo ufw allow 54321/tcp
sudo ufw --force enable

# 6. Auto-Start Config
echo "📟 Creating autostart script for Chromium Kiosk Mode..."
cat <<EOF > start-station.sh
#!/bin/bash
# Wait for Docker containers to be ready
echo "Waiting for services..."
sleep 10
# Launch Chromium in Kiosk mode
chromium --kiosk --incognito --disable-infobars --window-position=0,0 --window-size=1920,1080 http://localhost:80
EOF
chmod +x start-station.sh

echo "--- ✅ Deployment Base Ready ---"
echo "Instructions for tomorrow:"
echo "1. Run 'docker run -d --name kiosk -p 80:80 kiosk-app'"
echo "2. For Supabase data migration, we will use the 'Cloud-to-Local' dump command."
echo "3. Restart the machine to verify auto-launch (if configured)."
