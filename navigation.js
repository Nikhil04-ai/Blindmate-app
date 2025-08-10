/**
 * BlindMate Navigation System - Google Maps Only
 * Uses only Google Directions API and Google Geocoding API
 * Voice-controlled turn-by-turn navigation with live GPS tracking
 */
class UniversalNavigation {
    constructor() {
        // Navigation states
        this.isNavigating = false;
        this.currentRoute = null;
        this.currentStepIndex = 0;
        this.watchId = null;
        this.currentPosition = null;
        this.awaitingConfirmation = false;
        this.currentDestination = null;
        
        // Navigation configuration
        this.config = {
            stepProximityThreshold: 25, // meters - when to advance to next step
            routeDeviationThreshold: 50, // meters - when to reroute
            positionUpdateInterval: 3000, // ms
            voicePreviewDistance: 100, // meters - when to announce "in X meters"
        };
        
        // Google Maps integration
        this.map = null;
        this.directionsService = null;
        this.directionsRenderer = null;
        this.userMarker = null;
        this.googleMapsApiKey = null;
        
        // Speech recognition and synthesis
        this.recognition = null;
        this.confirmationRecognition = null;
        this.speechSynthesis = window.speechSynthesis;
        this.isSpeaking = false;
        this.speechQueue = [];
        
        // COCO-SSD model for obstacle detection
        this.model = null;
        this.isDetecting = false;
        this.detectionCanvas = null;
        this.detectionContext = null;
        this.camera = null;
        
        // Permissions
        this.permissions = {
            camera: false,
            microphone: false,
            location: false
        };
        
        this.initialize();
    }
    
    /**
     * Initialize the navigation system
     */
    async initialize() {
        console.log('Initializing BlindMate Navigation System...');
        
        this.setupSpeechRecognition();
        this.setupUIEventListeners();
        
        // Request all permissions on page load
        await this.requestAllPermissions();
        
        // Initialize camera for obstacle detection
        await this.initializeCamera();
        
        // Load object detection model
        await this.loadModel();
        
        // Get Google Maps API key
        await this.getGoogleMapsApiKey();
        
        console.log('Universal Navigation System initialized');
    }
    
    /**
     * Get Google Maps API key from backend
     */
    async getGoogleMapsApiKey() {
        try {
            const response = await fetch('/api/google-maps-key');
            if (response.ok) {
                const data = await response.json();
                this.googleMapsApiKey = data.key;
                console.log('Google Maps API key retrieved');
                
                // Initialize Google Maps if key is available
                if (window.google && window.google.maps) {
                    this.initializeGoogleMaps();
                }
            } else {
                console.error('Failed to get Google Maps API key');
            }
        } catch (error) {
            console.error('Error getting Google Maps API key:', error);
        }
    }
    
    /**
     * Initialize Google Maps
     */
    initializeGoogleMaps() {
        if (!this.googleMapsApiKey) {
            console.error('Google Maps API key not available');
            return;
        }
        
        console.log('Google Maps JavaScript API will be used for navigation');
        
        // Initialize map
        const defaultCenter = this.currentPosition ? 
            { lat: this.currentPosition.latitude, lng: this.currentPosition.longitude } :
            { lat: 28.6139, lng: 77.2090 }; // Default to Delhi
        
        this.map = new google.maps.Map(document.getElementById('map'), {
            zoom: 16,
            center: defaultCenter,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        });
        
        this.directionsService = new google.maps.DirectionsService();
        this.directionsRenderer = new google.maps.DirectionsRenderer({
            map: this.map,
            suppressMarkers: false
        });
        
        console.log('Google Maps initialized');
    }
    
    /**
     * Request all permissions on page load
     */
    async requestAllPermissions() {
        console.log('Requesting all permissions...');
        
        try {
            // Request microphone permission
            console.log('Requesting microphone permission...');
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.permissions.microphone = true;
            audioStream.getTracks().forEach(track => track.stop());
            console.log('Microphone permission granted');
            
            // Request camera permission
            console.log('Requesting camera permission...');
            const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
            this.permissions.camera = true;
            videoStream.getTracks().forEach(track => track.stop());
            console.log('Camera permission granted');
            
            // Request location permission
            console.log('Requesting location permission...');
            this.currentPosition = await this.getCurrentPosition();
            this.permissions.location = true;
            console.log('Location permission granted');
            
            this.speak('All permissions granted. Navigation system ready.');
            
        } catch (error) {
            console.error('Permission request failed:', error);
            this.speak('Some permissions were denied. Please enable all permissions for full functionality.');
        }
    }
    
    /**
     * Get current position with promise
     */
    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                position => resolve(position.coords),
                error => reject(error),
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 30000
                }
            );
        });
    }
    
    /**
     * Initialize camera for obstacle detection
     */
    async initializeCamera() {
        try {
            const video = document.getElementById('webcam');
            if (!video) {
                console.warn('Webcam element not found');
                return;
            }
            
            this.camera = video;
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480 }
            });
            
            video.srcObject = stream;
            await new Promise(resolve => {
                video.onloadedmetadata = () => {
                    video.play();
                    resolve();
                };
            });
            
            console.log('Camera initialized successfully');
            
            // Setup detection canvas
            this.detectionCanvas = document.getElementById('canvas') || document.createElement('canvas');
            this.detectionContext = this.detectionCanvas.getContext('2d');
            
        } catch (error) {
            console.error('Camera initialization failed:', error);
        }
    }
    
    /**
     * Load COCO-SSD model for object detection
     */
    async loadModel() {
        try {
            if (typeof cocoSsd === 'undefined') {
                console.warn('COCO-SSD not loaded, obstacle detection disabled');
                return;
            }
            
            console.log('Loading COCO-SSD model for navigation...');
            this.model = await cocoSsd.load();
            console.log('COCO-SSD model loaded successfully');
            console.log('COCO-SSD model loaded for navigation');
            
        } catch (error) {
            console.error('Failed to load COCO-SSD model:', error);
        }
    }
    
    /**
     * Setup speech recognition for navigation commands
     */
    setupSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.error('Speech recognition not supported');
            return;
        }
        
        console.log('Initializing speech recognition...');
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        // Main navigation recognition
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';
        
        console.log('Speech recognition object created successfully');
        
        this.recognition.onstart = () => {
            console.log('Speech recognition started');
            this.updateStatusDisplay('Listening...', 'Speak your destination');
        };
        
        this.recognition.onresult = (event) => {
            if (event.results && event.results[0]) {
                const command = event.results[0][0].transcript.toLowerCase().trim();
                console.log('Navigation command received:', command);
                this.processNavigationCommand(command);
            }
        };
        
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.speak('Sorry, I didn\'t understand. Please try again.');
        };
        
        // Confirmation recognition
        this.confirmationRecognition = new SpeechRecognition();
        this.confirmationRecognition.continuous = false;
        this.confirmationRecognition.interimResults = false;
        this.confirmationRecognition.lang = 'en-US';
        
        this.confirmationRecognition.onresult = (event) => {
            if (event.results && event.results[0]) {
                const response = event.results[0][0].transcript.toLowerCase().trim();
                this.processConfirmation(response);
            }
        };
    }
    
    /**
     * Setup UI event listeners
     */
    setupUIEventListeners() {
        console.log('UI event listeners setup complete');
        
        // Volume key detection for hands-free operation
        document.addEventListener('keydown', (event) => {
            if (event.code === 'AudioVolumeUp' || event.key === 'AudioVolumeUp') {
                event.preventDefault();
                this.startListening();
            }
        });
        
        // Click events for buttons
        const startNavBtn = document.getElementById('startNavigationBtn');
        if (startNavBtn) {
            startNavBtn.addEventListener('click', () => this.startListening());
        }
        
        const stopNavBtn = document.getElementById('stopNavigationBtn');
        if (stopNavBtn) {
            stopNavBtn.addEventListener('click', () => this.stopNavigation());
        }
    }
    
    /**
     * Start listening for navigation commands
     */
    startListening() {
        if (this.awaitingConfirmation) {
            this.confirmationRecognition.start();
        } else {
            this.recognition.start();
        }
    }
    
    /**
     * Process navigation commands
     */
    async processNavigationCommand(command) {
        console.log('Processing navigation command:', command);
        
        // Extract destination from command
        let destination = this.extractDestination(command);
        if (!destination) {
            this.speak('I didn\'t understand the destination. Please say "take me to" followed by a location.');
            return;
        }
        
        // Confirm navigation
        this.currentDestination = destination;
        this.awaitingConfirmation = true;
        this.speak(`Should I start navigation to ${destination}?`);
        this.updateStatusDisplay('Waiting for confirmation', 'Say "yes" or "no"');
    }
    
    /**
     * Extract destination from voice command
     */
    extractDestination(command) {
        // Common patterns for navigation commands
        const patterns = [
            /(?:take me to|navigate to|go to|direction to|directions to)\s+(.+)/i,
            /(?:how to get to|where is|find)\s+(.+)/i,
            /(.+)/i // fallback - treat entire command as destination
        ];
        
        for (const pattern of patterns) {
            const match = command.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        
        return null;
    }
    
    /**
     * Process confirmation responses
     */
    async processConfirmation(response) {
        this.awaitingConfirmation = false;
        
        if (response.includes('yes') || response.includes('yeah') || response.includes('start')) {
            this.speak('Starting navigation...');
            await this.startNavigation(this.currentDestination);
        } else {
            this.speak('Navigation cancelled.');
            this.currentDestination = null;
            this.updateStatusDisplay('Ready', 'Press button to start navigation');
        }
    }
    
    /**
     * Start navigation to destination
     */
    async startNavigation(destination) {
        try {
            if (!this.currentPosition) {
                this.currentPosition = await this.getCurrentPosition();
            }
            
            this.updateStatusDisplay('Getting directions...', 'Please wait');
            
            const origin = `${this.currentPosition.latitude},${this.currentPosition.longitude}`;
            
            // Call backend API to get directions
            const response = await fetch('/api/directions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    origin: origin,
                    destination: destination
                })
            });
            
            const data = await response.json();
            
            if (!data.success) {
                this.speak(data.message || 'Navigation failed. Please try again.');
                this.updateStatusDisplay('Navigation failed', data.message);
                return;
            }
            
            this.currentRoute = data;
            this.currentStepIndex = 0;
            this.isNavigating = true;
            
            // Start GPS tracking
            this.startGPSTracking();
            
            // Display route on map if available
            if (this.map && this.directionsRenderer) {
                this.displayRouteOnMap();
            }
            
            // Start navigation announcements
            this.announceRoute();
            
            // Enable obstacle detection during navigation
            this.startObstacleDetection();
            
            console.log('Navigation started successfully');
            
        } catch (error) {
            console.error('Navigation start failed:', error);
            this.speak('Failed to start navigation. Please check your connection and try again.');
        }
    }
    
    /**
     * Announce route information
     */
    announceRoute() {
        if (!this.currentRoute || !this.currentRoute.route) return;
        
        const route = this.currentRoute.route;
        const totalDistance = route.distance;
        const totalDuration = route.duration;
        
        this.speak(`Route found. Total distance ${totalDistance}, estimated time ${totalDuration}. Starting navigation.`);
        
        // Announce first step
        setTimeout(() => {
            this.announceCurrentStep();
        }, 3000);
    }
    
    /**
     * Announce current navigation step
     */
    announceCurrentStep() {
        if (!this.isNavigating || !this.currentRoute) return;
        
        const steps = this.currentRoute.route.steps;
        if (this.currentStepIndex >= steps.length) {
            this.navigationComplete();
            return;
        }
        
        const currentStep = steps[this.currentStepIndex];
        const instruction = currentStep.instruction;
        const distance = currentStep.distance;
        
        this.speak(`${instruction}. Distance: ${distance}.`);
        this.updateStatusDisplay(`Step ${this.currentStepIndex + 1} of ${steps.length}`, instruction);
    }
    
    /**
     * Start GPS tracking during navigation
     */
    startGPSTracking() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
        }
        
        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.updatePosition(position.coords);
            },
            (error) => {
                console.error('GPS tracking error:', error);
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 10000
            }
        );
        
        console.log('GPS tracking started');
    }
    
    /**
     * Update position during navigation
     */
    updatePosition(newPosition) {
        this.currentPosition = newPosition;
        
        if (this.userMarker && this.map) {
            this.userMarker.setPosition({
                lat: newPosition.latitude,
                lng: newPosition.longitude
            });
            this.map.panTo({
                lat: newPosition.latitude,
                lng: newPosition.longitude
            });
        }
        
        // Check if user reached current step
        this.checkStepProgress();
    }
    
    /**
     * Check if user has reached the current step
     */
    checkStepProgress() {
        if (!this.isNavigating || !this.currentRoute) return;
        
        const steps = this.currentRoute.route.steps;
        if (this.currentStepIndex >= steps.length) return;
        
        const currentStep = steps[this.currentStepIndex];
        const targetLocation = currentStep.end_location;
        
        const distance = this.calculateDistance(
            { lat: this.currentPosition.latitude, lng: this.currentPosition.longitude },
            { lat: targetLocation.lat, lng: targetLocation.lng }
        );
        
        // If within threshold, move to next step
        if (distance <= this.config.stepProximityThreshold) {
            this.currentStepIndex++;
            
            if (this.currentStepIndex >= steps.length) {
                this.navigationComplete();
            } else {
                // Announce next step after a brief pause
                setTimeout(() => {
                    this.announceCurrentStep();
                }, 1000);
            }
        }
    }
    
    /**
     * Calculate distance between two coordinates (Haversine formula)
     */
    calculateDistance(pos1, pos2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = pos1.lat * Math.PI / 180;
        const φ2 = pos2.lat * Math.PI / 180;
        const Δφ = (pos2.lat - pos1.lat) * Math.PI / 180;
        const Δλ = (pos2.lng - pos1.lng) * Math.PI / 180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c; // Distance in meters
    }
    
    /**
     * Display route on Google Maps
     */
    displayRouteOnMap() {
        if (!this.map || !this.directionsService || !this.currentRoute) return;
        
        console.log('Displaying route on map');
        
        const steps = this.currentRoute.route.steps;
        if (!steps || steps.length === 0) return;
        
        const origin = new google.maps.LatLng(
            this.currentPosition.latitude,
            this.currentPosition.longitude
        );
        
        const destination = new google.maps.LatLng(
            steps[steps.length - 1].end_location.lat,
            steps[steps.length - 1].end_location.lng
        );
        
        const request = {
            origin: origin,
            destination: destination,
            travelMode: google.maps.TravelMode.WALKING
        };
        
        this.directionsService.route(request, (result, status) => {
            if (status === google.maps.DirectionsStatus.OK) {
                this.directionsRenderer.setDirections(result);
                
                // Add user marker
                if (!this.userMarker) {
                    this.userMarker = new google.maps.Marker({
                        position: origin,
                        map: this.map,
                        title: 'Your Location',
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 8,
                            fillColor: '#4285F4',
                            fillOpacity: 1,
                            strokeColor: '#ffffff',
                            strokeWeight: 2
                        }
                    });
                }
            }
        });
    }
    
    /**
     * Start obstacle detection during navigation
     */
    startObstacleDetection() {
        if (!this.model || !this.camera) return;
        
        this.isDetecting = true;
        this.detectObjects();
        console.log('Obstacle detection started during navigation');
    }
    
    /**
     * Detect objects for obstacle avoidance
     */
    async detectObjects() {
        if (!this.isDetecting || !this.model || !this.camera) return;
        
        try {
            const predictions = await this.model.detect(this.camera);
            
            // Filter for potential obstacles
            const obstacles = predictions.filter(pred => 
                ['person', 'bicycle', 'car', 'motorcycle', 'bus', 'truck', 'traffic light', 'stop sign'].includes(pred.class) && 
                pred.score > 0.5
            );
            
            if (obstacles.length > 0) {
                const obstacleTypes = [...new Set(obstacles.map(obs => obs.class))];
                this.speak(`Obstacle detected: ${obstacleTypes.join(', ')} ahead.`, 'high');
            }
            
        } catch (error) {
            console.error('Object detection error:', error);
        }
        
        // Continue detection
        if (this.isDetecting) {
            setTimeout(() => this.detectObjects(), 2000);
        }
    }
    
    /**
     * Navigation completed
     */
    navigationComplete() {
        this.speak('You have arrived at your destination.');
        this.updateStatusDisplay('Navigation Complete', 'You have arrived');
        this.stopNavigation();
    }
    
    /**
     * Stop navigation
     */
    stopNavigation() {
        this.isNavigating = false;
        this.currentRoute = null;
        this.currentStepIndex = 0;
        this.awaitingConfirmation = false;
        this.currentDestination = null;
        this.isDetecting = false;
        
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        
        if (this.directionsRenderer) {
            this.directionsRenderer.setDirections(null);
        }
        
        this.updateStatusDisplay('Ready', 'Press button to start navigation');
        console.log('Navigation stopped');
    }
    
    /**
     * Speak text with priority queue
     */
    speak(text, priority = 'normal') {
        console.log(`Speaking (${priority}): ${text}`);
        
        // Cancel current speech if higher priority
        if (priority === 'high' && this.speechSynthesis.speaking) {
            this.speechSynthesis.cancel();
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.volume = 1.0;
        utterance.pitch = 1.0;
        
        utterance.onstart = () => {
            this.isSpeaking = true;
        };
        
        utterance.onend = () => {
            this.isSpeaking = false;
        };
        
        this.speechSynthesis.speak(utterance);
    }
    
    /**
     * Update status display
     */
    updateStatusDisplay(title, subtitle) {
        const statusTitle = document.getElementById('navigationStatus');
        const statusSubtitle = document.getElementById('navigationSubtitle');
        
        if (statusTitle) statusTitle.textContent = title;
        if (statusSubtitle) statusSubtitle.textContent = subtitle;
    }
}

// Initialize navigation system when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing BlindMate Navigation System...');
    window.blindMateNavigation = new UniversalNavigation();
});

// Enhanced error handling to prevent console errors
window.addEventListener('error', (event) => {
    console.error('Navigation system error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Navigation system unhandled promise rejection:', event.reason);
    event.preventDefault();
});