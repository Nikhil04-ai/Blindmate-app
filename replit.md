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
- **APIs**: Google Directions API, Google Generative AI (Gemini)
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
- `/api/directions`: Google Directions API integration
- `/api/command`: Voice command processing via Gemini AI
- Static file serving for HTML, CSS, JS

## Navigation System Features
1. **Voice Confirmation**: "Should I start navigation to [destination]?" with Yes/No detection
2. **Live GPS Tracking**: Uses `navigator.geolocation.watchPosition` for continuous updates
3. **Step Progression**: Automatic step advancement when within 15m of step endpoint
4. **Automatic Rerouting**: Triggers when user deviates >20m from planned route
5. **Object Detection Integration**: Obstacle alerts during navigation
6. **Permission Management**: Requests camera, microphone, and location access on load

## Recent Changes
- **2025-08-08**: Implementing comprehensive navigation system with Google Maps-like features
  - Voice confirmation before navigation starts
  - Live GPS tracking with step progression
  - Automatic rerouting when user deviates from path
  - Integrated obstacle detection during navigation
  - Enhanced permissions handling on page load
  - Mobile-optimized UI with accessibility features

## User Preferences
- **Communication Style**: Simple, everyday language (non-technical)
- **Accessibility Priority**: High contrast, large text, voice feedback
- **Navigation Style**: Google Maps-like walking mode with obstacle alerts
- **Code Style**: Well-commented for easy modification

## Development Notes
- Google API key configured as `GOOGLE_API_KEY` environment variable
- All permissions (camera, microphone, location) requested on page load
- Navigation UI shows current step, total steps, and progress
- Object detection continues during navigation for obstacle alerts
- Automatic navigation end detection when destination is reached

## Known Issues to Address
- JavaScript syntax errors in navigation.js causing console errors
- Need to implement proper voice confirmation workflow
- GPS tracking needs watchPosition implementation
- Rerouting logic requires testing with real navigation scenarios