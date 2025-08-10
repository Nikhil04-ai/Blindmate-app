# BlindMate - AI Assistant for Visually Impaired Users

BlindMate is a comprehensive web application designed specifically for visually impaired users. It provides real-time object detection, voice-activated navigation, and multilingual AI assistance to help users navigate their environment safely and independently.

## 🌟 Features

### 🔍 Real-time Object Detection
- **TensorFlow.js COCO-SSD Model**: Detects objects like people, chairs, vehicles, stairs, and more
- **Live Webcam Feed**: Continuous monitoring of the user's environment
- **Visual Feedback**: Bounding boxes and labels overlaid on detected objects
- **Audio Alerts**: Text-to-speech announcements with distance estimation
- **Smart Throttling**: Prevents audio overload with intelligent announcement timing

### 🗣️ Voice-Activated AI Assistant
- **Gemini Pro Integration**: Advanced natural language processing for command interpretation
- **Continuous Listening**: Web Speech API for hands-free operation
- **Smart Commands**: 
  - "Start detection" / "Stop detection"
  - "Take me to [location]"
  - "Enable location"
  - "Change language to [language]"
- **Structured Responses**: JSON-based command processing for reliable action execution

### 🌍 Multilingual Support
- **7 Indian Languages**: English, Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati
- **Voice Recognition**: Speech-to-text in user's preferred language
- **Localized Responses**: AI responses and system messages in selected language
- **Easy Language Switching**: Voice commands or manual selection

### 🧭 Smart Navigation
- **Google Maps Integration**: Turn-by-turn directions using Google Maps API
- **Voice-Guided Directions**: Spoken navigation instructions
- **Walking-Optimized Routes**: Pedestrian-friendly path calculation
- **Location-Based Services**: Automatic current location detection

### ♿ Accessibility-First Design
- **Large Fonts & High Contrast**: Optimized for users with partial vision
- **Keyboard Navigation**: Full keyboard accessibility with focus indicators
- **Screen Reader Compatible**: Semantic HTML and ARIA labels
- **Mobile-First Responsive**: Works seamlessly on smartphones and tablets
- **Voice-First Interface**: Minimal visual interaction required

## 🛠️ Technology Stack

### Frontend
- **HTML5**: Semantic markup for accessibility
- **CSS3**: Responsive design with Bootstrap framework
- **Vanilla JavaScript**: ES6+ with modern web APIs
- **TensorFlow.js**: Machine learning in the browser
- **Web Speech API**: Voice recognition and synthesis
- **Google Maps API**: Navigation and directions

### Backend
- **Flask**: Lightweight Python web framework
- **Google Generative AI**: Gemini Pro for command processing
- **Flask-CORS**: Cross-origin resource sharing
- **Python 3.8+**: Modern Python features

## 🚀 Quick Start

### Prerequisites
- Python 3.11 or higher
- Modern web browser with camera and microphone access
- Internet connection for AI services

### Option 1: Replit Deployment (Recommended)

1. **Get the required API key**:
   - Visit [Google AI Studio](https://aistudio.google.com)
   - Sign in with your Google account
   - Create a new API key (free)
   - Keep this key safe - you'll need it in step 3

2. **Set up the project in Replit**:
   - The project is already configured and ready to run
   - All dependencies are pre-installed

3. **Add your API key**:
   - Go to the Secrets tab in your Replit project
   - Add a new secret with key: `GEMINI_API_KEY`
   - Paste your API key as the value

4. **Run the application**:
   ```bash
   python main.py
   ```

### Option 2: Local Development

1. **Quick Setup (Automated)**:
   ```bash
   python setup-local.py
   ```
   This script will:
   - Check Python version compatibility
   - Create a virtual environment
   - Install all dependencies from `requirements-local.txt`
   - Create environment template file

2. **Manual Setup**:
   ```bash
   # Clone or download the project
   git clone <repository-url>
   cd blindmate

   # Create virtual environment
   python -m venv venv

   # Activate virtual environment
   # Windows:
   venv\Scripts\activate
   # macOS/Linux:
   source venv/bin/activate

   # Install dependencies
   pip install -r requirements-local.txt
   ```

3. **Environment Configuration**:
   - Copy `.env.template` to `.env`
   - Add your API keys:
     ```
     DATABASE_URL=sqlite:///blindmate.db
     GEMINI_API_KEY=your_gemini_api_key_here
     SESSION_SECRET=your_secret_session_key_here
     GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
     ```

4. **Run the application**:
   ```bash
   python main.py
   ```
   
5. **Access the application**:
   - Open your browser and go to `http://localhost:5000`
   - Allow camera and microphone permissions when prompted
   - The app will automatically initialize and start the voice interaction

## 🎯 Usage Guide

### First Time Setup
1. When you first open BlindMate, it will ask: "Should I start detection, Sir?"
2. Say "Yes" to enable object detection
3. Grant camera permission when prompted
4. The app will then ask: "Would you like to enable location?"
5. Say "Yes" to enable navigation features
6. Grant location permission when prompted

### Voice Commands
BlindMate understands natural language commands in multiple languages:

**Object Detection:**
- "Start detection" / "Begin scanning"
- "Stop detection" / "Pause scanning"

**Navigation:**
- "Take me to the library"
- "Navigate to Central Park"
- "Go to the nearest coffee shop"

**Language Control:**
- "Change language to Hindi"
- "Switch to Tamil"

**System Control:**
- "Enable location"
- "Stop" (stops current activity)

### Keyboard Shortcuts
For accessibility, these keyboard shortcuts are available:
- `Ctrl + S`: Start/Stop object detection
- `Ctrl + V`: Activate voice command
- `Ctrl + L`: Enable location services

### Supported Languages
- **English (India)**: en-IN
- **Hindi**: hi-IN (हिंदी)
- **Tamil**: ta-IN (தமிழ்)
- **Telugu**: te-IN (తెలుగు)
- **Bengali**: bn-IN (বাংলা)
- **Marathi**: mr-IN (मराठी)
- **Gujarati**: gu-IN (ગુજરાતી)

## 🔧 Features in Detail

### Object Detection
- Uses COCO-SSD model to detect 80+ object classes
- Real-time processing at 30 FPS
- Distance estimation based on object size
- Audio announcements every 3 seconds to prevent spam
- Visual overlay with bounding boxes and confidence scores

### AI Voice Assistant
- Powered by Google's Gemini Pro model
- Processes natural language in 7 Indian languages
- Fallback logic when AI service is unavailable
- Structured JSON responses for reliable action execution

### Navigation System
- Opens directions in user's default maps application
- Supports Google Maps, Apple Maps, and generic map services
- Provides walking directions optimized for pedestrians
- Voice guidance integration with object detection

### Accessibility Features
- WCAG 2.1 AA compliant design
- Screen reader compatible with ARIA labels
- High contrast colors and large fonts
- Keyboard navigation support
- Voice-first interaction model

## 🚨 Browser Compatibility

**Fully Supported:**
- Chrome 80+ (recommended)
- Edge 80+
- Firefox 75+
- Safari 13+

**Required Permissions:**
- Camera access for object detection
- Microphone access for voice commands
- Location access for navigation (optional)

## 🛟 Troubleshooting

### Common Issues

**"Camera not working":**
- Ensure camera permissions are granted
- Check if another application is using the camera
- Try refreshing the page

**"Voice commands not responding":**
- Check microphone permissions
- Ensure you're speaking clearly
- Try switching to English if using another language

**"AI responses seem incorrect":**
- Verify GEMINI_API_KEY is set correctly
- Check internet connection
- The app has fallback logic for basic commands

**"Navigation not working":**
- Enable location permissions
- Check if popup blocker is preventing navigation window
- Try manually opening Google Maps with the destination

### Performance Tips
- Use Chrome for best performance
- Ensure good lighting for object detection
- Speak clearly and at normal pace for voice commands
- Close other camera-using applications

## 🤝 Contributing

BlindMate is designed to be accessible and helpful. If you have suggestions for improvements:

1. Focus on accessibility enhancements
2. Consider multilingual user needs
3. Test with actual assistive technology users
4. Ensure changes don't break voice-first interaction

## 📄 License

This project is designed for educational and assistive technology purposes. Please use responsibly and consider the privacy and safety of visually impaired users.

## 🆘 Support

For technical support or feature requests, please consider:
- Testing in different browsers
- Checking browser console for error messages
- Verifying all permissions are granted
- Ensuring stable internet connection for AI features
