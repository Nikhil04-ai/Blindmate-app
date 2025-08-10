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
2. **Live GPS Tracking**: Uses `navigator.geolocation.watchPosition` for continuous updates
3. **Step Progression**: Automatic step advancement when within 15m of step endpoint
4. **Automatic Rerouting**: Triggers when user deviates >20m from planned route
5. **Object Detection Integration**: Obstacle alerts during navigation
6. **Permission Management**: Requests camera, microphone, and location access on load

## Recent Changes
- **2025-08-10**: Complete Google-only navigation system
  - **REMOVED all OpenRouteService (ORS) code** from backend and frontend
  - **REPLACED with Google Directions API and Google Geocoding API only**
  - Updated `/api/directions` endpoint to handle both text addresses and coordinates
  - Implemented Google Geocoding API for address-to-coordinates conversion
  - Added comprehensive error handling with "Location not found" responses
  - Enhanced voice command processing for any worldwide location
  - Integrated Google Maps JavaScript API for real-time route visualization
  - Added live GPS tracking with `navigator.geolocation.watchPosition`
  - Implemented turn-by-turn voice navigation with step progression
  - Added obstacle detection during navigation using COCO-SSD
  - Voice confirmation workflow: "Should I start navigation to [destination]?"
  - Automatic rerouting when user deviates from planned route
  - Mobile and desktop browser compatibility with permissions handling
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
- **Universal Navigation**: Works with any Google Maps location worldwide
- **Voice Confirmation**: "Should I start navigation to [destination]?" workflow
- **Live GPS Tracking**: Uses `navigator.geolocation.watchPosition` for continuous updates
- **Automatic Step Progression**: Advances when within 25 meters of step endpoint
- **Smart Rerouting**: Triggers when user deviates >50 meters from planned route
- **Obstacle Detection**: Real-time alerts during navigation using camera and AI
- **Error Handling**: Comprehensive fallbacks for API failures and location not found