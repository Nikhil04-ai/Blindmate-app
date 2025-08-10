# BlindMate - AI Assistant for Visually Impaired Users

## Overview

BlindMate is a comprehensive web-based assistive technology application designed to empower visually impaired users with intelligent navigation and real-time environmental awareness. The system combines computer vision for object detection, voice-activated AI assistance, and GPS-based navigation to provide a complete accessibility solution. Users can interact entirely through voice commands, receive audio feedback about their surroundings, and navigate to any location worldwide using walking directions with obstacle detection.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The application uses a vanilla JavaScript approach with modular class-based components. The main application (`BlindMate` class) handles camera access, object detection, and voice synthesis. A separate `UniversalNavigation` class manages GPS tracking and turn-by-turn navigation. The UI is built with Bootstrap 5 for responsive design and accessibility, featuring high contrast themes, large buttons, and keyboard navigation support. TensorFlow.js runs the COCO-SSD model client-side for real-time object detection without server dependencies.

### Voice Recognition System
Implements Web Speech API for continuous voice command recognition with wake word detection ("Hey BlindMate"). The system maintains separate recognition instances for commands and navigation confirmations, with built-in error handling and automatic restart capabilities. Speech synthesis includes intelligent queueing to prevent overlapping audio, priority-based announcements, and multilingual support for 7 Indian languages plus English.

### Real-time Object Detection & Obstacle Alert System
Uses TensorFlow.js with COCO-SSD model to detect objects in webcam feed. Features a comprehensive Real-time Obstacle Alert System that automatically warns users about obstacles during navigation. Critical obstacles (people, vehicles, bicycles) and warning obstacles (furniture, barriers) are detected with confidence thresholds and distance estimation. The system provides intelligent audio alerts with position information (left, center, right) and distance levels (very close, close, medium, far). Alerts are throttled with a 3-second cooldown and persistence tracking to prevent spam while ensuring safety.

### Navigation System
GPS-based navigation uses `navigator.geolocation.watchPosition()` for continuous location tracking with adaptive frequency based on user movement speed. The system integrates with Google Directions API for route calculation and provides step-by-step voice guidance. Features automatic rerouting when users deviate from the planned path, destination proximity detection, and battery optimization through dynamic tracking intervals. Enhanced with four navigation control features: Show Navigation Map (visual route display), Emergency Stop Navigation (immediate cancellation), Test Voice Recognition (microphone testing), and Toggle Obstacle Alerts (safety system control).

### Backend Architecture
Flask-based REST API handles AI command processing and external API integration. The `GeminiService` class manages Google Gemini AI interactions for natural language command interpretation, returning structured JSON responses. The backend serves static files, processes voice commands, and provides secure API key management for Google services. Session management maintains user language and tone preferences across interactions.

### Progressive Web App Features
Includes service worker for offline caching of core resources, app manifest for PWA installation, and background sync capabilities. The application can function partially offline with cached TensorFlow models and stored user preferences.

## External Dependencies

### AI and Machine Learning Services
- **Google Gemini AI**: Natural language processing for voice command interpretation with multilingual support
- **TensorFlow.js**: Client-side machine learning framework for object detection
- **COCO-SSD Model**: Pre-trained object detection model for 80+ object classes

### Google Cloud Services
- **Google Directions API**: Walking route calculation and turn-by-turn navigation
- **Google Geocoding API**: Address to coordinates conversion for universal destination support
- **Google Maps JavaScript API**: Interactive maps and location visualization

### Web APIs and Browser Features
- **Web Speech API**: Browser-native speech recognition and synthesis
- **MediaDevices API**: Webcam access for object detection
- **Geolocation API**: GPS tracking for navigation and location services
- **Service Worker API**: PWA capabilities and offline functionality

### Frontend Libraries
- **Bootstrap 5**: Responsive UI framework with accessibility features
- **Font Awesome**: Icon library for visual indicators
- **HTML5 Canvas API**: Real-time rendering of object detection overlays

### Python Backend Dependencies
- **Flask**: Web application framework with CORS support
- **Google Generative AI**: Python SDK for Gemini API integration
- **Requests**: HTTP client for external API calls
- **Gunicorn**: WSGI server for production deployment