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

## Recent Changes
- **2025-08-10**: Smart Object Detection Announcement System & Mobile Double-Tap Feature
  - **IMPLEMENTED Smart Object Detection** with 3-announcement limit per object type
  - **ADDED 7-second cooldown** for object re-announcement after disappearance
  - **ENHANCED object tracking** with Maps for announcement count, last seen time, and disappearance tracking
  - **CREATED multi-object support** where each object type is tracked independently (person, chair, car can each be announced 3 times)
  - **ADDED debug logging** for monitoring smart announcement system behavior
  - **IMPLEMENTED mobile double-tap gesture** for voice command activation on touch devices
  - **ADDED mobile device detection** and full-screen double-tap listening mode
  - **ENHANCED mobile accessibility** with "Listening started" voice feedback
  - **PREVENTED UI interference** by excluding buttons/selects from double-tap detection
  - **MAINTAINED all existing features** including language/tone customization, navigation, and object detection
  - Mobile users can now double-tap anywhere on screen to activate voice commands
  - Desktop users continue using volume keys and voice command button as before
  - Object announcements are now intelligently limited to prevent repetitive notifications

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