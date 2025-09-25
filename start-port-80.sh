#!/bin/bash

echo "🚀 Starting Daily Helper on port 80..."
echo "⚠️  This requires administrator privileges"
echo ""

# Change to the project directory
cd "/Users/corneliusgeorge/Rally/Daily Helper"

# Set the port to 80
export PORT=80

# Check if port 80 is already in use
if lsof -Pi :80 -sTCP:LISTEN -t >/dev/null ; then
    echo "❌ Port 80 is already in use. Checking what's using it..."
    sudo lsof -i :80
    echo ""
    echo "Do you want to kill the process using port 80? (y/n)"
    read -r response
    if [[ "$response" == "y" ]]; then
        sudo lsof -ti:80 | xargs sudo kill -9
        echo "✅ Killed process on port 80"
    else
        echo "❌ Cannot start on port 80 while another process is using it"
        exit 1
    fi
fi

echo "📦 Starting Next.js on port 80..."
echo "🔗 The application will be available at: http://localhost/"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start Next.js with sudo on port 80
sudo PORT=80 npm run dev