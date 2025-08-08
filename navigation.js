/**
 * BlindMate Navigation System
 * Comprehensive voice-controlled navigation with object detection
 */
class BlindMateNavigation {
    constructor() {
        // Navigation states
        this.currentState = 'idle'; // idle, listening, confirming, navigating
        this.isNavigating = false;
        this.currentRoute = null;
        this.currentStepIndex = 0;
        this.locationWatcher = null;
        this.currentDestination = null;
        
        // Object detection
        this.model = null;
        this.isDetecting = false;
        this.lastDetectionTime = 0;
        this.detectionInterval = 2000; // 2 seconds between detections
        
        // Speech recognition and synthesis
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isSpeaking = false;
        this.speechQueue = [];
        
        // Predefined locations
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
            emergencyStop: document.getElementById('emergencyStop')
        };
    }
    
    /**
     * Initialize the navigation system
     */
    async init() {
        this.updateStatus('Initializing BlindMate...', 'Please wait while we set up the system');
        
        // Setup event listeners (this never fails)
        this.setupEventListeners();
        
        // Initialize speech recognition (this never fails)
        this.initSpeechRecognition();
        
        // Initialize webcam and object detection (with safe error handling)
        try {
            await this.initCamera();
            console.log('Camera initialization completed');
        } catch (error) {
            console.warn('Camera initialization failed, continuing without camera:', error.message);
            this.setupDummyVideo();
        }
        
        // Load TensorFlow model (with safe error handling)
        try {
            await this.loadObjectDetectionModel();
            console.log('Object detection model loading completed');
        } catch (error) {
            console.warn('Object detection model failed to load, continuing without:', error.message);
        }
        
        // Always complete initialization successfully
        this.updateStatus('Ready to Navigate', 'Press the button or Volume Up key to start');
        
        // Announce readiness with camera status
        const cameraStatus = this.elements.webcam.style.display === 'none' 
            ? ' Navigation ready without camera.' 
            : ' Camera and navigation ready.';
        
        setTimeout(() => {
            this.speak('BlindMate is ready.' + cameraStatus + ' Press the button to start navigation.');
        }, 1000);
        
        console.log('BlindMate initialization completed successfully');
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
            this.speak('I didn\'t understand the destination. Please try saying "Go to library" or "Navigate to canteen".');
            this.resetToIdle();
        }
    }
    
    /**
     * Confirm navigation to destination
     */
    confirmNavigation(destination) {
        // Find the location
        const location = this.findLocation(destination);
        
        if (!location) {
            const availableLocations = Object.keys(this.locations).join(', ');
            this.speak(`I don't know where ${destination} is. Available locations are: ${availableLocations}`);
            this.resetToIdle();
            return;
        }
        
        this.currentDestination = location;
        this.currentState = 'confirming';
        this.updateStatus('Confirm Navigation', `Navigate to ${location.name}?`);
        
        // Ask for confirmation
        this.speak(`Should I start navigation to ${location.name}? Say yes to confirm or no to cancel.`);
        
        // Listen for yes/no response
        setTimeout(() => {
            if (this.currentState === 'confirming') {
                this.listenForConfirmation();
            }
        }, 3000);
    }
    
    /**
     * Listen for yes/no confirmation
     */
    listenForConfirmation() {
        if (!this.recognition) return;
        
        const originalOnResult = this.recognition.onresult;
        
        this.recognition.onresult = (event) => {
            const response = event.results[0][0].transcript.toLowerCase().trim();
            console.log('Confirmation response:', response);
            
            if (response.includes('yes') || response.includes('yeah') || response.includes('confirm')) {
                this.startNavigation();
            } else if (response.includes('no') || response.includes('cancel') || response.includes('stop')) {
                this.speak('Navigation cancelled.');
                this.resetToIdle();
            } else {
                this.speak('Please say yes to confirm or no to cancel.');
                setTimeout(() => this.listenForConfirmation(), 1000);
            }
            
            // Restore original handler
            this.recognition.onresult = originalOnResult;
        };
        
        try {
            this.recognition.start();
        } catch (error) {
            console.error('Confirmation listening error:', error);
            this.resetToIdle();
        }
    }
    
    /**
     * Start navigation to confirmed destination
     */
    async startNavigation() {
        try {
            this.currentState = 'navigating';
            this.isNavigating = true;
            this.updateButtonState();
            this.updateStatus('Getting Directions...', 'Please wait while we calculate your route');
            
            // Get current location
            const currentLocation = await this.getCurrentLocation();
            
            // Fetch directions from backend
            const directions = await this.getDirections(currentLocation, this.currentDestination);
            
            if (directions && directions.status === 'OK') {
                this.currentRoute = directions;
                this.currentStepIndex = 0;
                
                // Announce route overview
                this.speak(`Route found. ${directions.total_distance}, about ${directions.total_duration} walking. Starting navigation now.`);
                
                // Start live navigation
                this.startLiveNavigation();
                
                // Start object detection during navigation
                this.startObjectDetection();
                
            } else {
                throw new Error('Could not get directions');
            }
            
        } catch (error) {
            console.error('Navigation start error:', error);
            this.speak('Sorry, I couldn\'t get directions to that location. Please try again.');
            this.resetToIdle();
        }
    }
    
    /**
     * Start live navigation with position tracking
     */
    startLiveNavigation() {
        this.elements.emergencyStop.style.display = 'block';
        this.elements.navigationInfo.style.display = 'block';
        
        // Announce first step
        this.announceCurrentStep();
        
        // Start watching position for step-by-step guidance
        this.startPositionTracking();
    }
    
    /**
     * Start tracking user position for turn-by-turn navigation
     */
    startPositionTracking() {
        if (!navigator.geolocation) {
            this.speak('Location tracking is not available');
            return;
        }
        
        this.locationWatcher = navigator.geolocation.watchPosition(
            (position) => {
                const currentPos = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                
                this.checkNavigationProgress(currentPos);
            },
            (error) => {
                console.error('Position tracking error:', error);
                this.speak('GPS tracking lost. Navigation may be less accurate.');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 5000
            }
        );
    }
    
    /**
     * Check navigation progress and announce next steps
     */
    checkNavigationProgress(currentPosition) {
        if (!this.currentRoute || !this.isNavigating) return;
        
        const steps = this.currentRoute.steps;
        if (this.currentStepIndex >= steps.length) {
            this.navigationComplete();
            return;
        }
        
        const currentStep = steps[this.currentStepIndex];
        const targetLocation = currentStep.end_location;
        
        // Calculate distance to target
        const distanceToTarget = this.calculateDistance(currentPosition, targetLocation);
        
        // If close to target (within 20 meters), move to next step
        if (distanceToTarget < 20) {
            this.currentStepIndex++;
            
            if (this.currentStepIndex < steps.length) {
                this.announceCurrentStep();
            } else {
                this.navigationComplete();
            }
        }
        
        // Check if user has deviated significantly from route (>30 meters)
        if (distanceToTarget > 30) {
            this.handleRouteDeviation(currentPosition);
        }
    }
    
    /**
     * Announce current navigation step
     */
    announceCurrentStep() {
        if (!this.currentRoute || this.currentStepIndex >= this.currentRoute.steps.length) return;
        
        const step = this.currentRoute.steps[this.currentStepIndex];
        const stepNumber = this.currentStepIndex + 1;
        const totalSteps = this.currentRoute.steps.length;
        
        // Update UI
        this.elements.currentStep.textContent = `Step ${stepNumber}/${totalSteps}: ${step.instruction}`;
        this.elements.stepDistance.textContent = `Distance: ${step.distance}`;
        
        this.updateStatus('Navigating', `Step ${stepNumber} of ${totalSteps}`);
        
        // Announce via speech
        this.speak(`Step ${stepNumber}. ${step.instruction}. Distance: ${step.distance}.`);
    }
    
    /**
     * Handle route deviation and recalculate
     */
    async handleRouteDeviation(currentPosition) {
        try {
            this.speak('You\'ve moved off the route. Recalculating directions...');
            this.updateStatus('Recalculating...', 'Getting new directions');
            
            // Get new directions from current position
            const newDirections = await this.getDirections(currentPosition, this.currentDestination);
            
            if (newDirections && newDirections.status === 'OK') {
                this.currentRoute = newDirections;
                this.currentStepIndex = 0;
                
                this.speak('New route calculated. Continuing navigation.');
                this.announceCurrentStep();
            } else {
                this.speak('Could not recalculate route. Please navigate manually.');
            }
            
        } catch (error) {
            console.error('Route recalculation error:', error);
            this.speak('Route recalculation failed. Continuing with original directions.');
        }
    }
    
    /**
     * Complete navigation
     */
    navigationComplete() {
        this.speak(`You have arrived at ${this.currentDestination.name}. Navigation complete.`);
        this.updateStatus('Arrived', `Welcome to ${this.currentDestination.name}`);
        
        // Stop navigation
        this.stopNavigation();
        
        // Continue object detection for a few more seconds
        setTimeout(() => {
            if (!this.isNavigating) {
                this.stopObjectDetection();
            }
        }, 10000);
    }
    
    /**
     * Start object detection during navigation
     */
    startObjectDetection() {
        if (!this.model) return;
        
        this.isDetecting = true;
        this.elements.detectionOverlay.style.display = 'block';
        this.detectObjects();
    }
    
    /**
     * Detect objects in camera feed
     */
    async detectObjects() {
        if (!this.isDetecting || !this.model) return;
        
        try {
            // Check if webcam is actually playing
            if (this.elements.webcam.readyState !== 4 || this.elements.webcam.videoWidth === 0) {
                // Skip detection if no video feed
                setTimeout(() => this.detectObjects(), this.detectionInterval);
                return;
            }
            
            const predictions = await this.model.detect(this.elements.webcam);
            this.drawDetections(predictions);
            this.announceObstacles(predictions);
            
            // Continue detection loop
            setTimeout(() => this.detectObjects(), this.detectionInterval);
            
        } catch (error) {
            console.warn('Object detection error:', error.message);
            // Continue trying detection
            setTimeout(() => this.detectObjects(), this.detectionInterval * 2);
        }
    }
    
    /**
     * Draw detection boxes on canvas
     */
    drawDetections(predictions) {
        const ctx = this.elements.canvas.getContext('2d');
        ctx.clearRect(0, 0, this.elements.canvas.width, this.elements.canvas.height);
        
        predictions.forEach(prediction => {
            if (prediction.score > 0.5) {
                const [x, y, width, height] = prediction.bbox;
                
                // Draw bounding box
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, width, height);
                
                // Draw label
                ctx.fillStyle = '#ff0000';
                ctx.font = '16px Arial';
                ctx.fillText(
                    `${prediction.class} (${Math.round(prediction.score * 100)}%)`,
                    x,
                    y > 20 ? y - 5 : y + 20
                );
            }
        });
    }
    
    /**
     * Announce obstacles to user
     */
    announceObstacles(predictions) {
        const now = Date.now();
        if (now - this.lastDetectionTime < 5000) return; // Throttle announcements
        
        const importantObjects = predictions.filter(p => 
            p.score > 0.6 && 
            ['person', 'bicycle', 'car', 'motorcycle', 'bus', 'truck', 'traffic light', 'stop sign'].includes(p.class)
        );
        
        if (importantObjects.length > 0) {
            const objectNames = importantObjects.map(obj => obj.class).join(', ');
            this.speak(`Obstacle detected: ${objectNames} ahead.`, true);
            this.lastDetectionTime = now;
        }
    }
    
    /**
     * Stop object detection
     */
    stopObjectDetection() {
        this.isDetecting = false;
        this.elements.detectionOverlay.style.display = 'none';
        
        // Clear canvas
        const ctx = this.elements.canvas.getContext('2d');
        ctx.clearRect(0, 0, this.elements.canvas.width, this.elements.canvas.height);
    }
    
    /**
     * Emergency stop navigation
     */
    emergencyStop() {
        this.speak('Navigation stopped.', true);
        this.stopNavigation();
        this.stopObjectDetection();
        this.resetToIdle();
    }
    
    /**
     * Stop navigation
     */
    stopNavigation() {
        this.isNavigating = false;
        this.currentRoute = null;
        this.currentStepIndex = 0;
        this.currentDestination = null;
        
        // Stop position tracking
        if (this.locationWatcher) {
            navigator.geolocation.clearWatch(this.locationWatcher);
            this.locationWatcher = null;
        }
        
        // Hide navigation UI
        this.elements.emergencyStop.style.display = 'none';
        this.elements.navigationInfo.style.display = 'none';
    }
    
    /**
     * Reset to idle state
     */
    resetToIdle() {
        this.currentState = 'idle';
        this.updateButtonState();
        this.updateStatus('Ready to Navigate', 'Press the button or Volume Up key to start');
    }
    
    /**
     * Update button appearance based on state
     */
    updateButtonState() {
        const button = this.elements.mainButton;
        button.className = 'main-button';
        
        switch (this.currentState) {
            case 'listening':
                button.classList.add('listening');
                button.innerHTML = '<i class="fas fa-stop"></i> Stop Listening';
                break;
            case 'navigating':
                button.classList.add('navigating');
                button.innerHTML = '<i class="fas fa-route"></i> Navigating...';
                break;
            default:
                button.innerHTML = '<i class="fas fa-microphone"></i> Start Listening';
        }
    }
    
    /**
     * Update status display
     */
    updateStatus(mainText, subText) {
        this.elements.statusText.textContent = mainText;
        this.elements.instructionText.textContent = subText;
    }
    
    /**
     * Text-to-speech with queue management
     */
    speak(text, priority = false) {
        if (priority) {
            // Stop current speech and clear queue for high priority messages
            this.synthesis.cancel();
            this.speechQueue = [];
        }
        
        if (this.synthesis.speaking && !priority) {
            this.speechQueue.push(text);
            return;
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 0.8;
        
        utterance.onend = () => {
            if (this.speechQueue.length > 0) {
                const nextText = this.speechQueue.shift();
                setTimeout(() => this.speak(nextText), 500);
            }
        };
        
        this.synthesis.speak(utterance);
    }
    
    /**
     * Get current user location
     */
    getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    let errorMessage = 'Location access failed. ';
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage += 'Please enable GPS in your browser settings.';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage += 'Location information is unavailable.';
                            break;
                        case error.TIMEOUT:
                            errorMessage += 'Location request timed out.';
                            break;
                    }
                    this.speak(errorMessage);
                    reject(error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000
                }
            );
        });
    }
    
    /**
     * Get directions from backend API
     */
    async getDirections(origin, destination) {
        try {
            const response = await fetch('/api/directions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    origin: `${origin.lat},${origin.lng}`,
                    destination: `${destination.lat},${destination.lng}`,
                    mode: 'walking'
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('Directions API error:', error);
            throw error;
        }
    }
    
    /**
     * Find location by name (fuzzy matching)
     */
    findLocation(name) {
        const searchName = name.toLowerCase().trim();
        
        // Direct match
        if (this.locations[searchName]) {
            return this.locations[searchName];
        }
        
        // Fuzzy match
        for (const [key, location] of Object.entries(this.locations)) {
            if (key.includes(searchName) || 
                searchName.includes(key) || 
                location.name.toLowerCase().includes(searchName)) {
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
            const saved = localStorage.getItem('blindmate_locations');
            if (saved) {
                const savedLocations = JSON.parse(saved);
                Object.assign(this.locations, savedLocations);
                console.log('Loaded saved locations:', Object.keys(savedLocations));
            }
        } catch (error) {
            console.warn('Failed to load saved locations:', error);
        }
    }
    
    /**
     * Calculate distance between two coordinates
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
     * Show navigation options during active navigation
     */
    showNavigationOptions() {
        this.speak('Navigation is active. Say "stop navigation" to end, or press escape for emergency stop.');
    }
}

// Initialize BlindMate when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.blindMate = new BlindMateNavigation();
});

// Service worker registration for PWA capabilities
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
}