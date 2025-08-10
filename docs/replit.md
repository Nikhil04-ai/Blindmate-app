# BlindMate - AI Assistant for Visually Impaired Users

## Project Overview
BlindMate is an advanced web-based assistive technology application designed to empower visually impaired users with intelligent navigation and interaction tools. The system combines real-time object detection, voice commands, GPS navigation, and accessibility features.

## Key Features
- **Real-time Object Detection**: Using TensorFlow.js and COCO-SSD model
- **Voice-Controlled Navigation**: Google Maps-like walking navigation with voice confirmation
- **Obstacle Detection During Navigation**: Camera-based obstacle alerts while navigating
- **Multi-language Support**: Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati, and English
- **Accessibility-First Design**: High contrast, large fonts, keyboard navigation
- **Mobile-Friendly**: Responsive design for smartphones and tablets

## Technology Stack
- **Backend**: Flask (Python) with SQLAlchemy
- **Frontend**: Vanilla JavaScript, Bootstrap 5, TensorFlow.js
- **APIs**: Google Directions API and Google Geocoding API, Google Generative AI (Gemini)
- **AI Models**: COCO-SSD for object detection, Gemini for voice command processing
- **Database**: PostgreSQL

## Architecture

### Backend Components
- `app.py`: Main Flask application with API endpoints
- `gemini_service.py`: AI service for voice command processing
- `models.py`: Database models (User management)
- `main.py`: Application entry point

### Frontend Components
- `index.html`: Main application interface
- `app.js`: Core BlindMate functionality (camera, detection, voice)
- `navigation.js`: Advanced navigation system with GPS tracking
- `styles.css`: Accessibility-focused styling

### API Endpoints
- `/api/directions`: Google Directions API and Geocoding API integration for voice navigation
- `/api/google-maps-key`: Secure API key delivery for frontend
- `/api/process-command`: Voice command processing via Gemini AI
- Static file serving for HTML, CSS, JS

## Navigation System Features
1. **Voice Confirmation**: "Should I start navigation to [destination]?" with Yes/No detection
2. **Continuous GPS Tracking**: Uses `navigator.geolocation.watchPosition` for real-time updates
3. **Automatic Step Progression**: Advances when within 25 meters of step endpoint
4. **Smart Rerouting**: Triggers when user deviates >50 meters from planned route
5. **Enhanced Error Handling**: Clear voice messages for location/route failures
6. **Optimized Voice Instructions**: Short, clear commands designed for blind users
7. **Emergency Stop Feature**: Safety button to immediately stop navigation
8. **Obstacle Detection Integration**: Real-time alerts during navigation
9. **Universal Destination Support**: Works with any Google Maps location worldwide
10. **Permission Management**: Requests camera, microphone, and location access on load

## Local Development Setup
- **Requirements File**: `requirements-local.txt` created with all necessary dependencies
- **Setup Script**: `setup-local.py` provides automated local environment setup
- **Dependencies**:
  - `flask>=3.1.1` - Web framework
  - `flask-cors>=6.0.1` - Cross-origin resource sharing
  - `flask-sqlalchemy>=3.1.1` - Database ORM
  - `gunicorn>=23.0.0` - Production web server
  - `psycopg2-binary>=2.9.10` - PostgreSQL adapter
  - `requests>=2.31.0` - HTTP library for API calls
  - `email-validator>=2.2.0` - Email validation
  - `google-genai>=1.27.0` - Google Gemini AI integration
  - `sift-stack-py>=0.7.0` - Enhanced functionality
  - `typing-extensions>=4.8.0` - Type hints support

## Recent Changes
- **2025-08-10**: Updated Tutorial System to Match Current App Capabilities
  - **UPDATED TUTORIAL FEATURES**: Tutorial now accurately reflects the current BlindMate app features
  - **15 LANGUAGE SUPPORT**: Tutorial showcases global language support (not just 7 Indian languages)
  - **5 VOICE TONE OPTIONS**: Updated tutorial to highlight friendly, formal, energetic, calm, and robotic tones
  - **WAKE WORD INTEGRATION**: Tutorial now teaches "Hey BlindMate" voice activation
  - **UNIVERSAL NAVIGATION**: Removed outdated location restrictions, now showcases worldwide navigation
  - **ENHANCED OBJECT DETECTION**: Tutorial explains 1.5-second speech delays and anti-overlap technology
  - **MOBILE GESTURE SUPPORT**: Added double-tap gesture information for mobile devices
  - **BATTERY OPTIMIZATION**: Tutorial covers smart GPS frequency adjustment for battery saving
  - **PRACTICE EXERCISES UPDATED**: 4 new exercises covering wake word, global navigation, voice customization, and language switching
  - **DEMO CONTENT REFRESHED**: Updated audio demos to reflect current app capabilities
  - **ACCURATE FEATURE LIST**: Tutorial introduction now lists actual implemented features instead of outdated ones

- **2025-08-10**: Enhanced Speech System for Object Detection with Anti-Overlap & Delay Controls
  - **SMOOTH SPEECH ANNOUNCEMENTS**: Added 1.5-second minimum delay between consecutive object announcements to prevent overlapping voices
  - **IMPROVED SPEECH CANCELLATION**: Enhanced `synth.cancel()` with small timeout delays to ensure proper cancellation before new speech
  - **INTELLIGENT DELAY MANAGEMENT**: Object announcements queue automatically when speech is active, with smart delay calculation
  - **NON-OVERLAPPING VOICE OUTPUT**: All speech synthesis now cancels ongoing utterances before starting new ones for crystal-clear audio
  - **ENHANCED SPEECH EVENT HANDLING**: Added proper `onstart`, `onend`, and `onerror` event handlers with detailed logging for better debugging
  - **PRIORITY-BASED SPEECH QUEUE**: Object announcements use special delay logic while navigation commands remain high-priority
  - **AUTOMATIC CLEANUP**: Speech delay timers are properly cleaned up when detection stops to prevent memory leaks
  - **IMPROVED USER EXPERIENCE**: Users can now understand each announcement clearly without voice overlap confusion
  - **DEBUG LOGGING**: Added console logs to track speech delay behavior and timing for better monitoring
  - **FALLBACK HANDLING**: Enhanced error recovery with longer delays between retries for smoother operation

- **2025-08-10**: Enhanced GPS Navigation System with Battery Optimization & Human-Friendly Voice Instructions
  - **IMPROVED GPS ACCURACY**: Updated `navigator.geolocation.watchPosition` with `enableHighAccuracy: true`, `maximumAge: 0`, `timeout: 10000`
  - **ADDED ROBUST ERROR HANDLING**: Clear voice + UI error messages for GPS failures with specific error codes (permission denied, signal unavailable, timeout)
  - **CONVERTED RAW DATA TO HUMAN-FRIENDLY SPEECH**: Navigation instructions like "Turn left in 20 meters" instead of raw coordinates
  - **OPTIMIZED BATTERY USAGE**: Smart tracking frequency - high frequency (2s) when moving, low frequency (8s) when stationary
  - **AUTOMATIC DESTINATION DETECTION**: Stops tracking when within 10 meters of destination
  - **SMOOTH SPEECH SYNTHESIS**: Always cancels old utterances before new ones to prevent overlapping voices
  - **ENHANCED VOICE INSTRUCTIONS**: Conversational navigation like "bear left", "keep going straight", "make a sharp right turn"
  - **COMPREHENSIVE ERROR FALLBACKS**: Shows text in UI when speech synthesis fails, includes retry mechanisms
  - **MOBILE DEVICE OPTIMIZATION**: Detects mobile devices and applies battery-saving settings automatically
  - **IMPROVED USER INTERFACE**: Error display overlays, speech fallback text, enhanced navigation status with distance info
  - **PROXIMITY-BASED ANNOUNCEMENTS**: Urgent warnings at 10m, advance warnings at 50m, with smart warning flag management
  - **SPEED CALCULATION**: Tracks user movement speed to optimize GPS polling frequency and battery life

- **2025-08-10**: Complete Universal Navigation Implementation
  - **REMOVED all OpenRouteService (ORS) code** from backend and frontend
  - **REPLACED with Google Directions API and Google Geocoding API only**
  - **COMPLETELY ELIMINATED ALL HARDCODED LOCATION RESTRICTIONS** from frontend and backend
  - **REMOVED predefined locations object** and all location validation code from app.js
  - **ENHANCED Google Geocoding API** for any destination names (including short names like "hospital")
  - **UNIVERSAL DESTINATION SUPPORT**: Users can navigate to ANY place worldwide by name
    - Examples: "Take me to Eiffel Tower", "Navigate to Central Park", "Go to Starbucks nearby"
    - No more hardcoded location lists - any global destination works
    - Voice commands work with landmarks, addresses, business names, and geographic locations
  - **IMPLEMENTED continuous GPS tracking** with `navigator.geolocation.watchPosition`
  - **ADDED automatic step progression** when within 25 meters of step endpoint
  - **CREATED smart rerouting** when user deviates >50 meters from planned route
  - **ENHANCED error handling** with specific voice messages:
    - "Location not found, please try again" for ZERO_RESULTS geocoding
    - "Route not available" for failed directions requests
    - Clear voice feedback for all navigation errors
  - **OPTIMIZED voice instructions** for visually impaired users:
    - Short, clear commands like "Turn left in 20 meters"
    - Simplified distance announcements (20m, 100m, 1.5km)
    - Removed verbose phrases for better accessibility
  - **ADDED emergency stop button** for safety during navigation
  - **IMPLEMENTED obstacle detection** during navigation using COCO-SSD
  - Voice confirmation workflow: "Should I start navigation to [destination]?"
  - Works worldwide with any Google Maps location via voice commands
  - Single API key configuration: `GOOGLE_MAPS_API_KEY` environment variable

## User Preferences
- **Communication Style**: Simple, everyday language (non-technical)
- **Accessibility Priority**: High contrast, large text, voice feedback
- **Navigation Style**: Google Maps-like walking mode with obstacle alerts
- **Code Style**: Well-commented for easy modification

## Development Notes
- Google Maps API key configured as `GOOGLE_MAPS_API_KEY` environment variable (used for Directions, Geocoding, and Maps JavaScript APIs)
- Google Gemini API key configured as `GOOGLE_API_KEY` environment variable
- All permissions (camera, microphone, location) requested on page load
- Navigation UI shows current step, total steps, and progress
- Object detection continues during navigation for obstacle alerts
- Automatic navigation end detection when destination is reached
- 30-second timeout for all Google API requests to prevent hanging
- Supports both exact addresses and general place names worldwide

## Architecture Features
- **Universal Navigation**: Works with ANY Google Maps location worldwide without restrictions
- **No Hardcoded Locations**: Complete elimination of predefined location lists and validation
- **Dynamic Geocoding**: All destinations resolved through Google Geocoding API in real-time
- **Voice Confirmation**: "Should I start navigation to [destination]?" workflow
- **Live GPS Tracking**: Uses `navigator.geolocation.watchPosition` for continuous updates
- **Automatic Step Progression**: Advances when within 25 meters of step endpoint
- **Smart Rerouting**: Triggers when user deviates >50 meters from planned route
- **Obstacle Detection**: Real-time alerts during navigation using camera and AI
- **Error Handling**: Comprehensive fallbacks for API failures and location not found
- **Global Destination Support**: Users can name any place, landmark, address, or business name