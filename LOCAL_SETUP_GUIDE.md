# BlindMate - Local Development Setup Guide

## 📁 Project Structure

```
blindmate/
├── app.py                          # Main Flask application
├── main.py                         # Application entry point
├── gemini_service.py              # Google Gemini AI service
├── requirements-local.txt         # Python dependencies
├── setup-local.py                 # Automated setup script
├── LOCAL_SETUP_GUIDE.md          # This guide
├── pyproject.toml                 # Project configuration
├── .env.template                  # Environment variables template
├── templates/                     # HTML templates
│   ├── index.html                # Main application page
│   ├── navigation.html           # Navigation page
│   ├── onboarding.html          # Tutorial/onboarding page
│   └── simple_navigation.html   # Simple navigation interface
├── static/                       # Static files (CSS, JS, assets)
│   ├── css/
│   │   └── styles.css           # Main stylesheet
│   ├── js/
│   │   ├── app.js               # Main application JavaScript
│   │   ├── navigation.js        # Navigation system
│   │   ├── onboarding.js        # Tutorial JavaScript
│   │   └── sw.js                # Service worker for PWA
│   └── assets/                  # Images, icons, etc.
└── docs/                        # Documentation
    ├── README.md                # Project documentation
    └── replit.md               # Development notes
```

## 🚀 Quick Start (Automated Setup)

### Step 1: Prerequisites
- Python 3.11 or higher installed
- Git (optional, for cloning)
- Modern web browser (Chrome, Firefox, Edge)

### Step 2: Download the Project
```bash
# If using Git
git clone <repository-url>
cd blindmate

# OR manually download and extract the project files
```

### Step 3: Run Automated Setup
```bash
python setup-local.py
```

This script will:
- ✅ Check Python version compatibility
- ✅ Create virtual environment (`venv/`)
- ✅ Install all dependencies
- ✅ Create environment template file

### Step 4: Configure Environment
```bash
# Copy the template
cp .env.template .env

# Edit .env with your API keys
nano .env  # or use any text editor
```

Add your API keys to `.env`:
```bash
# Database (SQLite for local development)
DATABASE_URL=sqlite:///blindmate.db

# Google Gemini AI (required)
GEMINI_API_KEY=your_gemini_api_key_here

# Session security
SESSION_SECRET=your_random_secret_key_here

# Google Maps (optional but recommended)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

### Step 5: Activate Environment and Run
```bash
# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

# Run the application
python main.py
```

### Step 6: Access the Application
Open your browser and go to: `http://localhost:5000`

---

## 🛠️ Manual Setup (Alternative)

### Step 1: Create Virtual Environment
```bash
python -m venv venv
```

### Step 2: Activate Virtual Environment
```bash
# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

### Step 3: Install Dependencies
```bash
pip install -r requirements-local.txt
```

### Step 4: Set Environment Variables
Create a `.env` file:
```bash
DATABASE_URL=sqlite:///blindmate.db
GEMINI_API_KEY=your_actual_api_key
SESSION_SECRET=your_secret_key
GOOGLE_MAPS_API_KEY=your_maps_key
```

### Step 5: Run the Application
```bash
python main.py
```

---

## 🔑 Getting API Keys

### Google Gemini API Key (Required)
1. Visit [Google AI Studio](https://aistudio.google.com)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and add it to your `.env` file

### Google Maps API Key (Optional)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable "Maps JavaScript API" and "Directions API"
4. Create credentials (API Key)
5. Restrict the key to your domain for security
6. Add it to your `.env` file

---

## 📋 System Requirements

### Minimum Requirements
- **Python**: 3.11 or higher
- **RAM**: 4GB minimum, 8GB recommended
- **Disk Space**: 500MB for dependencies
- **Browser**: Chrome 80+, Firefox 75+, Edge 80+, Safari 13+
- **Internet**: Required for AI services and maps

### Browser Permissions Required
- 📷 **Camera Access**: For object detection
- 🎤 **Microphone Access**: For voice commands
- 📍 **Location Access**: For navigation features

---

## 🧪 Testing the Installation

### 1. Basic Functionality Test
```bash
# Check if the server starts
python main.py

# Should see output like:
# * Running on http://127.0.0.1:5000
```

### 2. Web Interface Test
1. Open `http://localhost:5000`
2. Allow camera and microphone permissions
3. You should see the BlindMate interface

### 3. Voice Command Test
1. Click "Start Detection" or say "Hey BlindMate"
2. Try saying: "Start detection"
3. Camera should activate and detect objects

### 4. Navigation Test
1. Say: "Take me to Central Park"
2. Should ask for confirmation and start navigation

---

## 🚨 Troubleshooting

### Common Issues

**❌ "Python not found"**
```bash
# Solution: Install Python 3.11+ from python.org
# Verify with: python --version
```

**❌ "Permission denied" errors**
```bash
# Windows: Run as administrator
# macOS/Linux: Use sudo for system packages
```

**❌ "Module not found" errors**
```bash
# Make sure virtual environment is activated
source venv/bin/activate  # macOS/Linux
venv\Scripts\activate     # Windows

# Reinstall dependencies
pip install -r requirements-local.txt
```

**❌ "Camera not working"**
- Check browser permissions (chrome://settings/content/camera)
- Close other applications using the camera
- Try a different browser

**❌ "Voice commands not responding"**
- Check microphone permissions
- Ensure you're speaking clearly
- Verify GEMINI_API_KEY is set correctly

**❌ "Navigation not working"**
- Add GOOGLE_MAPS_API_KEY to .env
- Enable location permissions in browser
- Check internet connection

### Log Debugging
```bash
# Check application logs
tail -f app.log

# Check browser console (F12 -> Console tab)
# Look for error messages in red
```

---

## 🌐 Production Deployment

### Option 1: Replit (Recommended)
1. Import project to Replit
2. Add secrets in Replit Secrets tab
3. Run with the existing workflow

### Option 2: Local Server
```bash
# Install production server
pip install gunicorn

# Run with gunicorn
gunicorn --bind 0.0.0.0:5000 --workers 4 main:app
```

### Option 3: Docker (Advanced)
```bash
# Create Dockerfile if needed
docker build -t blindmate .
docker run -p 5000:5000 blindmate
```

---

## 📞 Support

### Getting Help
1. **Check this guide first** - most issues are covered here
2. **Browser Console** - Press F12 and check for error messages
3. **Test with different browsers** - Chrome works best
4. **Verify API keys** - Make sure they're valid and not expired

### Performance Tips
- **Use Chrome** for best performance
- **Good lighting** improves object detection
- **Stable internet** required for AI features
- **Close other camera apps** to avoid conflicts

---

## ✅ Success Checklist

After setup, you should be able to:
- [ ] Access http://localhost:5000 without errors
- [ ] See camera feed in the main interface
- [ ] Grant camera and microphone permissions
- [ ] Hear "Navigation system ready" voice message
- [ ] Say "Start detection" and see object detection
- [ ] Say "Take me to [location]" and get navigation
- [ ] Switch between different pages (tutorial, navigation)

---

**🎉 Congratulations! BlindMate is now running locally on your machine.**

For more information, check the documentation in the `docs/` folder.