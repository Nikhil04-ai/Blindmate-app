# BlindMate - AI Assistant for Visually Impaired Users

## Overview

BlindMate is a comprehensive web application designed specifically for visually impaired users, providing real-time object detection, voice-activated navigation, and multilingual AI assistance. The application combines computer vision, natural language processing, and accessibility-first design to create an intuitive, voice-controlled navigation assistant.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**Advanced Navigation System Implementation (August 8, 2025)**
- Completely rebuilt navigation system with voice confirmation, live GPS tracking, and automatic rerouting
- Added comprehensive permission management for camera, microphone, and location access on startup
- Implemented voice confirmation system: "Should I start navigation to [destination]? Say yes or no."
- Added real-time GPS tracking with navigator.geolocation.watchPosition for continuous position updates
- Implemented step-by-step voice guidance with distance-based announcements (within 15m of next step)
- Added voice preview feature: "Next step: Turn left in 200 meters" when within 200m of upcoming instruction
- Implemented automatic rerouting when user deviates more than 20m from planned route
- Added intelligent object detection during navigation with obstacle announcements ("Obstacle ahead: person")
- Enhanced UI with mobile-responsive navigation display showing current step, progress, and distance
- Implemented priority-based speech queue management (emergency > high > normal > low priority)
- Added emergency stop functionality with immediate cancellation of all navigation processes
- Enhanced error handling with comprehensive fallback mechanisms for permissions and API failures
- Updated backend /api/directions endpoint to work with both predefined locations and Google Maps queries
- Added mobile-friendly responsive design with fixed navigation panel on mobile devices

**Previous Tutorial System Implementation (August 8, 2025)**
- Created comprehensive onboarding tutorial system for first-time users
- Added `onboarding.html` with 8-step interactive tutorial covering all BlindMate features
- Implemented `onboarding.js` with voice-guided tutorial navigation, practice exercises, and accessibility features
- Integrated tutorial access into main interface with prominent tutorial button
- Added first-time user detection to automatically suggest tutorial for new users
- Voice commands now include "tutorial", "help", "guide", "learn" to launch tutorial
- Tutorial covers: welcome, voice commands, object detection, navigation, emergency features, customization, practice session, and completion

## System Architecture

BlindMate follows a client-server architecture with a Python Flask backend and a vanilla JavaScript frontend, optimized for accessibility and real-time performance.

### Frontend Architecture
- **Vanilla JavaScript (ES6+)**: Main application logic with modern web APIs
- **HTML5 Semantic Structure**: Accessibility-first markup with ARIA labels
- **CSS3 with Bootstrap**: Responsive design with high contrast and large fonts
- **TensorFlow.js**: Client-side machine learning for real-time object detection
- **Web Speech API**: Voice recognition and text-to-speech synthesis

### Backend Architecture
- **Flask**: Lightweight Python web framework
- **RESTful API**: Simple API endpoints for AI command processing
- **Static File Serving**: Direct file serving for frontend assets

## Key Components

### 1. Object Detection System
- **COCO-SSD Model**: TensorFlow.js implementation for real-time object detection
- **Canvas Overlay**: Visual feedback with bounding boxes and labels
- **Audio Alerts**: Text-to-speech announcements with distance estimation
- **Smart Throttling**: Prevents audio overload with intelligent timing

### 2. Voice Assistant Integration
- **Gemini Pro API**: Advanced natural language processing via Google Generative AI
- **Continuous Listening**: Web Speech API for hands-free operation
- **Structured Command Processing**: JSON-based responses for reliable action execution
- **Multilingual Support**: 7 Indian languages with localized responses

### 3. Navigation System
- **Google Maps Integration**: Turn-by-turn directions using Google Maps API
- **Voice-Guided Directions**: Spoken navigation instructions
- **Location Services**: Automatic current location detection

### 4. Accessibility Features
- **Keyboard Navigation**: Full keyboard accessibility with enhanced focus indicators
- **Screen Reader Compatibility**: Semantic HTML and ARIA labels
- **High Contrast Design**: Large fonts and strong visual contrast
- **Voice-First Interface**: Minimal visual interaction required

## Data Flow

1. **Voice Input**: User speaks commands → Web Speech API → Text transcription
2. **Command Processing**: Text → Flask API → Gemini Service → JSON response
3. **Action Execution**: JSON commands trigger frontend actions (detection, navigation, etc.)
4. **Object Detection**: Webcam feed → TensorFlow.js → Canvas overlay + Audio alerts
5. **Voice Output**: System responses → Text-to-Speech → Audio feedback

## External Dependencies

### APIs and Services
- **Google Generative AI (Gemini Pro)**: Natural language processing and command interpretation
- **Google Maps API**: Navigation and location services
- **TensorFlow.js/COCO-SSD**: Pre-trained object detection model

### Browser APIs
- **Web Speech API**: Voice recognition and synthesis
- **MediaDevices API**: Webcam access
- **Geolocation API**: Location services

### Frontend Libraries
- **Bootstrap**: UI framework for responsive design
- **Font Awesome**: Icon library
- **TensorFlow.js**: Machine learning framework

### Backend Libraries
- **Flask**: Web framework
- **Flask-CORS**: Cross-origin resource sharing
- **Google GenerativeAI**: Gemini API client

## Deployment Strategy

### Production Considerations
- **Environment Variables**: API keys stored securely (GEMINI_API_KEY, SESSION_SECRET)
- **HTTPS Required**: Essential for Web Speech API and MediaDevices API
- **Static Asset Optimization**: CSS/JS minification for production
- **Error Handling**: Comprehensive logging and fallback mechanisms
- **Browser Compatibility**: Modern browser support with feature detection

### Infrastructure Requirements
- **Python 3.7+**: Backend runtime
- **HTTPS Certificate**: Required for camera and microphone access
- **CDN Support**: For TensorFlow.js and Bootstrap assets
- **Environment Configuration**: Secure API key management

### Scalability Notes
- **Client-Side Processing**: Object detection runs locally to reduce server load
- **Stateless Backend**: Simple API design for horizontal scaling
- **Progressive Enhancement**: Core functionality works with basic browser support