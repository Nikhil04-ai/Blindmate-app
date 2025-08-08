/**
 * BlindMate Navigation System
 * Advanced voice-controlled navigation with real-time GPS tracking, object detection, and automatic rerouting
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
        
        // Navigation configuration
        this.navigationConfig = {
            stepProximityThreshold: 15, // meters - when to announce next step
            routeDeviationThreshold: 20, // meters - when to trigger rerouting
            speedUpdateInterval: 2000, // ms - how often to check GPS position
            voicePreviewDistance: 200, // meters - when to announce "next step in X meters"
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
        
        // Predefined locations (expandable via API)
        this.locations = {
            'library': { lat: 26.4011, lng: 80.3023, name: 'Library' },
            'stairs': { lat: 26.4004, lng: 80.3018, name: 'Stairs' },
            'canteen': { lat: 26.3995, lng: 80.2997, name: 'Canteen' },
            'entrance': { lat: 26.4015, lng: 80.3025, name: 'Main Entrance' },
            'bathroom': { lat: 26.4008, lng: 80.3015, name: 'Bathroom' },
            'office': { lat: 26.4012, lng: 80.3020, name: 'Office' }
        };
        
        // Load saved locations from localStorage
        this.loadSavedLocations();
        
        // Initialize DOM elements
        this.initElements();
        
        // Initialize the system
        this.init();
    }
    
    /**
     * Initialize DOM elements
     */
    initElements() {
        this.elements = {
            webcam: document.getElementById('webcam'),
            canvas: document.getElementById('canvas'),
            mainButton: document.getElementById('mainButton'),
            statusText: document.getElementById('statusText'),
            instructionText: document.getElementById('instructionText'),
            detectionOverlay: document.getElementById('detectionOverlay'),
            navigationInfo: document.getElementById('navigationInfo'),
            currentStep: document.getElementById('currentStep'),
            stepDistance: document.getElementById('stepDistance'),
            emergencyStop: document.getElementById('emergencyStop'),
            systemStatus: document.getElementById('systemStatus'),
            navigationStatus: document.getElementById('navigationStatus')
        };
        
        // Create navigation UI elements if they don't exist
        this.createNavigationUI();
    }
    
    /**
     * Create enhanced navigation UI elements
     */
    createNavigationUI() {
        // Create step-by-step navigation display
        if (!document.getElementById('navigationDisplay')) {
            const navDisplay = document.createElement('div');
            navDisplay.id = 'navigationDisplay';
            navDisplay.className = 'navigation-display d-none';
            navDisplay.innerHTML = `
                <div class="card mt-3">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0">
                            <i class="fas fa-route"></i> Navigation Active
                        </h5>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-8">
                                <h6 class="text-muted">Current Step</h6>
                                <div id="currentInstruction" class="fs-5 fw-bold">Ready to navigate</div>
                                <div id="stepProgress" class="mt-2">
                                    <small class="text-muted">Step <span id="currentStepNum">0</span> of <span id="totalSteps">0</span></small>
                                </div>
                            </div>
                            <div class="col-md-4 text-end">
                                <div id="stepDistance" class="fs-4 fw-bold text-primary">--</div>
                                <small class="text-muted">Distance</small>
                            </div>
                        </div>
                        <div class="mt-3">
                            <div class="progress" style="height: 6px;">
                                <div id="routeProgress" class="progress-bar" role="progressbar" style="width: 0%"></div>
                            </div>
                        </div>
                        <button id="stopNavigation" class="btn btn-danger btn-sm mt-2">
                            <i class="fas fa-stop"></i> Stop Navigation
                        </button>
                    </div>
                </div>
            `;
            
            // Insert after control panel
            const controlPanel = document.querySelector('.col-lg-4');
            if (controlPanel) {
                controlPanel.appendChild(navDisplay);
            }
        }
        
        // Update element references
        this.elements.navigationDisplay = document.getElementById('navigationDisplay');
        this.elements.currentInstruction = document.getElementById('currentInstruction');
        this.elements.currentStepNum = document.getElementById('currentStepNum');
        this.elements.totalSteps = document.getElementById('totalSteps');
        this.elements.routeProgress = document.getElementById('routeProgress');
        this.elements.stopNavigation = document.getElementById('stopNavigation');
    }
    
    /**
     * Initialize the navigation system with comprehensive permission handling
     */
    async init() {
        this.updateStatus('Initializing BlindMate...', 'Requesting permissions and setting up the system');
        
        // First, request all necessary permissions together
        await this.requestAllPermissions();
        
        // Setup event listeners (this never fails)
        this.setupEventListeners();
        
        // Initialize speech recognition (this never fails)
        this.initSpeechRecognition();
        
        // Initialize webcam and object detection (with safe error handling)
        if (this.permissions.camera) {
            try {
                await this.initCamera();
                console.log('Camera initialization completed');
            } catch (error) {
                console.warn('Camera initialization failed, continuing without camera:', error.message);
                this.setupDummyVideo();
            }
        } else {
            this.setupDummyVideo();
        }
        
        // Load TensorFlow model (with safe error handling)
        try {
            await this.loadObjectDetectionModel();
            console.log('Object detection model loading completed');
        } catch (error) {
            console.warn('Object detection model failed to load, continuing without:', error.message);
        }
        
        // Initialize location services
        if (this.permissions.location) {
            this.initLocationServices();
        }
        
        // Complete initialization
        this.updateStatus('Ready to Navigate', 'Press the button or Volume Up key to start');
        
        // Announce readiness with permission status
        const permissionStatus = this.getPermissionStatusMessage();
        
        setTimeout(() => {
            this.speak(`BlindMate is ready. ${permissionStatus} Press the button to start navigation.`);
        }, 1000);
        
        console.log('BlindMate initialization completed successfully');
    }
    
    /**
     * Request all necessary permissions at startup
     */
    async requestAllPermissions() {
        const permissionRequests = [];
        
        // Request camera permission
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            this.permissions.camera = true;
            // Stop the stream immediately after permission is granted
            stream.getTracks().forEach(track => track.stop());
            console.log('Camera permission granted');
        } catch (error) {
            console.warn('Camera permission denied:', error.message);
            this.showPermissionError('camera', 'Camera access is needed for obstacle detection during navigation. Please enable camera access in your browser settings.');
        }
        
        // Request microphone permission
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.permissions.microphone = true;
            // Stop the stream immediately after permission is granted
            stream.getTracks().forEach(track => track.stop());
            console.log('Microphone permission granted');
        } catch (error) {
            console.warn('Microphone permission denied:', error.message);
            this.showPermissionError('microphone', 'Microphone access is required for voice commands. Please enable microphone access in your browser settings.');
        }
        
        // Request location permission
        try {
            await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        this.permissions.location = true;
                        console.log('Location permission granted');
                        resolve(position);
                    },
                    (error) => {
                        console.warn('Location permission denied:', error.message);
                        this.showPermissionError('location', 'Location access is essential for navigation. Please enable location services in your browser settings.');
                        reject(error);
                    },
                    { timeout: 10000 }
                );
            });
        } catch (error) {
            // Location permission denied is handled above
        }
    }
    
    /**
     * Show permission error with voice and visual feedback
     */
    showPermissionError(permissionType, message) {
        const errorElement = document.getElementById('error-message');
        const errorText = document.getElementById('errorText');
        
        if (errorElement && errorText) {
            errorText.textContent = message;
            errorElement.style.display = 'block';
            
            // Auto-hide after 10 seconds
            setTimeout(() => {
                errorElement.style.display = 'none';
            }, 10000);
        }
        
        // Voice announcement
        this.speak(`Permission required: ${message}`, 'high');
    }
    
    /**
     * Get permission status message for voice announcement
     */
    getPermissionStatusMessage() {
        const granted = [];
        const denied = [];
        
        if (this.permissions.camera) granted.push('camera');
        else denied.push('camera');
        
        if (this.permissions.microphone) granted.push('microphone');
        else denied.push('microphone');
        
        if (this.permissions.location) granted.push('location');
        else denied.push('location');
        
        let message = '';
        
        if (granted.length === 3) {
            message = 'All permissions granted. Full navigation and detection features available.';
        } else if (granted.length > 0) {
            message = `${granted.join(' and ')} access granted.`;
            if (denied.length > 0) {
                message += ` ${denied.join(' and ')} access needed for full functionality.`;
            }
        } else {
            message = 'Limited functionality. Please enable permissions for full navigation features.';
        }
        
        return message;
    }
    
    /**
     * Initialize location services for GPS tracking
     */
    initLocationServices() {
        if (!navigator.geolocation) {
            console.warn('Geolocation not supported');
            return;
        }
        
        // Test location access
        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.currentPosition = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                };
                console.log('Initial position obtained:', this.currentPosition);
            },
            (error) => {
                console.error('Error getting initial position:', error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Main button click
        this.elements.mainButton.addEventListener('click', () => this.handleMainButtonClick());
        
        // Emergency stop button
        this.elements.emergencyStop.addEventListener('click', () => this.emergencyStop());
        
        // Volume key detection for accessibility
        document.addEventListener('keydown', (e) => {
            if (e.key === 'VolumeUp' || e.keyCode === 175) {
                e.preventDefault();
                this.handleMainButtonClick();
            }
            // Space bar as alternative
            if (e.code === 'Space' && !this.isNavigating) {
                e.preventDefault();
                this.handleMainButtonClick();
            }
            // Escape key for emergency stop
            if (e.key === 'Escape') {
                this.emergencyStop();
            }
        });
        
        // Prevent accidental page navigation
        window.addEventListener('beforeunload', (e) => {
            if (this.isNavigating) {
                e.preventDefault();
                e.returnValue = 'Navigation is in progress. Are you sure you want to leave?';
            }
        });
    }
    
    /**
     * Handle main button click based on current state
     */
    handleMainButtonClick() {
        switch (this.currentState) {
            case 'idle':
                this.startListening();
                break;
            case 'listening':
                this.stopListening();
                break;
            case 'navigating':
                this.showNavigationOptions();
                break;
            default:
                this.resetToIdle();
        }
    }
    
    /**
     * Start listening for voice commands
     */
    startListening() {
        if (!this.recognition) {
            this.speak('Speech recognition is not available in your browser.');
            return;
        }
        
        this.currentState = 'listening';
        this.updateButtonState();
        this.updateStatus('Listening...', 'Say "Go to [place name]" or "Navigate to [location]"');
        this.speak('I\'m listening. Where would you like to go?');
        
        try {
            this.recognition.start();
        } catch (error) {
            console.error('Speech recognition error:', error);
            this.resetToIdle();
        }
    }
    
    /**
     * Stop listening
     */
    stopListening() {
        if (this.recognition) {
            this.recognition.stop();
        }
        this.resetToIdle();
    }
    
    /**
     * Initialize webcam with fallback handling
     */
    async initCamera() {
        try {
            // Check if getUserMedia is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.warn('Camera API not supported, navigation will work without object detection');
                this.setupDummyVideo();
                return;
            }

            // Try different camera configurations
            const videoConfigs = [
                // Prefer back camera on mobile
                {
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        facingMode: 'environment'
                    }
                },
                // Fallback to any camera
                {
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 }
                    }
                },
                // Minimal requirements
                {
                    video: true
                }
            ];

            let stream = null;
            for (const config of videoConfigs) {
                try {
                    stream = await navigator.mediaDevices.getUserMedia(config);
                    break;
                } catch (e) {
                    console.warn('Camera config failed, trying next:', e.message);
                }
            }

            if (!stream) {
                throw new Error('No camera configuration worked');
            }
            
            this.elements.webcam.srcObject = stream;
            
            // Wait for video to load
            return new Promise((resolve) => {
                this.elements.webcam.onloadedmetadata = () => {
                    // Setup canvas for object detection overlay
                    const ctx = this.elements.canvas.getContext('2d');
                    this.elements.canvas.width = this.elements.webcam.videoWidth || 640;
                    this.elements.canvas.height = this.elements.webcam.videoHeight || 480;
                    console.log('Camera initialized successfully');
                    resolve();
                };
                
                // Timeout in case metadata never loads
                setTimeout(() => {
                    console.warn('Camera metadata timeout, continuing anyway');
                    resolve();
                }, 5000);
            });
            
        } catch (error) {
            console.warn('Camera initialization failed:', error.message);
            
            // Always setup dummy video and never throw
            this.setupDummyVideo();
            
            // Don't speak here, let the main init handle it
            return Promise.resolve();
        }
    }

    /**
     * Setup dummy video element when camera is not available
     */
    setupDummyVideo() {
        // Create a black canvas as placeholder
        const ctx = this.elements.canvas.getContext('2d');
        this.elements.canvas.width = 640;
        this.elements.canvas.height = 480;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 640, 480);
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Camera not available', 320, 240);
        ctx.fillText('Navigation works without camera', 320, 270);
        
        // Hide webcam element
        this.elements.webcam.style.display = 'none';
    }
    
    /**
     * Load TensorFlow COCO-SSD model for object detection
     */
    async loadObjectDetectionModel() {
        try {
            this.updateStatus('Loading AI Model...', 'Setting up object detection');
            
            // Check if TensorFlow.js and COCO-SSD are available
            if (typeof tf === 'undefined' || typeof cocoSsd === 'undefined') {
                console.warn('TensorFlow.js or COCO-SSD not loaded, skipping object detection');
                return;
            }
            
            this.model = await cocoSsd.load();
            console.log('COCO-SSD model loaded successfully');
        } catch (error) {
            console.warn('Model loading failed:', error.message);
            // Continue without object detection if model fails to load
            this.model = null;
        }
    }
    
    /**
     * Initialize speech recognition
     */
    initSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Speech recognition not supported');
            return;
        }
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';
        
        this.recognition.onresult = (event) => {
            const command = event.results[0][0].transcript.toLowerCase().trim();
            console.log('Voice command received:', command);
            this.processVoiceCommand(command);
        };
        
        this.recognition.onend = () => {
            if (this.currentState === 'listening') {
                this.resetToIdle();
            }
        };
        
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.speak('Sorry, I couldn\'t understand you. Please try again.');
            this.resetToIdle();
        };
    }
    
    /**
     * Process voice commands and extract destination
     */
    processVoiceCommand(command) {
        console.log('Processing command:', command);
        
        // Extract destination from various command patterns
        let destination = null;
        
        const patterns = [
            /(?:go to|navigate to|take me to|find|locate)\s+(?:the\s+)?(.+)/i,
            /(?:where is|show me)\s+(?:the\s+)?(.+)/i,
            /(.+)$/i // Fallback: just the location name
        ];
        
        for (const pattern of patterns) {
            const match = command.match(pattern);
            if (match) {
                destination = match[1].trim();
                break;
            }
        }
        
        if (destination) {
            this.confirmNavigation(destination);
        } else {
            this.speak('I didn\'t understand the destination. Please try saying "Go to library" or "Navigate to canteen".', 'high');
            this.resetToIdle();
        }
    }
    
    /**
     * Confirm navigation to destination with enhanced voice confirmation
     */
    confirmNavigation(destination) {
        // First try to find a predefined location
        let location = this.findLocation(destination);
        
        if (!location) {
            // If not found in predefined locations, treat as address for Google Maps
            location = {
                name: destination,
                address: destination,
                isGoogleMapsQuery: true
            };
        }
        
        this.currentDestination = location;
        this.currentState = 'confirming';
        this.updateStatus('Confirm Navigation', `Navigate to ${location.name}?`);
        
        // Ask for confirmation with clear yes/no prompt
        this.speak(`Should I start navigation to ${location.name}? Say yes to confirm or no to cancel.`, 'high');
        
        // Set up confirmation listener
        this.setupConfirmationListener();
    }
    
    /**
     * Set up enhanced confirmation listener with timeout
     */
    setupConfirmationListener() {
        if (!this.recognition) {
            this.speak('Voice recognition not available. Navigation cancelled.', 'high');
            this.resetToIdle();
            return;
        }
        
        // Create separate recognition instance for confirmation
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.confirmationRecognition = new SpeechRecognition();
        
        this.confirmationRecognition.continuous = false;
        this.confirmationRecognition.interimResults = false;
        this.confirmationRecognition.lang = 'en-US';
        
        // Set up confirmation response handler
        this.confirmationRecognition.onresult = (event) => {
            const response = event.results[0][0].transcript.toLowerCase().trim();
            console.log('Confirmation response:', response);
            
            // Check for positive confirmation
            if (response.includes('yes') || response.includes('yeah') || 
                response.includes('confirm') || response.includes('start') ||
                response.includes('okay') || response.includes('ok')) {
                this.startNavigation();
            } 
            // Check for negative confirmation
            else if (response.includes('no') || response.includes('cancel') || 
                     response.includes('stop') || response.includes('never mind')) {
                this.speak('Navigation cancelled.', 'normal');
                this.resetToIdle();
            } 
            // Unclear response
            else {
                this.speak('Please say yes to start navigation or no to cancel.', 'high');
                // Try again with a shorter timeout
                setTimeout(() => {
                    if (this.currentState === 'confirming') {
                        this.setupConfirmationListener();
                    }
                }, 2000);
            }
        };
        
        this.confirmationRecognition.onerror = (event) => {
            console.error('Confirmation recognition error:', event.error);
            this.speak('I didn\'t hear you clearly. Please say yes or no.', 'high');
            
            // Retry confirmation
            setTimeout(() => {
                if (this.currentState === 'confirming') {
                    this.setupConfirmationListener();
                }
            }, 2000);
        };
        
        this.confirmationRecognition.onend = () => {
            // If still in confirming state after recognition ends, timeout
            if (this.currentState === 'confirming') {
                setTimeout(() => {
                    if (this.currentState === 'confirming') {
                        this.speak('No response received. Navigation cancelled.', 'normal');
                        this.resetToIdle();
                    }
                }, 1000);
            }
        };
        
        // Start listening for confirmation
        try {
            this.confirmationRecognition.start();
        } catch (error) {
            console.error('Error starting confirmation recognition:', error);
            this.speak('Voice confirmation failed. Navigation cancelled.', 'high');
            this.resetToIdle();
        }
        
        // Set timeout for confirmation
        setTimeout(() => {
            if (this.currentState === 'confirming' && this.confirmationRecognition) {
                this.confirmationRecognition.stop();
                this.speak('Confirmation timeout. Navigation cancelled.', 'normal');
                this.resetToIdle();
            }
        }, 10000); // 10 second timeout
    }
    
    /**
     * Start navigation with GPS tracking and step-by-step guidance
     */
    async startNavigation() {
        try {
            this.currentState = 'navigating';
            this.isNavigating = true;
            this.currentStepIndex = 0;
            this.rerouteAttempts = 0;
            this.nextStepAnnounced = false;
            
            this.updateStatus('Starting Navigation', 'Getting directions...');
            this.speak('Starting navigation. Getting directions...', 'high');
            
            // Show navigation UI
            if (this.elements.navigationDisplay) {
                this.elements.navigationDisplay.classList.remove('d-none');
            }
            
            // Get current position
            const currentPosition = await this.getCurrentPosition();
            
            if (!currentPosition) {
                throw new Error('Unable to get current location');
            }
            
            // Get directions from backend
            const directions = await this.getDirections(currentPosition, this.currentDestination);
            
            if (!directions || !directions.steps || directions.steps.length === 0) {
                throw new Error('No directions found');
            }
            
            this.currentRoute = directions;
            
            // Update UI with route information
            this.updateNavigationUI();
            
            // Start GPS tracking for live updates
            this.startLocationTracking();
            
            // Start object detection during navigation
            this.startNavigationDetection();
            
            // Announce first step
            this.announceCurrentStep();
            
            // Setup emergency stop button
            if (this.elements.stopNavigation) {
                this.elements.stopNavigation.onclick = () => this.stopNavigation();
            }
            
            this.speak(`Navigation started to ${this.currentDestination.name}. Total distance: ${directions.total_distance}. Estimated time: ${directions.total_duration}.`, 'high');
            
        } catch (error) {
            console.error('Navigation start error:', error);
            this.speak(`Navigation failed: ${error.message}. Please try again.`, 'high');
            this.resetToIdle();
        }
    }
    
    /**
     * Get current position with high accuracy
     */
    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const currentPos = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    this.currentPosition = currentPos;
                    this.positionAccuracy = position.coords.accuracy;
                    console.log('Current position:', currentPos, 'Accuracy:', this.positionAccuracy, 'meters');
                    resolve(currentPos);
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    reject(new Error(`Location access failed: ${error.message}`));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 30000
                }
            );
        });
    }
    
    /**
     * Get directions from backend API
     */
    async getDirections(origin, destination) {
        try {
            let destinationQuery = destination.address || `${destination.lat},${destination.lng}`;
            
            // If it's a Google Maps query, use the name/address
            if (destination.isGoogleMapsQuery) {
                destinationQuery = destination.name;
            }
            
            const originQuery = `${origin.lat},${origin.lng}`;
            
            console.log('Getting directions from:', originQuery, 'to:', destinationQuery);
            
            const response = await fetch('/api/directions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    origin: originQuery,
                    destination: destinationQuery,
                    mode: 'walking'
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get directions');
            }
            
            const directions = await response.json();
            console.log('Directions received:', directions);
            
            return directions;
            
        } catch (error) {
            console.error('Directions API error:', error);
            throw new Error(`Unable to get directions: ${error.message}`);
        }
    }
    
    /**
     * Start continuous location tracking during navigation
     */
    startLocationTracking() {
        if (!navigator.geolocation) {
            console.warn('Geolocation not available for tracking');
            return;
        }
        
        this.isTrackingPosition = true;
        
        // Use watchPosition for continuous updates
        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.handlePositionUpdate(position);
            },
            (error) => {
                console.error('Position tracking error:', error);
                // Continue tracking despite errors
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 5000
            }
        );
        
        console.log('Started GPS tracking with watchId:', this.watchId);
    }
    
    /**
     * Handle position updates during navigation
     */
    handlePositionUpdate(position) {
        const newPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
        };
        
        // Store previous position
        this.lastKnownPosition = this.currentPosition;
        this.currentPosition = newPosition;
        this.positionAccuracy = position.coords.accuracy;
        
        console.log('Position update:', newPosition, 'Accuracy:', position.coords.accuracy);
        
        if (!this.isNavigating || !this.currentRoute) {
            return;
        }
        
        // Check if we're close to the next step
        this.checkStepProximity();
        
        // Check if we've deviated from the route
        this.checkRouteDeviation();
        
        // Update UI with current position
        this.updateNavigationProgress();
    }
    
    /**
     * Check if user is close to the next navigation step
     */
    checkStepProximity() {
        if (!this.currentRoute || !this.currentRoute.steps || 
            this.currentStepIndex >= this.currentRoute.steps.length) {
            return;
        }
        
        const currentStep = this.currentRoute.steps[this.currentStepIndex];
        const nextStepIndex = this.currentStepIndex + 1;
        
        // Calculate distance to current step's end location
        const distanceToStepEnd = this.calculateDistance(
            this.currentPosition,
            currentStep.end_location
        );
        
        console.log(`Distance to current step end: ${distanceToStepEnd}m`);
        
        // If within proximity threshold, advance to next step
        if (distanceToStepEnd <= this.navigationConfig.stepProximityThreshold) {
            this.advanceToNextStep();
        }
        // If we have a next step and we're within preview distance, announce it
        else if (nextStepIndex < this.currentRoute.steps.length && !this.nextStepAnnounced) {
            const nextStep = this.currentRoute.steps[nextStepIndex];
            const distanceToNextStep = this.calculateDistance(
                this.currentPosition,
                nextStep.start_location
            );
            
            if (distanceToNextStep <= this.navigationConfig.voicePreviewDistance) {
                this.announceNextStep(nextStep);
                this.nextStepAnnounced = true;
            }
        }
    }
    
    /**
     * Advance to the next navigation step
     */
    advanceToNextStep() {
        this.currentStepIndex++;
        this.nextStepAnnounced = false;
        
        if (this.currentStepIndex >= this.currentRoute.steps.length) {
            // Navigation completed
            this.completeNavigation();
            return;
        }
        
        // Update UI and announce new step
        this.updateNavigationUI();
        this.announceCurrentStep();
    }
    
    /**
     * Announce the current navigation step
     */
    announceCurrentStep() {
        if (!this.currentRoute || !this.currentRoute.steps || 
            this.currentStepIndex >= this.currentRoute.steps.length) {
            return;
        }
        
        const step = this.currentRoute.steps[this.currentStepIndex];
        const instruction = step.instruction;
        const distance = step.distance;
        
        this.speak(`${instruction}. Distance: ${distance}.`, 'high');
        console.log('Announced step:', instruction);
    }
    
    /**
     * Announce the next navigation step as preview
     */
    announceNextStep(nextStep) {
        const instruction = nextStep.instruction;
        this.speak(`Next step: ${instruction} in 200 meters.`, 'normal');
        console.log('Announced next step preview:', instruction);
    }
    
    /**
     * Check if user has deviated from the planned route
     */
    checkRouteDeviation() {
        if (!this.currentRoute || !this.currentRoute.steps || 
            this.currentStepIndex >= this.currentRoute.steps.length) {
            return;
        }
        
        const currentStep = this.currentRoute.steps[this.currentStepIndex];
        
        // Calculate distance to the route path (simplified as distance to step start/end)
        const distanceToStepStart = this.calculateDistance(
            this.currentPosition,
            currentStep.start_location
        );
        
        const distanceToStepEnd = this.calculateDistance(
            this.currentPosition,
            currentStep.end_location
        );
        
        // Use the minimum distance to either start or end of step
        const routeDeviation = Math.min(distanceToStepStart, distanceToStepEnd);
        
        console.log(`Route deviation: ${routeDeviation}m (threshold: ${this.navigationConfig.routeDeviationThreshold}m)`);
        
        // If deviation exceeds threshold, trigger rerouting
        if (routeDeviation > this.navigationConfig.routeDeviationThreshold && 
            this.rerouteAttempts < this.navigationConfig.rerouteRetryLimit) {
            
            this.triggerRerouting();
        }
    }
    
    /**
     * Trigger automatic rerouting
     */
    async triggerRerouting() {
        if (this.currentState === 'rerouting') {
            return; // Already rerouting
        }
        
        this.currentState = 'rerouting';
        this.rerouteAttempts++;
        
        console.log(`Triggering reroute attempt ${this.rerouteAttempts}`);
        
        this.speak('You seem to be off route. Calculating new directions...', 'high');
        this.updateStatus('Rerouting', 'Calculating new path...');
        
        try {
            // Get new directions from current position
            const newDirections = await this.getDirections(this.currentPosition, this.currentDestination);
            
            if (newDirections && newDirections.steps && newDirections.steps.length > 0) {
                // Update route and reset step index
                this.currentRoute = newDirections;
                this.currentStepIndex = 0;
                this.nextStepAnnounced = false;
                
                // Update UI
                this.updateNavigationUI();
                
                // Announce new route
                this.speak(`New route calculated. ${newDirections.steps[0].instruction}. Distance: ${newDirections.steps[0].distance}.`, 'high');
                
                // Return to navigating state
                this.currentState = 'navigating';
                this.updateStatus('Navigating', 'Following new route');
                
                console.log('Rerouting successful');
            } else {
                throw new Error('Failed to get new directions');
            }
            
        } catch (error) {
            console.error('Rerouting failed:', error);
            this.speak('Rerouting failed. Continuing with original route.', 'normal');
            this.currentState = 'navigating';
        }
    }
    
    /**
     * Calculate distance between two points using Haversine formula
     */
    calculateDistance(pos1, pos2) {
        const R = 6371000; // Earth's radius in meters
        const dLat = this.degToRad(pos2.lat - pos1.lat);
        const dLon = this.degToRad(pos2.lng - pos1.lng);
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(this.degToRad(pos1.lat)) * Math.cos(this.degToRad(pos2.lat)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        
        return Math.round(distance);
    }
    
    /**
     * Convert degrees to radians
     */
    degToRad(deg) {
        return deg * (Math.PI / 180);
    }
    
    /**
     * Update navigation UI with current progress
     */
    updateNavigationUI() {
        if (!this.currentRoute || !this.elements.currentInstruction) {
            return;
        }
        
        const totalSteps = this.currentRoute.steps.length;
        const currentStepNumber = this.currentStepIndex + 1;
        
        if (this.currentStepIndex < totalSteps) {
            const currentStep = this.currentRoute.steps[this.currentStepIndex];
            
            // Update current instruction
            this.elements.currentInstruction.textContent = currentStep.instruction;
            
            // Update step progress
            if (this.elements.currentStepNum) {
                this.elements.currentStepNum.textContent = currentStepNumber;
            }
            if (this.elements.totalSteps) {
                this.elements.totalSteps.textContent = totalSteps;
            }
            
            // Update distance
            if (this.elements.stepDistance) {
                this.elements.stepDistance.textContent = currentStep.distance;
            }
            
            // Update progress bar
            if (this.elements.routeProgress) {
                const progressPercent = (currentStepNumber / totalSteps) * 100;
                this.elements.routeProgress.style.width = `${progressPercent}%`;
            }
        }
    }
    
    /**
     * Update navigation progress based on current position
     */
    updateNavigationProgress() {
        // This method can be used for real-time distance updates
        // For now, we'll keep the basic UI updates in updateNavigationUI
        if (this.elements.navigationStatus) {
            this.elements.navigationStatus.textContent = 'Active';
            this.elements.navigationStatus.className = 'badge bg-success';
        }
    }
    
    /**
     * Complete navigation when destination is reached
     */
    completeNavigation() {
        this.speak(`You have arrived at ${this.currentDestination.name}. Navigation completed.`, 'high');
        
        // Stop location tracking
        this.stopLocationTracking();
        
        // Stop object detection
        this.stopNavigationDetection();
        
        // Hide navigation UI
        if (this.elements.navigationDisplay) {
            this.elements.navigationDisplay.classList.add('d-none');
        }
        
        // Reset navigation state
        this.resetToIdle();
        
        this.updateStatus('Navigation Complete', `Arrived at ${this.currentDestination.name}`);
        
        console.log('Navigation completed successfully');
    }
    
    /**
     * Stop navigation manually
     */
    stopNavigation() {
        this.speak('Navigation stopped.', 'normal');
        
        // Stop location tracking
        this.stopLocationTracking();
        
        // Stop object detection
        this.stopNavigationDetection();
        
        // Hide navigation UI
        if (this.elements.navigationDisplay) {
            this.elements.navigationDisplay.classList.add('d-none');
        }
        
        // Reset state
        this.resetToIdle();
        
        this.updateStatus('Navigation Stopped', 'Ready for new navigation');
        
        console.log('Navigation stopped by user');
    }
    
    /**
     * Stop location tracking
     */
    stopLocationTracking() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
            this.isTrackingPosition = false;
            console.log('Stopped GPS tracking');
        }
    }
    
    /**
     * Start object detection during navigation for obstacle alerts
     */
    startNavigationDetection() {
        if (!this.model || !this.permissions.camera) {
            console.log('Object detection not available during navigation');
            return;
        }
        
        this.obstacleDetectionEnabled = true;
        this.isDetecting = true;
        this.detectionInterval = 1500; // Faster detection during navigation
        
        console.log('Started obstacle detection during navigation');
        
        // Start continuous detection
        this.runObjectDetection();
    }
    
    /**
     * Stop object detection during navigation
     */
    stopNavigationDetection() {
        this.obstacleDetectionEnabled = false;
        this.isDetecting = false;
        console.log('Stopped obstacle detection');
    }
    
    /**
     * Run object detection continuously during navigation
     */
    async runObjectDetection() {
        if (!this.isDetecting || !this.model || !this.elements.webcam) {
            return;
        }
        
        try {
            const video = this.elements.webcam;
            if (video.readyState !== video.HAVE_ENOUGH_DATA) {
                setTimeout(() => this.runObjectDetection(), 100);
                return;
            }
            
            // Detect objects in the video feed
            const predictions = await this.model.detect(video);
            
            // Filter and process obstacle predictions
            if (this.obstacleDetectionEnabled && this.isNavigating) {
                this.processObstacleDetections(predictions);
            }
            
            // Draw detection overlay on canvas
            this.drawDetections(predictions);
            
        } catch (error) {
            console.error('Object detection error:', error);
        }
        
        // Continue detection if still enabled
        if (this.isDetecting) {
            setTimeout(() => this.runObjectDetection(), this.detectionInterval);
        }
    }
    
    /**
     * Process object detections for obstacle alerts during navigation
     */
    processObstacleDetections(predictions) {
        const currentTime = Date.now();
        
        // Filter for potential obstacles with high confidence
        const obstacles = predictions.filter(pred => 
            pred.score >= this.navigationConfig.obstacleDetectionSensitivity &&
            this.isObstacleClass(pred.class)
        );
        
        if (obstacles.length === 0) {
            return;
        }
        
        // Check if enough time has passed since last obstacle announcement
        if (currentTime - this.lastDetectionTime < 3000) {
            return;
        }
        
        // Find the most prominent obstacle (highest score or largest area)
        const primaryObstacle = obstacles.reduce((max, obstacle) => {
            const area = (obstacle.bbox[2] - obstacle.bbox[0]) * (obstacle.bbox[3] - obstacle.bbox[1]);
            const maxArea = (max.bbox[2] - max.bbox[0]) * (max.bbox[3] - max.bbox[1]);
            return area > maxArea ? obstacle : max;
        });
        
        // Announce obstacle without interrupting navigation instructions
        this.announceObstacle(primaryObstacle);
        this.lastDetectionTime = currentTime;
    }
    
    /**
     * Check if detected class is considered an obstacle
     */
    isObstacleClass(className) {
        const obstacleClasses = [
            'person', 'bicycle', 'car', 'motorcycle', 'bus', 'truck',
            'traffic light', 'fire hydrant', 'stop sign', 'bench',
            'chair', 'dining table', 'potted plant', 'dog', 'cat'
        ];
        
        return obstacleClasses.includes(className.toLowerCase());
    }
    
    /**
     * Announce detected obstacle without interrupting navigation
     */
    announceObstacle(obstacle) {
        const obstacleType = obstacle.class.toLowerCase();
        let position = 'ahead';
        
        // Determine position based on bounding box
        const centerX = (obstacle.bbox[0] + obstacle.bbox[2]) / 2;
        const canvasWidth = this.elements.canvas.width || 640;
        
        if (centerX < canvasWidth * 0.3) {
            position = 'on the left';
        } else if (centerX > canvasWidth * 0.7) {
            position = 'on the right';
        }
        
        // Use lower priority for obstacle announcements to not interrupt navigation
        this.speak(`Obstacle ${position}: ${obstacleType}`, 'normal');
        console.log(`Announced obstacle: ${obstacleType} ${position}`);
    }
    
    /**
     * Draw detection overlay on canvas
     */
    drawDetections(predictions) {
        if (!this.elements.canvas || !predictions) {
            return;
        }
        
        const canvas = this.elements.canvas;
        const ctx = canvas.getContext('2d');
        
        // Clear previous drawings
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw bounding boxes for detected objects
        predictions.forEach(prediction => {
            if (prediction.score < 0.5) return;
            
            const [x, y, width, height] = prediction.bbox;
            
            // Choose color based on object type
            const isObstacle = this.isObstacleClass(prediction.class);
            ctx.strokeStyle = isObstacle ? '#FF6B6B' : '#4ECDC4';
            ctx.lineWidth = isObstacle ? 3 : 2;
            ctx.fillStyle = isObstacle ? 'rgba(255, 107, 107, 0.2)' : 'rgba(78, 205, 196, 0.2)';
            
            // Draw bounding box
            ctx.fillRect(x, y, width, height);
            ctx.strokeRect(x, y, width, height);
            
            // Draw label
            ctx.font = '16px Arial';
            ctx.fillStyle = isObstacle ? '#FF6B6B' : '#4ECDC4';
            const label = `${prediction.class} (${Math.round(prediction.score * 100)}%)`;
            
            // Label background
            const textWidth = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(x, y - 25, textWidth + 10, 20);
            
            // Label text
            ctx.fillStyle = 'white';
            ctx.fillText(label, x + 5, y - 10);
        });
    }
    
    /**
     * Enhanced speech synthesis with priority queue management
     */
    speak(text, priority = 'normal') {
        if (!text || text.trim() === '') return;
        
        console.log(`Speaking (${priority}): ${text}`);
        
        // Handle priority-based speech queue
        const speechItem = {
            text: text.trim(),
            priority: priority,
            timestamp: Date.now()
        };
        
        // For high priority or emergency messages, interrupt current speech
        if (priority === 'high' || priority === 'emergency') {
            this.synthesis.cancel();
            this.speechQueue = []; // Clear queue for urgent messages
            this.isSpeaking = false;
        }
        
        // Add to queue
        this.speechQueue.push(speechItem);
        
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
        const priorityOrder = { 'emergency': 4, 'high': 3, 'normal': 2, 'low': 1 };
        this.speechQueue.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
        
        const speechItem = this.speechQueue.shift();
        
        if (!speechItem) return;
        
        this.isSpeaking = true;
        
        const utterance = new SpeechSynthesisUtterance(speechItem.text);
        utterance.rate = speechItem.priority === 'emergency' ? 1.2 : 1.0;
        utterance.volume = speechItem.priority === 'emergency' ? 1.0 : 0.8;
        
        utterance.onend = () => {
            this.isSpeaking = false;
            // Process next item in queue after a short delay
            setTimeout(() => this.processSpeechQueue(), 500);
        };
        
        utterance.onerror = (error) => {
            console.error('Speech synthesis error:', error);
            this.isSpeaking = false;
            // Continue with next item despite error
            setTimeout(() => this.processSpeechQueue(), 500);
        };
        
        this.synthesis.speak(utterance);
    }
    
    /**
     * Find location from predefined locations or saved locations
     */
    findLocation(destination) {
        const searchTerm = destination.toLowerCase().trim();
        
        // Search in predefined locations
        for (const [key, location] of Object.entries(this.locations)) {
            if (key.toLowerCase().includes(searchTerm) || 
                location.name.toLowerCase().includes(searchTerm)) {
                return location;
            }
        }
        
        // Search in saved locations from localStorage
        const savedLocations = this.getSavedLocations();
        for (const location of savedLocations) {
            if (location.name.toLowerCase().includes(searchTerm)) {
                return location;
            }
        }
        
        return null;
    }
    
    /**
     * Load saved locations from localStorage
     */
    loadSavedLocations() {
        try {
            const saved = localStorage.getItem('blindmate_saved_locations');
            if (saved) {
                const savedLocations = JSON.parse(saved);
                // Merge with predefined locations
                Object.assign(this.locations, savedLocations);
                console.log('Loaded saved locations:', savedLocations);
            }
        } catch (error) {
            console.error('Error loading saved locations:', error);
        }
    }
    
    /**
     * Get saved locations from localStorage
     */
    getSavedLocations() {
        try {
            const saved = localStorage.getItem('blindmate_saved_locations');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Error getting saved locations:', error);
            return [];
        }
    }
    
    /**
     * Save a new location to localStorage
     */
    saveLocation(name, position) {
        try {
            const savedLocations = this.getSavedLocations();
            const newLocation = {
                lat: position.lat,
                lng: position.lng,
                name: name,
                savedAt: new Date().toISOString()
            };
            
            savedLocations.push(newLocation);
            localStorage.setItem('blindmate_saved_locations', JSON.stringify(savedLocations));
            
            // Also add to current locations
            this.locations[name.toLowerCase().replace(/\s+/g, '_')] = newLocation;
            
            console.log('Saved location:', newLocation);
            return true;
        } catch (error) {
            console.error('Error saving location:', error);
            return false;
        }
    }
    
    /**
     * Update status display
     */
    updateStatus(mainText, subText = '') {
        if (this.elements.systemStatus) {
            this.elements.systemStatus.innerHTML = `
                <i class="fas fa-info-circle" aria-hidden="true"></i>
                ${mainText}
            `;
        }
        
        if (this.elements.statusText) {
            this.elements.statusText.textContent = subText || mainText;
        }
        
        console.log('Status update:', mainText, subText);
    }
    
    /**
     * Update button state based on current mode
     */
    updateButtonState() {
        // This method can be enhanced to update button text/appearance
        // based on current navigation state
        const button = this.elements.mainButton;
        if (!button) return;
        
        switch (this.currentState) {
            case 'listening':
                button.textContent = 'Listening... (Click to stop)';
                button.className = 'btn btn-warning btn-lg';
                break;
            case 'confirming':
                button.textContent = 'Confirming...';
                button.className = 'btn btn-info btn-lg';
                break;
            case 'navigating':
                button.textContent = 'Navigating... (Click for options)';
                button.className = 'btn btn-success btn-lg';
                break;
            default:
                button.textContent = 'Start Navigation';
                button.className = 'btn btn-primary btn-lg';
        }
    }
    
    /**
     * Reset to idle state
     */
    resetToIdle() {
        this.currentState = 'idle';
        this.isNavigating = false;
        this.currentRoute = null;
        this.currentStepIndex = 0;
        this.currentDestination = null;
        this.nextStepAnnounced = false;
        
        // Stop any ongoing processes
        if (this.recognition) {
            this.recognition.stop();
        }
        if (this.confirmationRecognition) {
            this.confirmationRecognition.stop();
        }
        
        this.updateButtonState();
        this.updateStatus('Ready to Navigate', 'Press button or say "Go to [destination]"');
        
        // Update navigation status
        if (this.elements.navigationStatus) {
            this.elements.navigationStatus.textContent = 'Ready';
            this.elements.navigationStatus.className = 'badge bg-secondary';
        }
    }
    
    /**
     * Show navigation options during active navigation
     */
    showNavigationOptions() {
        this.speak('Navigation options: Say stop navigation to end, or continue following current route.', 'normal');
    }
    
    /**
     * Emergency stop function
     */
    emergencyStop() {
        console.log('Emergency stop activated');
        
        // Stop all ongoing processes immediately
        this.synthesis.cancel();
        this.speechQueue = [];
        
        if (this.isNavigating) {
            this.stopNavigation();
        }
        
        // Emergency announcement
        this.speak('Emergency stop activated. All navigation stopped.', 'emergency');
        
        // Reset to safe state
        this.resetToIdle();
        this.updateStatus('Emergency Stop', 'System stopped - Ready to restart');
    }
}

// Initialize the navigation system when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing BlindMate Navigation System...');
    window.blindMateNavigation = new BlindMateNavigation();
});
