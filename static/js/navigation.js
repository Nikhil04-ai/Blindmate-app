/**
 * BlindMate Enhanced Navigation System
 * High-accuracy GPS tracking with optimized battery usage and human-friendly speech instructions
 * Features: Smart tracking frequency, robust error handling, clear voice navigation
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
        this.lastLocationUpdateTime = null;
        this.userSpeed = 0; // m/s
        this.stationary = false;
        this.destinationReached = false;
        
        // Enhanced navigation configuration
        this.config = {
            stepProximityThreshold: 15, // meters - when to advance to next step
            routeDeviationThreshold: 30, // meters - when to reroute
            destinationReachedThreshold: 10, // meters - when destination is reached
            // Battery optimization thresholds
            highFrequencyInterval: 2000, // ms - when user is moving
            lowFrequencyInterval: 8000, // ms - when user is stationary
            stationarySpeedThreshold: 0.5, // m/s - below this is considered stationary
            // Voice instruction optimization
            voicePreviewDistance: 50, // meters - when to announce "in X meters"
            repeatInstructionDistance: 25, // meters - repeat instructions if user hasn't moved
            urgentAnnouncementDistance: 10, // meters - for urgent turn warnings
        };
        
        // Google Maps integration
        this.map = null;
        this.directionsService = null;
        this.directionsRenderer = null;
        this.userMarker = null;
        this.googleMapsApiKey = null;
        
        // Enhanced speech recognition and synthesis
        this.recognition = null;
        this.confirmationRecognition = null;
        this.speechSynthesis = window.speechSynthesis;
        this.isSpeaking = false;
        this.isActivelyListening = false;
        this.speechQueue = [];
        this.lastUtterance = null;
        this.speechCancellationTimer = null;
        
        // COCO-SSD model for obstacle detection
        this.model = null;
        this.isDetecting = false;
        this.detectionCanvas = null;
        this.detectionContext = null;
        this.camera = null;
        
        // Enhanced permissions and error handling
        this.permissions = {
            camera: false,
            microphone: false,
            location: false
        };
        this.errorStates = {
            gpsLost: false,
            speechFailed: false,
            routingFailed: false
        };
        
        // Mobile device detection
        this.isMobile = this.detectMobileDevice();
        
        this.initialize();
    }
    
    /**
     * Detect if running on mobile device for battery optimization
     */
    detectMobileDevice() {
        const userAgent = navigator.userAgent;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) || 
                         'ontouchstart' in window || 
                         navigator.maxTouchPoints > 0;
        
        console.log('Mobile device detected:', isMobile, {
            userAgent: userAgent,
            ontouchstart: 'ontouchstart' in window,
            maxTouchPoints: navigator.maxTouchPoints
        });
        
        return isMobile;
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
        
        console.log('BlindMate Navigation System initialized');
        
        // Setup mobile-specific optimizations
        if (this.isMobile) {
            console.log('Checking mobile device for double-tap setup:', this.isMobile);
            this.setupMobileOptimizations();
        } else {
            console.log('Desktop device - double-tap not enabled');
        }
    }
    
    /**
     * Setup mobile-specific optimizations for battery life
     */
    setupMobileOptimizations() {
        // Enable high accuracy mode for mobile devices
        this.config.highAccuracyMode = true;
        
        // Reduce detection frequency on mobile to save battery
        this.config.obstacleDetectionInterval = 3000;
        
        // Enable more aggressive stationary detection
        this.config.stationaryTimeout = 30000; // 30 seconds
        
        console.log('Mobile optimizations enabled for battery efficiency');
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
     * Initialize map (called by Google Maps API callback)
     */
    initializeMap() {
        console.log('Google Maps callback triggered');
        this.initializeGoogleMaps();
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
     * Get current position with enhanced accuracy and error handling
     */
    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                const error = new Error('Geolocation not supported on this device');
                this.handleLocationError(error);
                reject(error);
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                position => {
                    this.errorStates.gpsLost = false;
                    console.log('GPS position acquired successfully');
                    resolve(position.coords);
                },
                error => {
                    this.handleLocationError(error);
                    reject(error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0 // Always get fresh location
                }
            );
        });
    }
    
    /**
     * Handle location errors with user-friendly messages and UI updates
     */
    handleLocationError(error) {
        this.errorStates.gpsLost = true;
        let errorMessage = '';
        let uiMessage = '';
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                errorMessage = 'Location access denied. Please enable location permissions in your browser settings.';
                uiMessage = 'Location Permission Denied';
                break;
            case error.POSITION_UNAVAILABLE:
                errorMessage = 'Location information unavailable. Please check your GPS connection.';
                uiMessage = 'GPS Signal Unavailable';
                break;
            case error.TIMEOUT:
                errorMessage = 'Location request timed out. Trying again...';
                uiMessage = 'GPS Signal Weak';
                break;
            default:
                errorMessage = 'Unknown location error occurred. Please try again.';
                uiMessage = 'Location Error';
                break;
        }
        
        console.error('Location error:', error.message, errorMessage);
        this.speakErrorMessage(errorMessage);
        this.updateStatusDisplay(uiMessage, errorMessage);
        this.showErrorInUI(uiMessage, errorMessage);
    }
    
    /**
     * Show error message in UI with clear visual indication
     */
    showErrorInUI(title, message) {
        const errorElement = document.getElementById('errorDisplay');
        if (errorElement) {
            errorElement.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>${title}</strong>
                    <p>${message}</p>
                </div>
            `;
            errorElement.style.display = 'block';
            
            // Auto-hide after 10 seconds
            setTimeout(() => {
                errorElement.style.display = 'none';
            }, 10000);
        }
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
            console.log('Navigation speech recognition started');
            this.isActivelyListening = true;
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
            console.error('Navigation speech recognition error:', event.error);
            const wasActivelyListening = this.isActivelyListening;
            this.isActivelyListening = false;
            
            // Only speak error messages for meaningful errors, not technical ones
            if (event.error === 'not-allowed') {
                this.speak('Microphone access is required for navigation. Please allow microphone access.');
            } else if (event.error === 'no-speech' && wasActivelyListening) {
                this.speak('No speech detected. Please try again.');
            }
            // Don't speak for 'aborted' or other technical errors that happen during normal operation
        };
        
        this.recognition.onend = () => {
            console.log('Navigation speech recognition ended');
            this.isActivelyListening = false;
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
     * Setup enhanced UI event listeners
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
        
        // Main navigation button (primary interface)
        const mainBtn = document.getElementById('mainButton');
        if (mainBtn) {
            mainBtn.addEventListener('click', () => {
                if (this.isNavigating) {
                    this.stopNavigation();
                } else {
                    this.startListening();
                }
                this.updateMainButtonState();
            });
        }
        
        // Navigation control buttons
        const emergencyBtn = document.getElementById('emergencyStop');
        if (emergencyBtn) {
            emergencyBtn.addEventListener('click', () => {
                this.emergencyStop();
            });
        }
        
        const showMapBtn = document.getElementById('showMapBtn');
        if (showMapBtn) {
            showMapBtn.addEventListener('click', () => {
                this.showNavigationMap();
            });
        }
        
        const testVoiceBtn = document.getElementById('testVoiceBtn');
        if (testVoiceBtn) {
            testVoiceBtn.addEventListener('click', () => {
                this.testVoiceRecognition();
            });
        }
        
        const resumeNavigationBtn = document.getElementById('resumeNavigation');
        if (resumeNavigationBtn) {
            resumeNavigationBtn.addEventListener('click', () => {
                this.resumeNavigationFromMap();
            });
        }
        
        // Accessibility: Allow Enter key to activate main button
        if (mainBtn) {
            mainBtn.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    mainBtn.click();
                }
            });
        }
        
        // Legacy button support
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
     * Update main button state based on navigation status
     */
    updateMainButtonState() {
        const mainBtn = document.getElementById('mainButton');
        if (!mainBtn) return;
        
        if (this.isNavigating) {
            mainBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Navigation';
            mainBtn.classList.add('navigating');
            mainBtn.classList.remove('listening');
        } else if (this.awaitingConfirmation) {
            mainBtn.innerHTML = '<i class="fas fa-microphone"></i> Listening...';
            mainBtn.classList.add('listening');
            mainBtn.classList.remove('navigating');
        } else {
            mainBtn.innerHTML = '<i class="fas fa-microphone"></i> Start Listening';
            mainBtn.classList.remove('listening', 'navigating');
        }
        
        // Show/hide navigation controls
        const navControls = document.getElementById('navigationControls');
        if (navControls) {
            navControls.style.display = this.isNavigating ? 'block' : 'none';
        }
    }
    
    /**
     * Emergency stop with immediate feedback
     */
    emergencyStop() {
        console.log('Emergency stop activated');
        this.speakWithPriority('Navigation stopped immediately.', 'high');
        this.stopNavigation();
        this.updateMainButtonState();
    }
    
    /**
     * Start listening for navigation commands
     */
    startListening() {
        this.isActivelyListening = true;
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
     * Enhanced navigation startup with comprehensive error handling
     */
    async startNavigation(destination) {
        try {
            // Reset navigation state
            this.destinationReached = false;
            this.urgentWarningGiven = false;
            this.previewWarningGiven = false;
            
            if (!this.currentPosition) {
                try {
                    this.currentPosition = await this.getCurrentPosition();
                } catch (error) {
                    this.handleLocationError(error);
                    return;
                }
            }
            
            this.updateStatusDisplay('Getting directions...', 'Please wait');
            this.speakWithPriority('Getting directions to your destination.', 'normal');
            
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
                const errorMessage = data.message || 'Navigation failed. Please try again.';
                this.errorStates.routingFailed = true;
                this.speakErrorMessage(errorMessage);
                this.updateStatusDisplay('Navigation Failed', errorMessage);
                this.showErrorInUI('Route Not Found', errorMessage);
                return;
            }
            
            this.currentRoute = data;
            this.currentStepIndex = 0;
            this.isNavigating = true;
            this.errorStates.routingFailed = false;
            
            // Start intelligent GPS tracking with battery optimization
            this.startContinuousGPSTracking();
            
            // Display route on map if available
            if (this.map && this.directionsRenderer) {
                this.displayRouteOnMap();
            }
            
            // Start navigation announcements
            this.announceRoute();
            
            // Enable obstacle detection during navigation
            this.startObstacleDetection();
            
            // Update UI state
            this.updateMainButtonState();
            
            // Show navigation info overlay
            const navigationInfo = document.getElementById('navigationInfo');
            if (navigationInfo) {
                navigationInfo.style.display = 'block';
            }
            
            console.log('Enhanced navigation started successfully');
            
        } catch (error) {
            console.error('Navigation start failed:', error);
            this.errorStates.routingFailed = true;
            const errorMessage = 'Failed to start navigation. Please check your connection and try again.';
            this.speakErrorMessage(errorMessage);
            this.showErrorInUI('Navigation Error', errorMessage);
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
     * Announce current navigation step with human-friendly voice instructions
     */
    announceCurrentStep() {
        if (!this.isNavigating || !this.currentRoute) return;
        
        const steps = this.currentRoute.route.steps;
        if (this.currentStepIndex >= steps.length) {
            this.navigationComplete();
            return;
        }
        
        const currentStep = steps[this.currentStepIndex];
        if (!currentStep) return;
        
        // Reset warning flags for new step
        this.urgentWarningGiven = false;
        this.previewWarningGiven = false;
        
        const instruction = this.optimizeVoiceInstruction(currentStep.instruction);
        const distance = this.simplifyDistance(currentStep.distance_value || currentStep.distance_meters || 0);
        
        // Create clear, conversational voice instruction like "Turn left in 20 meters"
        let voiceInstruction = `${instruction}`;
        if (distance && !instruction.toLowerCase().includes('arrive')) {
            voiceInstruction = `${instruction} in ${distance}`;
        }
        
        this.speakWithPriority(voiceInstruction, 'normal');
        this.updateStatusDisplay(`Step ${this.currentStepIndex + 1} of ${steps.length}`, instruction);
        this.updateNavigationDisplay(instruction, distance);
        
        console.log(`Navigation step ${this.currentStepIndex + 1}: ${voiceInstruction}`);
    }
    
    /**
     * Update navigation display in UI
     */
    updateNavigationDisplay(instruction, distance) {
        const currentStepElement = document.getElementById('currentStep');
        const stepDistanceElement = document.getElementById('stepDistance');
        
        if (currentStepElement) {
            currentStepElement.textContent = instruction;
        }
        
        if (stepDistanceElement && distance) {
            stepDistanceElement.textContent = `Distance: ${distance}`;
        }
        
        // Show navigation info overlay
        const navigationInfo = document.getElementById('navigationInfo');
        if (navigationInfo) {
            navigationInfo.style.display = 'block';
        }
    }
    
    /**
     * Convert navigation data into human-friendly speech instructions
     */
    optimizeVoiceInstruction(instruction) {
        let optimized = instruction.toLowerCase().trim();
        
        // Convert raw navigation data into conversational instructions
        
        // Handle turns with clear directional language
        optimized = optimized.replace(/turn\s+slight\s+left/gi, 'bear left');
        optimized = optimized.replace(/turn\s+slight\s+right/gi, 'bear right');
        optimized = optimized.replace(/turn\s+sharp\s+left/gi, 'make a sharp left turn');
        optimized = optimized.replace(/turn\s+sharp\s+right/gi, 'make a sharp right turn');
        optimized = optimized.replace(/turn\s+left/gi, 'turn left');
        optimized = optimized.replace(/turn\s+right/gi, 'turn right');
        
        // Handle straight movements
        optimized = optimized.replace(/head\s+north/gi, 'go straight ahead');
        optimized = optimized.replace(/head\s+south/gi, 'go straight ahead');
        optimized = optimized.replace(/head\s+east/gi, 'go straight ahead');
        optimized = optimized.replace(/head\s+west/gi, 'go straight ahead');
        optimized = optimized.replace(/continue\s+straight/gi, 'keep going straight');
        optimized = optimized.replace(/proceed\s+/gi, '');
        optimized = optimized.replace(/continue\s+/gi, 'keep going ');
        
        // Simplify common phrases
        optimized = optimized.replace(/walk\s+/gi, '');
        optimized = optimized.replace(/go\s+/gi, '');
        optimized = optimized.replace(/head\s+/gi, '');
        optimized = optimized.replace(/use\s+the\s+/gi, 'take the ');
        optimized = optimized.replace(/\s+toward\s+/gi, ' toward ');
        optimized = optimized.replace(/\s+towards\s+/gi, ' toward ');
        
        // Handle destination phrases
        optimized = optimized.replace(/destination\s+will\s+be\s+on\s+the\s+/gi, 'your destination is on the ');
        optimized = optimized.replace(/your\s+destination\s+is\s+/gi, 'you will arrive ');
        
        // Handle street/road references
        optimized = optimized.replace(/\s+on\s+([A-Za-z\s]+)\s+road/gi, ' on $1 Road');
        optimized = optimized.replace(/\s+on\s+([A-Za-z\s]+)\s+street/gi, ' on $1 Street');
        optimized = optimized.replace(/\s+on\s+([A-Za-z\s]+)\s+avenue/gi, ' on $1 Avenue');
        
        // Add helpful distance context
        optimized = optimized.replace(/^(.+)$/i, (match) => {
            // Don't repeat if already contains distance context
            if (match.includes('meter') || match.includes('km') || match.includes('mile')) {
                return match;
            }
            return match;
        });
        
        // Clean up multiple spaces and capitalize
        optimized = optimized.replace(/\s+/g, ' ').trim();
        optimized = optimized.charAt(0).toUpperCase() + optimized.slice(1);
        
        // Ensure instruction ends properly
        if (!optimized.endsWith('.') && !optimized.endsWith('!')) {
            optimized += '.';
        }
        
        return optimized;
    }
    
    /**
     * Simplify distance for voice announcements
     */
    simplifyDistance(meters) {
        if (meters < 50) {
            return `${Math.round(meters / 10) * 10} meters`;
        } else if (meters < 1000) {
            return `${Math.round(meters / 50) * 50} meters`;
        } else {
            const km = (meters / 1000).toFixed(1);
            return `${km} kilometers`;
        }
    }
    
    /**
     * Start intelligent GPS tracking with battery optimization
     */
    startContinuousGPSTracking() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
        }
        
        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.updateNavigationPosition(position.coords);
            },
            (error) => {
                this.handleLocationError(error);
                
                // Retry GPS after error with exponential backoff
                setTimeout(() => {
                    if (this.isNavigating && !this.watchId) {
                        console.log('Retrying GPS tracking after error...');
                        this.startContinuousGPSTracking();
                    }
                }, 5000);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0 // Always get fresh location for navigation
            }
        );
        
        console.log('Enhanced GPS tracking started with battery optimization');
    }
    
    /**
     * Calculate user speed and determine if stationary for battery optimization
     */
    calculateUserSpeed(newCoords) {
        if (!this.lastLocationUpdateTime || !this.currentPosition) {
            this.lastLocationUpdateTime = Date.now();
            return 0;
        }
        
        const now = Date.now();
        const timeDelta = (now - this.lastLocationUpdateTime) / 1000; // seconds
        
        if (timeDelta < 1) return this.userSpeed; // Avoid too frequent calculations
        
        const distance = this.calculateDistance(
            this.currentPosition.latitude, this.currentPosition.longitude,
            newCoords.latitude, newCoords.longitude
        );
        
        const speed = distance / timeDelta; // m/s
        this.userSpeed = speed;
        this.lastLocationUpdateTime = now;
        
        // Determine if user is stationary
        const wasStationary = this.stationary;
        this.stationary = speed < this.config.stationarySpeedThreshold;
        
        // Log speed changes for battery optimization
        if (wasStationary !== this.stationary) {
            console.log(`User movement changed: ${this.stationary ? 'Stationary' : 'Moving'} (Speed: ${speed.toFixed(2)} m/s)`);
            this.optimizeTrackingFrequency();
        }
        
        return speed;
    }
    
    /**
     * Optimize GPS tracking frequency based on user movement to save battery
     */
    optimizeTrackingFrequency() {
        if (!this.isNavigating) return;
        
        // Restart tracking with optimized settings
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
        }
        
        const trackingOptions = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: this.stationary ? this.config.lowFrequencyInterval : 1000
        };
        
        console.log(`Optimizing GPS tracking: ${this.stationary ? 'Low' : 'High'} frequency mode`);
        
        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.updateNavigationPosition(position.coords);
            },
            (error) => {
                this.handleLocationError(error);
            },
            trackingOptions
        );
    }
    
    /**
     * Enhanced position update with destination detection and human-friendly instructions
     */
    updateNavigationPosition(coords) {
        if (!this.isNavigating || !this.currentRoute) return;
        
        const newLat = coords.latitude;
        const newLng = coords.longitude;
        
        // Calculate user speed for battery optimization
        this.calculateUserSpeed(coords);
        
        // Update current position
        this.currentPosition = coords;
        
        // Update map marker if available
        if (this.map && this.userMarker) {
            this.userMarker.setPosition({ lat: newLat, lng: newLng });
        }
        
        // Check if destination is reached first (highest priority)
        if (this.checkDestinationReached(newLat, newLng)) {
            return; // Stop processing if destination reached
        }
        
        // Check if user reached current step
        this.checkStepProgress(newLat, newLng);
        
        // Check if user deviated from route
        this.checkRouteDeviation(newLat, newLng);
        
        // Provide proximity-based voice instructions
        this.provideProximityInstructions(newLat, newLng);
    }
    
    /**
     * Check if user has reached the final destination
     */
    checkDestinationReached(lat, lng) {
        if (!this.currentRoute || this.destinationReached) return false;
        
        const steps = this.currentRoute.route.steps;
        const finalStep = steps[steps.length - 1];
        
        if (!finalStep || !finalStep.end_location) return false;
        
        const distanceToDestination = this.calculateDistance(
            lat, lng, 
            finalStep.end_location.lat, 
            finalStep.end_location.lng
        );
        
        if (distanceToDestination <= this.config.destinationReachedThreshold) {
            this.destinationReached = true;
            this.navigationComplete();
            return true;
        }
        
        return false;
    }
    
    /**
     * Provide human-friendly proximity-based voice instructions
     */
    provideProximityInstructions(lat, lng) {
        if (!this.currentRoute || this.currentStepIndex >= this.currentRoute.route.steps.length) return;
        
        const currentStep = this.currentRoute.route.steps[this.currentStepIndex];
        if (!currentStep || !currentStep.end_location) return;
        
        const distanceToStepEnd = this.calculateDistance(
            lat, lng,
            currentStep.end_location.lat,
            currentStep.end_location.lng
        );
        
        // Provide urgent warning for immediate turns
        if (distanceToStepEnd <= this.config.urgentAnnouncementDistance && !this.urgentWarningGiven) {
            const instruction = this.optimizeVoiceInstruction(currentStep.instruction);
            this.speakWithPriority(`${instruction} now!`, 'high');
            this.urgentWarningGiven = true;
        }
        // Provide advance warning
        else if (distanceToStepEnd <= this.config.voicePreviewDistance && !this.previewWarningGiven) {
            const instruction = this.optimizeVoiceInstruction(currentStep.instruction);
            const distance = this.simplifyDistance(distanceToStepEnd);
            this.speakWithPriority(`${instruction} in ${distance}`, 'normal');
            this.previewWarningGiven = true;
        }
    }
    
    /**
     * Enhanced step progress checking with warning flag management
     */
    checkStepProgress(lat, lng) {
        if (!this.currentRoute || this.currentStepIndex >= this.currentRoute.route.steps.length) return;
        
        const currentStep = this.currentRoute.route.steps[this.currentStepIndex];
        if (!currentStep || !currentStep.end_location) return;
        
        const stepEndLat = currentStep.end_location.lat;
        const stepEndLng = currentStep.end_location.lng;
        
        // Calculate distance to step endpoint
        const distance = this.calculateDistance(lat, lng, stepEndLat, stepEndLng);
        
        // If within threshold of step endpoint, advance to next step
        if (distance <= this.config.stepProximityThreshold) {
            this.currentStepIndex++;
            
            // Reset warning flags for next step
            this.urgentWarningGiven = false;
            this.previewWarningGiven = false;
            
            if (this.currentStepIndex >= this.currentRoute.route.steps.length) {
                this.navigationComplete();
            } else {
                // Announce next step with human-friendly instruction
                setTimeout(() => {
                    this.announceCurrentStep();
                }, 1000);
            }
            
            console.log(`Advanced to navigation step ${this.currentStepIndex + 1}`);
        }
    }
    
    /**
     * Check if user has deviated significantly from the planned route
     */
    checkRouteDeviation(lat, lng) {
        if (!this.currentRoute || this.currentStepIndex >= this.currentRoute.route.steps.length) return;
        
        const currentStep = this.currentRoute.route.steps[this.currentStepIndex];
        const stepStartLat = currentStep.start_location.lat;
        const stepStartLng = currentStep.start_location.lng;
        const stepEndLat = currentStep.end_location.lat;
        const stepEndLng = currentStep.end_location.lng;
        
        // Calculate distance from user to the step route line
        const distanceToRoute = this.calculateDistanceToLine(
            lat, lng, 
            stepStartLat, stepStartLng, 
            stepEndLat, stepEndLng
        );
        
        // If user is more than 50 meters off route, trigger rerouting
        if (distanceToRoute > 50) {
            this.handleRouteDeviation();
        }
    }
    
    /**
     * Handle when user deviates from planned route
     */
    async handleRouteDeviation() {
        if (this.reroutingInProgress) return;
        
        this.reroutingInProgress = true;
        this.speak('You seem off route. Getting updated directions...');
        
        try {
            // Get new route from current position
            await this.startNavigation(this.currentDestination);
            this.speak('Route updated. Follow new directions.');
        } catch (error) {
            console.error('Rerouting failed:', error);
            this.speak('Unable to update route. Continue to destination.');
        } finally {
            this.reroutingInProgress = false;
        }
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
        this.isNavigating = false;
        
        // Stop GPS tracking
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        
        // Stop obstacle detection
        this.isDetecting = false;
        
        // Hide navigation controls
        const navControls = document.getElementById('navigationControls');
        if (navControls) {
            navControls.style.display = 'none';
        }
        
        // Announce completion
        this.speak('You have arrived at your destination. Navigation complete.');
        this.updateStatusDisplay('Navigation Complete', 'You have arrived at your destination');
        
        // Clear route data
        this.currentRoute = null;
        this.currentStepIndex = 0;
        this.currentDestination = null;
        
        console.log('Navigation completed successfully');
    }
    
    /**
     * Enhanced navigation stop with complete state cleanup
     */
    stopNavigation() {
        console.log('Stopping navigation with complete cleanup');
        
        this.isNavigating = false;
        this.reroutingInProgress = false;
        this.destinationReached = false;
        
        // Stop intelligent GPS tracking
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        
        // Stop obstacle detection
        this.isDetecting = false;
        
        // Hide navigation UI elements
        const navigationInfo = document.getElementById('navigationInfo');
        if (navigationInfo) {
            navigationInfo.style.display = 'none';
        }
        
        const emergencyBtn = document.getElementById('emergencyStop');
        if (emergencyBtn) {
            emergencyBtn.style.display = 'none';
        }
        
        // Legacy support
        const navControls = document.getElementById('navigationControls');
        if (navControls) {
            navControls.style.display = 'none';
        }
        
        // Clear map route
        if (this.directionsRenderer) {
            this.directionsRenderer.setDirections(null);
        }
        
        // Cancel any current speech
        if (this.speechSynthesis.speaking) {
            this.speechSynthesis.cancel();
        }
        
        // Announce stop
        this.speakWithPriority('Navigation stopped.', 'high');
        this.updateStatusDisplay('Ready to Navigate', 'Press the button or Volume Up key to start');
        
        // Clear route data and reset flags
        this.currentRoute = null;
        this.currentStepIndex = 0;
        this.currentDestination = null;
        this.awaitingConfirmation = false;
        this.urgentWarningGiven = false;
        this.previewWarningGiven = false;
        this.userSpeed = 0;
        this.stationary = false;
        
        // Update UI state
        this.updateMainButtonState();
        
        console.log('Navigation stopped successfully');
    }
    
    /**
     * Calculate distance between two coordinates (Haversine formula)
     */
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lng2 - lng1) * Math.PI / 180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c; // Distance in meters
    }
    
    /**
     * Calculate distance from point to line segment
     */
    calculateDistanceToLine(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) {
            return this.calculateDistance(px, py, x1, y1);
        }
        
        let param = dot / lenSq;
        
        let xx, yy;
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        return this.calculateDistance(px, py, xx, yy);
    }
    
    /**
     * Enhanced speech synthesis with smooth overlapping voice cancellation
     */
    speak(text, priority = 'normal') {
        this.speakWithPriority(text, priority);
    }
    
    /**
     * Speak with priority and overlapping voice management
     */
    speakWithPriority(text, priority = 'normal') {
        console.log(`Speaking (${priority}): ${text}`);
        
        try {
            // Cancel any pending speech cancellation
            if (this.speechCancellationTimer) {
                clearTimeout(this.speechCancellationTimer);
                this.speechCancellationTimer = null;
            }
            
            // Always cancel current speech before speaking new text
            // This prevents overlapping voices and ensures clear communication
            if (this.speechSynthesis.speaking || this.speechSynthesis.pending) {
                this.speechSynthesis.cancel();
                
                // Small delay to ensure cancellation completes
                setTimeout(() => {
                    this.performSpeech(text, priority);
                }, 100);
            } else {
                this.performSpeech(text, priority);
            }
            
        } catch (error) {
            console.error('Speech synthesis error:', error);
            this.handleSpeechError(text);
        }
    }
    
    /**
     * Perform the actual speech synthesis
     */
    performSpeech(text, priority = 'normal') {
        try {
            const utterance = new SpeechSynthesisUtterance(text);
            
            // Optimize speech settings for accessibility
            utterance.rate = 0.9; // Slightly slower for clarity
            utterance.volume = 1.0;
            utterance.pitch = 1.0;
            utterance.lang = 'en-US';
            
            // Set up event handlers
            utterance.onstart = () => {
                this.isSpeaking = true;
                this.errorStates.speechFailed = false;
                console.log('Speech started successfully');
            };
            
            utterance.onend = () => {
                this.isSpeaking = false;
                console.log('Speech ended normally');
            };
            
            utterance.onerror = (event) => {
                console.error('Speech synthesis error:', event.error);
                this.handleSpeechError(text);
            };
            
            // Store last utterance for reference
            this.lastUtterance = utterance;
            
            // Speak the text
            this.speechSynthesis.speak(utterance);
            
        } catch (error) {
            console.error('Speech creation error:', error);
            this.handleSpeechError(text);
        }
    }
    
    /**
     * Handle speech synthesis errors with fallback options
     */
    handleSpeechError(originalText) {
        this.errorStates.speechFailed = true;
        this.isSpeaking = false;
        
        console.error('Speech synthesis failed for text:', originalText);
        
        // Show the text in UI as fallback
        this.showTextInUI(originalText);
        
        // Try to reinitialize speech synthesis
        setTimeout(() => {
            if ('speechSynthesis' in window) {
                this.speechSynthesis = window.speechSynthesis;
                console.log('Speech synthesis reinitialized after error');
            }
        }, 1000);
    }
    
    /**
     * Show text in UI when speech fails
     */
    showTextInUI(text) {
        const textDisplay = document.getElementById('speechFallbackDisplay');
        if (textDisplay) {
            textDisplay.textContent = text;
            textDisplay.style.display = 'block';
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                textDisplay.style.display = 'none';
            }, 5000);
        }
    }
    
    /**
     * Speak error messages with special handling
     */
    speakErrorMessage(errorText) {
        // Use high priority for error messages
        this.speakWithPriority(errorText, 'high');
        
        // Also show in UI for redundancy
        this.showTextInUI(errorText);
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
    
    /**
     * Show navigation map in modal
     */
    showNavigationMap() {
        console.log('Showing navigation map');
        
        if (!this.currentRoute) {
            this.speak('No active route to display. Please start navigation first.', true);
            return;
        }
        
        // Initialize map in modal if not already done
        this.initializeMapModal();
        
        // Show the modal
        const mapModal = new bootstrap.Modal(document.getElementById('navigationMapModal'));
        mapModal.show();
        
        // Update route info
        const routeInfo = document.getElementById('routeInfo');
        if (routeInfo && this.currentRoute) {
            const totalDistance = this.currentRoute.legs[0].distance.text;
            const totalTime = this.currentRoute.legs[0].duration.text;
            const currentStep = this.currentStepIndex + 1;
            const totalSteps = this.currentRoute.legs[0].steps.length;
            
            routeInfo.textContent = `Step ${currentStep}/${totalSteps} • ${totalDistance} • ${totalTime}`;
        }
        
        this.speak('Navigation map is now displayed. Use the Resume Navigation button to continue.', true);
    }
    
    /**
     * Initialize map in modal
     */
    initializeMapModal() {
        if (this.modalMap) return; // Already initialized
        
        const mapContainer = document.getElementById('navigationMap');
        if (!mapContainer) return;
        
        // Create map with current location
        this.modalMap = new google.maps.Map(mapContainer, {
            zoom: 15,
            center: this.currentPosition ? 
                { lat: this.currentPosition.latitude, lng: this.currentPosition.longitude } :
                { lat: 0, lng: 0 },
            mapTypeId: google.maps.MapTypeId.ROADMAP
        });
        
        // Show current route
        if (this.currentRoute) {
            const directionsRenderer = new google.maps.DirectionsRenderer({
                directions: { routes: [this.currentRoute] },
                map: this.modalMap,
                suppressMarkers: false
            });
        }
        
        // Show current position
        if (this.currentPosition) {
            this.modalUserMarker = new google.maps.Marker({
                position: { lat: this.currentPosition.latitude, lng: this.currentPosition.longitude },
                map: this.modalMap,
                title: 'Your Current Location',
                icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="8" fill="#007bff" stroke="#fff" stroke-width="2"/></svg>'),
                    scaledSize: new google.maps.Size(20, 20)
                }
            });
        }
    }
    
    /**
     * Resume navigation from map modal
     */
    resumeNavigationFromMap() {
        console.log('Resuming navigation from map');
        
        // Close the modal
        const mapModal = bootstrap.Modal.getInstance(document.getElementById('navigationMapModal'));
        if (mapModal) {
            mapModal.hide();
        }
        
        this.speak('Navigation resumed. Continue following the voice instructions.', true);
    }
    
    /**
     * Test voice recognition functionality
     */
    testVoiceRecognition() {
        console.log('Testing voice recognition');
        
        this.speak('Voice recognition test starting. Please say something after the beep.', true);
        
        // Give a moment for the announcement to finish
        setTimeout(() => {
            if (!this.recognition) {
                this.speak('Voice recognition is not available on this device.', true);
                return;
            }
            
            // Test recognition
            const testRecognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
            testRecognition.continuous = false;
            testRecognition.interimResults = false;
            testRecognition.lang = 'en-US';
            
            testRecognition.onstart = () => {
                this.speak('Now listening. Say anything to test voice recognition.', true);
            };
            
            testRecognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                const confidence = event.results[0][0].confidence;
                
                console.log('Voice test result:', transcript, 'Confidence:', confidence);
                this.speak(`Voice recognition working. I heard: ${transcript}`, true);
            };
            
            testRecognition.onerror = (event) => {
                console.error('Voice test error:', event.error);
                let errorMessage = 'Voice recognition test failed.';
                
                switch (event.error) {
                    case 'not-allowed':
                        errorMessage = 'Microphone access denied. Please allow microphone access.';
                        break;
                    case 'no-speech':
                        errorMessage = 'No speech detected. Please try speaking clearly.';
                        break;
                    case 'audio-capture':
                        errorMessage = 'No microphone found. Please check your microphone.';
                        break;
                    case 'network':
                        errorMessage = 'Network error. Please check your internet connection.';
                        break;
                }
                
                this.speak(errorMessage, true);
            };
            
            testRecognition.onend = () => {
                console.log('Voice recognition test completed');
            };
            
            try {
                testRecognition.start();
            } catch (error) {
                console.error('Failed to start voice test:', error);
                this.speak('Failed to start voice recognition test. Please try again.', true);
            }
        }, 2000);
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