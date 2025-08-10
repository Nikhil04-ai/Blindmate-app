/**
 * BlindMate Navigation System
 * Advanced voice-controlled navigation with real-time GPS tracking, object detection, and automatic rerouting
 * Complete implementation with all requested features
 */
class BlindMateNavigation {
    constructor() {
        // Navigation states
        this.currentState = 'idle'; // idle, listening, confirming, navigating, rerouting
        this.isNavigating = false;
        this.currentRoute = null;
        this.currentStepIndex = 0;
        this.locationWatcher = null;
        this.currentDestination = null;
        this.lastKnownPosition = null;
        this.nextStepAnnounced = false;
        this.awaitingConfirmation = false;
        
        // Navigation configuration - optimized for real use
        this.navigationConfig = {
            stepProximityThreshold: 15, // meters - when to move to next step
            routeDeviationThreshold: 20, // meters - when to trigger rerouting
            speedUpdateInterval: 2000, // ms - how often to check GPS position
            voicePreviewDistance: 50, // meters - when to announce "next step in X meters"
            obstacleDetectionSensitivity: 0.6, // confidence threshold for obstacle detection
            rerouteRetryLimit: 3 // max automatic reroute attempts
        };
        
        // GPS and positioning
        this.watchId = null;
        this.currentPosition = null;
        this.positionAccuracy = null;
        this.isTrackingPosition = false;
        this.rerouteAttempts = 0;
        
        // Object detection during navigation
        this.model = null;
        this.isDetecting = false;
        this.lastDetectionTime = 0;
        this.detectionInterval = 1500; // Faster detection during navigation
        this.detectionCanvas = null;
        this.detectionContext = null;
        this.obstacleDetectionEnabled = false;
        
        // Google Maps integration
        this.map = null;
        this.directionsService = null;
        this.directionsRenderer = null;
        this.userMarker = null;
        this.routePolyline = null;
        
        // Speech recognition and synthesis with queue management
        this.recognition = null;
        this.confirmationRecognition = null;
        this.synthesis = window.speechSynthesis;
        this.isSpeaking = false;
        this.speechQueue = [];
        this.currentSpeechPriority = 'normal'; // 'low', 'normal', 'high', 'emergency'
        
        // Permissions tracking
        this.permissions = {
            camera: false,
            microphone: false,
            location: false
        };
        
        // Initialize immediately
        this.initialize();
    }
    
    /**
     * Initialize the navigation system - requests all permissions on page load
     */
    async initialize() {
        console.log('Initializing BlindMate Navigation System...');
        
        // Setup speech recognition for navigation commands
        this.setupSpeechRecognition();
        
        // Setup UI event listeners
        this.setupUIEventListeners();
        
        // Request all permissions on page load as required
        await this.requestAllPermissions();
        
        // Initialize camera feed for object detection
        await this.initializeCamera();
        
        // Load object detection model
        await this.loadModel();
        
        console.log('BlindMate Navigation System initialized');
    }
    
    /**
     * Initialize Google Maps for navigation display
     */
    initializeMap() {
        if (!window.google || !window.google.maps) {
            console.error('Google Maps API not loaded');
            return;
        }
        
        console.log('Initializing Google Maps...');
        
        // Initialize map centered on user's location or default
        const defaultCenter = this.currentPosition ? 
            { lat: this.currentPosition.latitude, lng: this.currentPosition.longitude } :
            { lat: 28.6139, lng: 77.2090 }; // Default to Delhi
        
        this.map = new google.maps.Map(document.getElementById('map'), {
            zoom: 16,
            center: defaultCenter,
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            streetViewControl: false,
            fullscreenControl: false,
            mapTypeControl: false,
            zoomControl: true,
            styles: [
                {
                    featureType: 'poi',
                    elementType: 'labels',
                    stylers: [{ visibility: 'off' }]
                }
            ]
        });
        
        // Initialize directions service and renderer
        this.directionsService = new google.maps.DirectionsService();
        this.directionsRenderer = new google.maps.DirectionsRenderer({
            map: this.map,
            draggable: false,
            panel: null,
            suppressMarkers: false,
            polylineOptions: {
                strokeColor: '#007bff',
                strokeWeight: 6,
                strokeOpacity: 0.8
            }
        });
        
        // Add user location marker
        if (this.currentPosition) {
            this.userMarker = new google.maps.Marker({
                position: { lat: this.currentPosition.latitude, lng: this.currentPosition.longitude },
                map: this.map,
                title: 'Your Location',
                icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#007bff">
                            <circle cx="12" cy="12" r="8" stroke="white" stroke-width="2"/>
                        </svg>
                    `),
                    scaledSize: new google.maps.Size(24, 24),
                    anchor: new google.maps.Point(12, 12)
                }
            });
        }
        
        // Setup map controls
        this.setupMapControls();
        
        console.log('Google Maps initialized successfully');
    }
    
    /**
     * Setup map control buttons
     */
    setupMapControls() {
        const closeMapBtn = document.getElementById('closeMap');
        const showMapBtn = document.getElementById('showMap');
        const mapContainer = document.getElementById('navigationMapContainer');
        
        if (closeMapBtn) {
            closeMapBtn.addEventListener('click', () => {
                mapContainer.style.display = 'none';
            });
        }
        
        if (showMapBtn) {
            showMapBtn.addEventListener('click', () => {
                if (this.isNavigating) {
                    mapContainer.style.display = 'block';
                    // Resize map after showing
                    setTimeout(() => {
                        if (this.map) {
                            google.maps.event.trigger(this.map, 'resize');
                        }
                    }, 100);
                } else {
                    this.speak('Navigation is not active. Start navigation to view the route.', 'normal');
                }
            });
        }
    }
    
    /**
     * Display route on Google Maps
     */
    displayRouteOnMap(route) {
        if (!this.map || !this.directionsRenderer) {
            console.log('Map not initialized, cannot display route');
            return;
        }
        
        console.log('Displaying route on map');
        
        // Clear existing route
        this.directionsRenderer.setDirections(null);
        
        // Get origin and destination from route steps
        const steps = route.steps;
        if (!steps || steps.length === 0) return;
        
        const origin = new google.maps.LatLng(
            this.currentPosition.latitude,
            this.currentPosition.longitude
        );
        
        const destination = new google.maps.LatLng(
            steps[steps.length - 1].end_location.lat,
            steps[steps.length - 1].end_location.lng
        );
        
        // Create DirectionsRequest
        const request = {
            origin: origin,
            destination: destination,
            travelMode: google.maps.TravelMode.WALKING,
            unitSystem: google.maps.UnitSystem.METRIC,
            avoidHighways: true,
            avoidTolls: true
        };
        
        // Request and display directions
        this.directionsService.route(request, (result, status) => {
            if (status === google.maps.DirectionsStatus.OK) {
                this.directionsRenderer.setDirections(result);
                console.log('Route displayed on map successfully');
                
                // Update map bounds to show entire route
                const bounds = new google.maps.LatLngBounds();
                bounds.extend(origin);
                bounds.extend(destination);
                this.map.fitBounds(bounds);
                
                // Add some padding
                setTimeout(() => {
                    this.map.setZoom(Math.max(this.map.getZoom() - 1, 14));
                }, 500);
            } else {
                console.error('Failed to display route on map:', status);
            }
        });
    }
    
    /**
     * Update user marker position during navigation
     */
    updateUserMarkerPosition(lat, lng) {
        if (!this.map) return;
        
        const newPosition = new google.maps.LatLng(lat, lng);
        
        if (this.userMarker) {
            this.userMarker.setPosition(newPosition);
        } else {
            // Create user marker if it doesn't exist
            this.userMarker = new google.maps.Marker({
                position: newPosition,
                map: this.map,
                title: 'Your Location',
                icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#007bff">
                            <circle cx="12" cy="12" r="8" stroke="white" stroke-width="2"/>
                        </svg>
                    `),
                    scaledSize: new google.maps.Size(24, 24),
                    anchor: new google.maps.Point(12, 12)
                }
            });
        }
        
        // Center map on user location during navigation
        if (this.isNavigating) {
            this.map.panTo(newPosition);
        }
    }
    
    /**
     * Request all permissions (camera, microphone, location) on page load
     */
    async requestAllPermissions() {
        console.log('Requesting all permissions...');
        
        const results = {
            camera: false,
            microphone: false,
            location: false
        };
        
        try {
            // Request microphone permission
            console.log('Requesting microphone permission...');
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            results.microphone = true;
            this.permissions.microphone = true;
            audioStream.getTracks().forEach(track => track.stop());
            console.log('Microphone permission granted');
            
            // Request camera permission
            console.log('Requesting camera permission...');
            const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
            results.camera = true;
            this.permissions.camera = true;
            videoStream.getTracks().forEach(track => track.stop());
            console.log('Camera permission granted');
            
            // Request location permission
            console.log('Requesting location permission...');
            const position = await this.getCurrentPosition();
            results.location = true;
            this.permissions.location = true;
            this.currentPosition = position.coords;
            console.log('Location permission granted');
            
        } catch (error) {
            console.error('Permission request failed:', error);
            this.handlePermissionError(results);
        }
        
        // Update UI based on permissions
        this.updatePermissionStatus(results);
        
        return results;
    }
    
    /**
     * Handle permission errors and show appropriate messages
     */
    handlePermissionError(results) {
        const missing = [];
        if (!results.microphone) missing.push('microphone');
        if (!results.camera) missing.push('camera');
        if (!results.location) missing.push('location');
        
        const message = `Please enable ${missing.join(', ')} permissions in your browser settings for full navigation functionality.`;
        this.speak(message, 'high');
        
        // Show on-screen message
        const systemStatus = document.getElementById('systemStatus');
        if (systemStatus) {
            systemStatus.innerHTML = `
                <div class="alert alert-warning">
                    <h5><i class="fas fa-exclamation-triangle"></i> Permissions Required</h5>
                    <p>For full navigation features, please enable:</p>
                    <ul>
                        ${missing.map(p => `<li>${p.charAt(0).toUpperCase() + p.slice(1)}</li>`).join('')}
                    </ul>
                    <button class="btn btn-primary" onclick="location.reload()">
                        <i class="fas fa-redo"></i> Reload & Retry
                    </button>
                </div>
            `;
        }
    }
    
    /**
     * Update permission status in the UI
     */
    updatePermissionStatus(results) {
        // Update status based on permissions
        if (results.camera && results.microphone && results.location) {
            this.speak('All permissions granted. Navigation system ready.', 'normal');
            this.updateStatusDisplay('Ready to Navigate', 'Press the button or Volume Up key to start');
        }
    }
    
    /**
     * Setup speech recognition for navigation commands and confirmations
     */
    setupSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.error('Speech recognition not supported');
            return;
        }
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        // Main navigation command recognition
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';
        
        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.toLowerCase().trim();
            console.log('Navigation command received:', transcript);
            
            if (this.awaitingConfirmation) {
                this.handleConfirmationResponse(transcript);
            } else {
                this.handleNavigationCommand(transcript);
            }
        };
        
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            
            // Handle different error types appropriately
            let errorMessage = 'Voice command failed. Please try again.';
            
            switch(event.error) {
                case 'no-speech':
                    errorMessage = 'No speech detected. Please try speaking again.';
                    break;
                case 'audio-capture':
                    errorMessage = 'Microphone error. Please check your microphone.';
                    break;
                case 'not-allowed':
                    errorMessage = 'Microphone permission denied. Please enable microphone access.';
                    break;
                case 'network':
                    errorMessage = 'Network error. Please check your internet connection.';
                    break;
                case 'aborted':
                    // Don't show error message for user-initiated cancellations
                    this.currentState = 'idle';
                    this.updateMainButton('idle');
                    return;
            }
            
            this.speak(errorMessage, 'high');
            this.currentState = 'idle';
            this.updateMainButton('idle');
            this.updateStatusDisplay('Ready to Navigate', 'Press the button to start voice command');
        };
        
        this.recognition.onend = () => {
            console.log('Speech recognition ended, current state:', this.currentState);
            
            if (this.currentState === 'listening') {
                this.currentState = 'idle';
                this.updateMainButton('idle');
                this.updateStatusDisplay('Ready to Navigate', 'Press the button to start voice command');
            }
        };
        
        // Separate recognition for confirmations
        this.confirmationRecognition = new SpeechRecognition();
        this.confirmationRecognition.continuous = false;
        this.confirmationRecognition.interimResults = false;
        this.confirmationRecognition.lang = 'en-US';
        
        this.confirmationRecognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.toLowerCase().trim();
            this.handleConfirmationResponse(transcript);
        };
        
        this.confirmationRecognition.onerror = (event) => {
            console.error('Confirmation speech recognition error:', event.error);
            
            if (this.awaitingConfirmation) {
                this.speak('Could not hear your response. Please say yes to start navigation or no to cancel.', 'normal');
                
                // Retry confirmation automatically after error
                setTimeout(() => {
                    if (this.awaitingConfirmation) {
                        try {
                            this.confirmationRecognition.start();
                        } catch (error) {
                            console.error('Failed to restart confirmation recognition:', error);
                        }
                    }
                }, 2000);
            }
        };
    }
    
    /**
     * Setup UI event listeners for buttons and keyboard shortcuts
     */
    setupUIEventListeners() {
        // Main navigation button
        const mainButton = document.getElementById('mainButton');
        if (mainButton) {
            mainButton.addEventListener('click', () => this.handleMainButtonClick());
        }
        
        // Emergency stop button
        const emergencyStop = document.getElementById('emergencyStop');
        if (emergencyStop) {
            emergencyStop.addEventListener('click', () => this.stopNavigation());
        }
        
        // Volume Up key shortcut
        document.addEventListener('keydown', (event) => {
            if (event.key === 'AudioVolumeUp' || (event.ctrlKey && event.key === ' ')) {
                event.preventDefault();
                this.handleMainButtonClick();
            }
        });
        
        console.log('UI event listeners setup complete');
    }
    
    /**
     * Handle main button clicks - starts voice recognition or stops navigation
     */
    handleMainButtonClick() {
        if (this.isNavigating) {
            this.stopNavigation();
        } else if (this.currentState === 'idle') {
            this.startVoiceRecognition();
        }
    }
    
    /**
     * Start voice recognition for navigation commands
     */
    startVoiceRecognition() {
        if (!this.permissions.microphone) {
            this.speak('Microphone permission required. Please enable microphone access.', 'high');
            return;
        }
        
        // Check if recognition is already running
        if (this.currentState === 'listening') {
            console.log('Voice recognition already active');
            return;
        }
        
        this.currentState = 'listening';
        this.updateStatusDisplay('Listening...', 'Say your destination, for example: "Go to Central Park"');
        this.updateMainButton('listening');
        
        try {
            // Ensure previous recognition is stopped
            if (this.recognition) {
                this.recognition.abort();
            }
            
            // Small delay to ensure clean start
            setTimeout(() => {
                try {
                    this.recognition.start();
                    console.log('Voice recognition started successfully');
                } catch (error) {
                    console.error('Speech recognition delayed start error:', error);
                    this.speak('Voice recognition failed to start. Please try again.', 'high');
                    this.currentState = 'idle';
                    this.updateMainButton('idle');
                }
            }, 100);
            
        } catch (error) {
            console.error('Speech recognition start error:', error);
            this.speak('Unable to start voice recognition. Please try again.', 'high');
            this.currentState = 'idle';
            this.updateMainButton('idle');
        }
    }
    
    /**
     * Initialize camera feed for object detection
     */
    async initializeCamera() {
        if (!this.permissions.camera) {
            console.log('Camera permission not available');
            return;
        }
        
        try {
            const video = document.getElementById('webcam');
            const canvas = document.getElementById('canvas');
            
            if (!video || !canvas) {
                console.error('Video or canvas element not found');
                return;
            }
            
            this.detectionCanvas = canvas;
            this.detectionContext = canvas.getContext('2d');
            
            // Get camera stream
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'environment'
                }
            });
            
            video.srcObject = stream;
            
            // Wait for video to load
            await new Promise((resolve) => {
                video.onloadedmetadata = () => {
                    // Set canvas size to match video
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    resolve();
                };
            });
            
            console.log('Camera initialized successfully');
            
        } catch (error) {
            console.error('Camera initialization error:', error);
            this.speak('Unable to access camera. Object detection disabled.', 'normal');
        }
    }
    
    /**
     * Update status display in the UI
     */
    updateStatusDisplay(statusText, instructionText) {
        const statusElement = document.getElementById('statusText');
        const instructionElement = document.getElementById('instructionText');
        
        if (statusElement) {
            statusElement.textContent = statusText;
        }
        
        if (instructionElement) {
            instructionElement.textContent = instructionText;
        }
    }
    
    /**
     * Update main button appearance based on current state
     */
    updateMainButton(state) {
        const button = document.getElementById('mainButton');
        if (!button) return;
        
        // Remove all state classes
        button.classList.remove('listening', 'navigating');
        
        switch (state) {
            case 'listening':
                button.classList.add('listening');
                button.innerHTML = '<i class="fas fa-microphone"></i> Listening...';
                break;
            case 'navigating':
                button.classList.add('navigating');
                button.innerHTML = '<i class="fas fa-stop"></i> Stop Navigation';
                // Show navigation controls
                const navigationControls = document.getElementById('navigationControls');
                if (navigationControls) {
                    navigationControls.style.display = 'block';
                }
                break;
            default: // idle
                button.innerHTML = '<i class="fas fa-microphone"></i> Start Listening';
                // Hide navigation controls
                const navigationControlsIdle = document.getElementById('navigationControls');
                if (navigationControlsIdle) {
                    navigationControlsIdle.style.display = 'none';
                }
                break;
        }
    }
    
    /**
     * Handle navigation voice commands
     */
    async handleNavigationCommand(transcript) {
        console.log('Processing navigation command:', transcript);
        
        // Extract destination from command
        const destination = this.extractDestination(transcript);
        
        if (!destination) {
            this.speak('Please specify a destination. For example, say "Go to Central Park" or "Navigate to the library".', 'normal');
            return;
        }
        
        // Check location permission
        if (!this.permissions.location) {
            this.speak('Location permission is required for navigation. Please enable location access.', 'high');
            return;
        }
        
        // Get current location if not available
        if (!this.currentPosition) {
            try {
                const position = await this.getCurrentPosition();
                this.currentPosition = position.coords;
            } catch (error) {
                this.speak('Unable to get current location. Please check location permissions.', 'high');
                return;
            }
        }
        
        // Voice confirmation before starting navigation - KEY REQUIREMENT
        this.currentDestination = destination;
        this.awaitingConfirmation = true;
        this.currentState = 'confirming';
        
        this.speak(`Should I start navigation to ${destination}? Say yes to start or no to cancel.`, 'high');
        
        // Start listening for confirmation
        setTimeout(() => {
            if (this.awaitingConfirmation) {
                this.confirmationRecognition.start();
            }
        }, 3000);
        
        // Timeout for confirmation
        setTimeout(() => {
            if (this.awaitingConfirmation) {
                this.awaitingConfirmation = false;
                this.currentState = 'idle';
                this.speak('Navigation request timed out. Please try again.', 'normal');
            }
        }, 10000);
    }
    
    /**
     * Handle confirmation responses (Yes/No) - KEY REQUIREMENT
     */
    async handleConfirmationResponse(transcript) {
        if (!this.awaitingConfirmation) return;
        
        console.log('Confirmation response:', transcript);
        
        const isYes = transcript.includes('yes') || transcript.includes('yeah') || transcript.includes('start') || transcript.includes('go');
        const isNo = transcript.includes('no') || transcript.includes('cancel') || transcript.includes('stop');
        
        this.awaitingConfirmation = false;
        
        if (isYes) {
            this.speak('Starting navigation...', 'normal');
            await this.startNavigation(this.currentDestination);
        } else if (isNo) {
            this.speak('Navigation cancelled.', 'normal');
            this.currentState = 'idle';
        } else {
            this.speak('Please say yes to start navigation or no to cancel.', 'normal');
            // Retry confirmation
            this.awaitingConfirmation = true;
            setTimeout(() => {
                if (this.awaitingConfirmation) {
                    this.confirmationRecognition.start();
                }
            }, 1000);
        }
    }
    
    /**
     * Extract destination from voice command
     */
    extractDestination(transcript) {
        const text = transcript.toLowerCase().trim();
        
        // Remove common filler words and clean up
        const cleanText = text
            .replace(/^(hey|hello|hi)\s+/i, '')
            .replace(/blindmate/gi, '')
            .replace(/please/gi, '')
            .trim();
        
        // Enhanced patterns for navigation commands
        const patterns = [
            /(?:go to|navigate to|take me to|directions to|drive to|walk to)\s+(.+)/,
            /(?:where is|find|locate)\s+(.+)/,
            /(?:route to|path to|way to)\s+(.+)/,
            /(?:i want to go to|i need to get to)\s+(.+)/,
            /(?:show me the way to|help me get to)\s+(.+)/,
            // Direct place mentions without command words
            /^(.+)(?:\s+please)?$/
        ];
        
        for (const pattern of patterns) {
            const match = cleanText.match(pattern);
            if (match && match[1]) {
                const destination = match[1].trim();
                // Filter out very short or common non-destinations
                if (destination.length > 2 && !['here', 'there', 'home', 'work'].includes(destination)) {
                    return destination;
                }
            }
        }
        
        // If no pattern matched but there's text, try to use it as destination
        if (cleanText.length > 2 && !cleanText.match(/^(yes|no|start|stop|cancel|help)$/)) {
            return cleanText;
        }
        
        return null;
    }
    
    /**
     * Start navigation to destination - implements all features
     */
    async startNavigation(destination) {
        try {
            this.currentState = 'navigating';
            this.isNavigating = true;
            this.currentStepIndex = 0;
            this.rerouteAttempts = 0;
            this.nextStepAnnounced = false;
            
            // Get route from server using Google Directions API
            const response = await fetch('/api/navigate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    origin: `${this.currentPosition.latitude},${this.currentPosition.longitude}`,
                    destination: destination,
                    mode: 'walking'
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                // Handle specific HTTP error codes with user-friendly messages
                if (response.status === 404) {
                    throw new Error(data.error || 'Location not found');
                } else if (response.status === 504) {
                    throw new Error(data.error || 'Navigation request timed out. Please try again.');
                } else if (response.status === 503) {
                    throw new Error(data.error || 'Unable to connect to navigation service');
                } else {
                    throw new Error(data.error || 'Navigation service error');
                }
            }
            
            if (!data.success || !data.route || !data.route.steps) {
                throw new Error(data.error || 'No route found');
            }
            
            this.currentRoute = data.route;
            
            // Display route on map
            this.displayRouteOnMap(data.route);
            
            // Start GPS tracking with watchPosition - KEY REQUIREMENT
            this.startLocationTracking();
            
            // Start object detection during navigation - KEY REQUIREMENT
            this.startNavigationDetection();
            
            // Initialize navigation UI
            this.initializeNavigationUI();
            
            // Update main button to show navigation state
            this.updateMainButton('navigating');
            
            // Show map automatically when navigation starts
            setTimeout(() => {
                const mapContainer = document.getElementById('navigationMapContainer');
                if (mapContainer && this.map) {
                    mapContainer.style.display = 'block';
                    setTimeout(() => {
                        google.maps.event.trigger(this.map, 'resize');
                    }, 100);
                }
            }, 1000);
            
            // Announce first step
            const firstStep = this.currentRoute.steps[0];
            this.speak(`Navigation started to ${destination}. Total distance: ${this.currentRoute.distance}, estimated time: ${this.currentRoute.duration}. ${firstStep.instruction}`, 'high');
            
            console.log('Navigation started successfully');
            
        } catch (error) {
            console.error('Navigation start error:', error);
            this.speak(`Unable to start navigation to ${destination}. ${error.message}`, 'high');
            this.stopNavigation();
        }
    }
    
    /**
     * Start continuous GPS location tracking using watchPosition - KEY REQUIREMENT
     */
    startLocationTracking() {
        if (!navigator.geolocation) {
            console.error('Geolocation not supported');
            return;
        }
        
        const options = {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 5000
        };
        
        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.handleLocationUpdate(position),
            (error) => this.handleLocationError(error),
            options
        );
        
        this.isTrackingPosition = true;
        console.log('GPS tracking started with watchPosition');
    }
    
    /**
     * Handle GPS location updates during navigation - implements step progression
     */
    handleLocationUpdate(position) {
        this.currentPosition = position.coords;
        this.positionAccuracy = position.coords.accuracy;
        
        // Update user marker on map with new position
        this.updateUserMarkerPosition(position.coords.latitude, position.coords.longitude);
        
        if (!this.isNavigating || !this.currentRoute) {
            return;
        }
        
        // Check if we're close to the current step's end location (15m threshold)
        this.checkStepProgress(position);
        
        // Check if we've deviated from the route (20m threshold for rerouting)
        this.checkRouteAdherence(position);
    }
    
    /**
     * Check progress towards current step - implements auto step progression
     */
    checkStepProgress(position) {
        if (this.currentStepIndex >= this.currentRoute.steps.length) {
            // We've reached the destination
            this.handleDestinationReached();
            return;
        }
        
        const currentStep = this.currentRoute.steps[this.currentStepIndex];
        const distanceToStepEnd = this.calculateDistance(
            position.coords.latitude,
            position.coords.longitude,
            currentStep.end_location.lat,
            currentStep.end_location.lng
        );
        
        // Check if we should announce the next step preview (50m threshold)
        if (!this.nextStepAnnounced && distanceToStepEnd <= this.navigationConfig.voicePreviewDistance) {
            this.announceNextStepPreview();
        }
        
        // Check if we've reached the current step's end (15m threshold)
        if (distanceToStepEnd <= this.navigationConfig.stepProximityThreshold) {
            this.moveToNextStep();
        }
    }
    
    /**
     * Move to the next navigation step - implements step queue management
     */
    moveToNextStep() {
        this.currentStepIndex++;
        this.nextStepAnnounced = false;
        
        if (this.currentStepIndex >= this.currentRoute.steps.length) {
            this.handleDestinationReached();
            return;
        }
        
        const nextStep = this.currentRoute.steps[this.currentStepIndex];
        this.speak(nextStep.instruction, 'high');
        
        // Update navigation UI
        this.updateNavigationUI();
        
        console.log(`Moved to step ${this.currentStepIndex + 1}: ${nextStep.instruction}`);
    }
    
    /**
     * Announce next step preview - implements voice previews
     */
    announceNextStepPreview() {
        if (this.currentStepIndex + 1 >= this.currentRoute.steps.length) {
            this.speak('You are approaching your destination.', 'normal');
        } else {
            const nextStep = this.currentRoute.steps[this.currentStepIndex + 1];
            this.speak(`Next step: ${nextStep.instruction}`, 'normal');
        }
        
        this.nextStepAnnounced = true;
    }
    
    /**
     * Handle destination reached - implements automatic end detection
     */
    handleDestinationReached() {
        this.speak(`You have reached your destination: ${this.currentDestination}`, 'high');
        this.stopNavigation();
    }
    
    /**
     * Check if user has deviated from route - implements automatic rerouting
     */
    checkRouteAdherence(position) {
        if (!this.currentRoute || this.currentStepIndex >= this.currentRoute.steps.length) {
            return;
        }
        
        const currentStep = this.currentRoute.steps[this.currentStepIndex];
        
        // Calculate distance to the route (simplified - using distance to step start)
        const distanceToRoute = this.calculateDistance(
            position.coords.latitude,
            position.coords.longitude,
            currentStep.start_location.lat,
            currentStep.start_location.lng
        );
        
        // Trigger rerouting if more than 20m from planned path
        if (distanceToRoute > this.navigationConfig.routeDeviationThreshold) {
            console.log(`Route deviation detected: ${distanceToRoute.toFixed(1)}m`);
            this.triggerRerouting(position);
        }
    }
    
    /**
     * Trigger automatic rerouting - KEY REQUIREMENT
     */
    async triggerRerouting(position) {
        if (this.rerouteAttempts >= this.navigationConfig.rerouteRetryLimit) {
            this.speak('Unable to find alternate route. Navigation stopped.', 'high');
            this.stopNavigation();
            return;
        }
        
        this.rerouteAttempts++;
        this.currentState = 'rerouting';
        
        this.speak('You seem to be off route. Calculating new directions...', 'high');
        
        try {
            // Get new route from current position
            const response = await fetch('/api/directions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    origin: `${position.coords.latitude},${position.coords.longitude}`,
                    destination: this.currentDestination,
                    mode: 'walking'
                })
            });
            
            const data = await response.json();
            
            if (!data.success || !data.route || !data.route.steps) {
                throw new Error(data.error || 'No route found');
            }
            
            this.currentRoute = data.route;
            this.currentStepIndex = 0;
            this.nextStepAnnounced = false;
            this.currentState = 'navigating';
            
            const firstStep = this.currentRoute.steps[0];
            this.speak(`New route calculated. ${firstStep.instruction}`, 'high');
            
            this.updateNavigationUI();
            
            // Update status display
            this.updateStatusDisplay('Navigation Updated', 'New route calculated, continuing...');
            
            console.log('Rerouting successful');
            
        } catch (error) {
            console.error('Rerouting failed:', error);
            this.speak('Unable to calculate new route. Please provide a new destination.', 'high');
            this.stopNavigation();
        }
    }
    
    /**
     * Handle GPS location errors
     */
    handleLocationError(error) {
        console.error('Location error:', error);
        
        switch (error.code) {
            case error.PERMISSION_DENIED:
                this.speak('Location access denied. Navigation cannot continue.', 'high');
                this.stopNavigation();
                break;
            case error.POSITION_UNAVAILABLE:
                this.speak('Location information unavailable. Trying again...', 'normal');
                break;
            case error.TIMEOUT:
                this.speak('Location request timed out. Trying again...', 'normal');
                break;
            default:
                this.speak('Location error occurred. Navigation may be affected.', 'normal');
                break;
        }
    }
    
    /**
     * Stop location tracking
     */
    stopLocationTracking() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        this.isTrackingPosition = false;
        console.log('GPS tracking stopped');
    }
    
    /**
     * Stop navigation - implements complete cleanup
     */
    stopNavigation() {
        this.isNavigating = false;
        this.currentState = 'idle';
        
        // Stop location tracking
        this.stopLocationTracking();
        
        // Stop object detection
        this.stopNavigationDetection();
        
        // Clear navigation data
        this.currentRoute = null;
        this.currentDestination = null;
        this.currentStepIndex = 0;
        this.rerouteAttempts = 0;
        
        // Update UI
        this.updateNavigationUI();
        
        // Reset main button to idle state
        this.updateMainButton('idle');
        
        console.log('Navigation stopped');
        
        // Update UI to show navigation stopped
        this.updateStatusDisplay('Navigation Stopped', 'Press the button to start new navigation');
    }
    
    /**
     * Initialize navigation UI - shows current step and total steps
     */
    initializeNavigationUI() {
        // Show navigation info overlay
        const navInfo = document.getElementById('navigationInfo');
        if (navInfo) {
            navInfo.style.display = 'block';
        }
        
        // Show detection overlay and enable object detection during navigation
        const detectionOverlay = document.getElementById('detectionOverlay');
        if (detectionOverlay) {
            detectionOverlay.style.display = 'block';
        }
        
        // Enable obstacle detection during navigation
        this.obstacleDetectionEnabled = true;
        let navContainer = document.getElementById('navigationContainer');
        if (!navContainer) {
            navContainer = document.createElement('div');
            navContainer.id = 'navigationContainer';
            navContainer.className = 'navigation-container mt-3';
            
            // Insert into controls section
            const controlsSection = document.querySelector('.col-lg-4');
            if (controlsSection) {
                controlsSection.appendChild(navContainer);
            }
        }
        
        this.updateNavigationUI();
    }
    
    /**
     * Update navigation UI with current step information - HIGH CONTRAST for accessibility
     */
    updateNavigationUI() {
        if (!this.currentRoute || !this.isNavigating) {
            // Hide navigation info when not navigating
            const navInfo = document.getElementById('navigationInfo');
            if (navInfo) {
                navInfo.style.display = 'none';
            }
            
            // Hide detection overlay when not navigating
            const detectionOverlay = document.getElementById('detectionOverlay');
            if (detectionOverlay) {
                detectionOverlay.style.display = 'none';
            }
            
            // Disable obstacle detection
            this.obstacleDetectionEnabled = false;
            return;
        }
        
        const currentStepElement = document.getElementById('currentStep');
        const stepDistanceElement = document.getElementById('stepDistance');
        
        if (this.currentStepIndex < this.currentRoute.steps.length) {
            const currentStep = this.currentRoute.steps[this.currentStepIndex];
            const totalSteps = this.currentRoute.steps.length;
            
            if (currentStepElement) {
                currentStepElement.innerHTML = `
                    <strong>Step ${this.currentStepIndex + 1} of ${totalSteps}</strong><br>
                    ${currentStep.instruction}
                `;
            }
            
            if (stepDistanceElement) {
                stepDistanceElement.innerHTML = `
                    <i class="fas fa-route"></i> ${currentStep.distance} • 
                    <i class="fas fa-clock"></i> ${currentStep.duration}
                `;
            }
        }
        const navContainer = document.getElementById('navigationContainer');
        if (!navContainer) return;
        
        if (!this.isNavigating || !this.currentRoute) {
            navContainer.innerHTML = '';
            return;
        }
        
        const currentStep = this.currentRoute.steps[this.currentStepIndex];
        const totalSteps = this.currentRoute.steps.length;
        const progressPercentage = Math.round(((this.currentStepIndex + 1) / totalSteps) * 100);
        
        navContainer.innerHTML = `
            <div class="card border-primary border-3">
                <div class="card-header bg-primary text-white">
                    <h3 class="mb-0" style="font-size: 1.5rem;">
                        <i class="fas fa-route"></i>
                        Navigation to ${this.currentDestination}
                    </h3>
                </div>
                <div class="card-body">
                    <div class="row mb-3">
                        <div class="col-12">
                            <h4 class="text-primary" style="font-size: 1.3rem;">
                                Step ${this.currentStepIndex + 1} of ${totalSteps}
                            </h4>
                            <p class="lead navigation-instruction" 
                               style="font-size: 1.4rem; font-weight: 700; color: #000; background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
                                ${currentStep ? currentStep.instruction : 'Loading...'}
                            </p>
                        </div>
                    </div>
                    <div class="row mb-3">
                        <div class="col-6">
                            <strong style="font-size: 1.1rem;">Distance:</strong><br>
                            <span class="text-info" style="font-size: 1.2rem; font-weight: 600;">
                                ${currentStep ? currentStep.distance : '---'}
                            </span>
                        </div>
                        <div class="col-6">
                            <strong style="font-size: 1.1rem;">Duration:</strong><br>
                            <span class="text-info" style="font-size: 1.2rem; font-weight: 600;">
                                ${currentStep ? currentStep.duration : '---'}
                            </span>
                        </div>
                    </div>
                    <div class="progress mb-3" style="height: 30px;">
                        <div class="progress-bar bg-success progress-bar-striped progress-bar-animated" 
                             role="progressbar" style="width: ${progressPercentage}%; font-size: 1.2rem; font-weight: 600;">
                            ${progressPercentage}% Complete
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-12">
                            <button class="btn btn-danger btn-lg w-100" style="font-size: 1.3rem; padding: 15px;" 
                                    onclick="navigation.stopNavigation()">
                                <i class="fas fa-stop"></i> Stop Navigation
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Load COCO-SSD model for object detection during navigation
     */
    async loadModel() {
        try {
            if (!this.model && typeof cocoSsd !== 'undefined') {
                console.log('Loading COCO-SSD model for navigation...');
                this.model = await cocoSsd.load();
                console.log('COCO-SSD model loaded for navigation');
            }
            return true;
        } catch (error) {
            console.error('Error loading object detection model:', error);
            return false;
        }
    }
    
    /**
     * Start object detection during navigation - KEY REQUIREMENT
     */
    startNavigationDetection() {
        if (!this.model) {
            console.log('Object detection model not available');
            return;
        }
        
        this.isDetecting = true;
        this.obstacleDetectionEnabled = true;
        this.setupDetectionCanvas();
        this.detectObjects();
        console.log('Object detection started during navigation');
    }
    
    /**
     * Setup canvas for object detection
     */
    setupDetectionCanvas() {
        const video = document.getElementById('webcam');
        if (!video) return false;
        
        // Create or get detection canvas
        this.detectionCanvas = document.getElementById('detectionCanvas');
        if (!this.detectionCanvas) {
            this.detectionCanvas = document.createElement('canvas');
            this.detectionCanvas.id = 'detectionCanvas';
            this.detectionCanvas.style.display = 'none';
            document.body.appendChild(this.detectionCanvas);
        }
        
        this.detectionContext = this.detectionCanvas.getContext('2d');
        return true;
    }
    
    /**
     * Detect objects during navigation - implements obstacle detection
     */
    async detectObjects() {
        if (!this.model || !this.isDetecting || !this.obstacleDetectionEnabled) {
            return;
        }
        
        const video = document.getElementById('webcam');
        if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
            // Retry after delay
            setTimeout(() => this.detectObjects(), this.detectionInterval);
            return;
        }
        
        try {
            // Update canvas size
            this.detectionCanvas.width = video.videoWidth;
            this.detectionCanvas.height = video.videoHeight;
            
            // Draw video frame to hidden canvas
            this.detectionContext.drawImage(video, 0, 0);
            
            // Detect objects
            const predictions = await this.model.detect(this.detectionCanvas);
            
            // Process detections for obstacles
            this.processObstacleDetections(predictions);
            
        } catch (error) {
            console.error('Object detection error during navigation:', error);
        }
        
        // Schedule next detection
        if (this.isDetecting && this.obstacleDetectionEnabled) {
            setTimeout(() => this.detectObjects(), this.detectionInterval);
        }
    }
    
    /**
     * Process detected objects for obstacle warnings - doesn't interrupt navigation
     */
    processObstacleDetections(predictions) {
        const currentTime = Date.now();
        
        // Filter for relevant obstacles with high confidence
        const obstacles = predictions.filter(prediction => {
            return prediction.score >= this.navigationConfig.obstacleDetectionSensitivity &&
                   this.isObstacleClass(prediction.class);
        });
        
        if (obstacles.length > 0 && currentTime - this.lastDetectionTime > 3000) {
            // Find most prominent obstacle (largest bounding box area)
            const primaryObstacle = obstacles.reduce((largest, current) => {
                const currentArea = (current.bbox[2] - current.bbox[0]) * (current.bbox[3] - current.bbox[1]);
                const largestArea = (largest.bbox[2] - largest.bbox[0]) * (largest.bbox[3] - largest.bbox[1]);
                return currentArea > largestArea ? current : largest;
            });
            
            // Announce obstacle without interrupting navigation instructions
            this.announceObstacle(primaryObstacle.class);
            this.lastDetectionTime = currentTime;
        }
    }
    
    /**
     * Check if detected class is considered an obstacle
     */
    isObstacleClass(className) {
        const obstacleClasses = [
            'person', 'car', 'truck', 'bus', 'motorcycle', 'bicycle',
            'traffic light', 'stop sign', 'bench', 'chair', 'dining table',
            'potted plant', 'umbrella', 'backpack', 'handbag', 'suitcase',
            'bottle', 'cup', 'bowl'
        ];
        return obstacleClasses.includes(className.toLowerCase());
    }
    
    /**
     * Announce detected obstacle - KEY REQUIREMENT
     */
    announceObstacle(objectClass) {
        const message = `Obstacle ahead: ${objectClass}`;
        this.speak(message, 'normal', false); // Don't interrupt navigation instructions
    }
    
    /**
     * Stop object detection
     */
    stopNavigationDetection() {
        this.isDetecting = false;
        this.obstacleDetectionEnabled = false;
        console.log('Object detection stopped');
    }
    
    /**
     * Get current position with promise wrapper
     */
    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000
                }
            );
        });
    }
    
    /**
     * Calculate distance between two coordinates using Haversine formula
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }
    
    /**
     * Speech synthesis with priority queue - doesn't interrupt navigation when announcing obstacles
     */
    speak(text, priority = 'normal', interrupt = true) {
        if (!text) return;
        
        console.log(`Speaking (${priority}): ${text}`);
        
        // If high priority and interrupting, stop current speech
        if (interrupt && (priority === 'high' || priority === 'emergency')) {
            this.synthesis.cancel();
            this.isSpeaking = false;
        }
        
        // Queue the speech
        this.speechQueue.push({ text, priority });
        
        // Process queue if not currently speaking
        if (!this.isSpeaking) {
            this.processSpeechQueue();
        }
    }
    
    /**
     * Process speech queue with priority handling
     */
    processSpeechQueue() {
        if (this.speechQueue.length === 0 || this.isSpeaking) {
            return;
        }
        
        // Sort by priority (emergency > high > normal > low)
        this.speechQueue.sort((a, b) => {
            const priorityOrder = { emergency: 4, high: 3, normal: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
        
        const { text, priority } = this.speechQueue.shift();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = priority === 'emergency' ? 1.1 : 0.9;
        utterance.volume = priority === 'emergency' ? 1.0 : 0.8;
        
        utterance.onstart = () => {
            this.isSpeaking = true;
        };
        
        utterance.onend = () => {
            this.isSpeaking = false;
            // Process next item in queue
            setTimeout(() => this.processSpeechQueue(), 500);
        };
        
        utterance.onerror = () => {
            this.isSpeaking = false;
            // Process next item in queue
            setTimeout(() => this.processSpeechQueue(), 500);
        };
        
        this.synthesis.speak(utterance);
    }
    
    /**
     * Start listening for navigation commands
     */
    startListening() {
        if (!this.recognition) {
            this.speak('Voice recognition not available', 'normal');
            return;
        }
        
        if (!this.permissions.microphone) {
            this.speak('Microphone permission required for voice commands', 'high');
            return;
        }
        
        try {
            this.recognition.start();
            console.log('Started listening for navigation commands');
        } catch (error) {
            console.error('Error starting voice recognition:', error);
        }
    }
    
    /**
     * Public method to trigger navigation via voice command
     */
    navigateByVoice(destination) {
        if (destination) {
            this.handleNavigationCommand(`go to ${destination}`);
        } else {
            this.speak('Please specify a destination for navigation', 'normal');
        }
    }
}

// Initialize navigation system when DOM is ready and fix console errors
if (typeof window !== 'undefined') {
    // Wait for DOM to be ready
    function initializeNavigation() {
        if (typeof window.navigation === 'undefined') {
            window.navigation = new BlindMateNavigation();
            console.log('BlindMate Navigation System initialized and ready');
        }
    }
    
    // Initialize immediately if DOM is already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeNavigation);
    } else {
        initializeNavigation();
    }
    
    // Enhanced error handling to prevent console errors
    window.addEventListener('error', (event) => {
        if (event.message.includes('startNavigation') && typeof window.navigation !== 'undefined') {
            console.error('Navigation function called but navigation not ready. Please wait for initialization.');
        }
    });
    
    // Expose navigation functions globally for button clicks
    window.startNavigation = function(destination) {
        if (window.navigation && typeof window.navigation.navigateByVoice === 'function') {
            window.navigation.navigateByVoice(destination);
        } else {
            console.error('Navigation system not initialized');
        }
    };
    
    window.stopNavigation = function() {
        if (window.navigation && typeof window.navigation.stopNavigation === 'function') {
            window.navigation.stopNavigation();
        } else {
            console.error('Navigation system not initialized');
        }
    };
    
} else {
    console.warn('Navigation.js loaded in non-browser environment');
}