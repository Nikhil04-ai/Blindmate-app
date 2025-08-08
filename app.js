/**
 * BlindMate - AI Assistant for Visually Impaired Users
 * Main Application JavaScript
 */

class BlindMate {
    constructor() {
        // Core properties
        this.video = document.getElementById('webcam');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.model = null;
        this.isDetecting = false;
        this.stream = null;
        this.currentLanguage = 'en-IN';
        this.userLocation = null;
        
        // Voice synthesis and recognition
        this.synth = window.speechSynthesis;
        this.recognition = null;
        this.isListening = false;
        
        // UI elements
        this.elements = {
            startBtn: document.getElementById('startDetectionBtn'),
            stopBtn: document.getElementById('stopDetectionBtn'),
            voiceBtn: document.getElementById('voiceCommandBtn'),
            locationBtn: document.getElementById('locationBtn'),
            languageSelect: document.getElementById('languageSelect'),
            systemStatus: document.getElementById('systemStatus'),
            detectionStatus: document.getElementById('detectionStatus'),
            voiceStatus: document.getElementById('voiceStatus'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            detectionIndicator: document.getElementById('detectionIndicator')
        };
        
        // Language configurations
        this.languages = {
            'en-IN': { name: 'English', voice: 'en-IN', greeting: 'Hello! Should I start detection, Sir?' },
            'hi-IN': { name: 'Hindi', voice: 'hi-IN', greeting: 'नमस्ते! क्या मैं डिटेक्शन शुरू करूं, सर?' },
            'ta-IN': { name: 'Tamil', voice: 'ta-IN', greeting: 'வணக்கம்! நான் கண்டறிதலைத் தொடங்க வேண்டுமா, ஐயா?' },
            'te-IN': { name: 'Telugu', voice: 'te-IN', greeting: 'నమస్కారం! నేను గుర్తింపును ప్రారంభించాలా, సార్?' },
            'bn-IN': { name: 'Bengali', voice: 'bn-IN', greeting: 'নমস্কার! আমি কি সনাক্তকরণ শুরু করব, স্যার?' },
            'mr-IN': { name: 'Marathi', voice: 'mr-IN', greeting: 'नमस्कार! मी ओळख सुरू करावी का, सर?' },
            'gu-IN': { name: 'Gujarati', voice: 'gu-IN', greeting: 'નમસ્તે! શું મારે ડિટેક્શન શરૂ કરવું જોઈએ, સર?' }
        };
        
        // Detection settings
        this.detectionThreshold = 0.5;
        this.lastDetections = [];
        this.lastAnnouncement = 0;
        this.announcementInterval = 5000; // 5 seconds between announcements
        this.lastSpeechTime = 0;
        this.speechCooldown = 2000; // 2 seconds cooldown between speech
        this.isSpeaking = false;
        this.speechQueue = [];
        
        // Navigation settings
        this.isNavigating = false;
        this.currentRoute = null;
        this.currentStepIndex = 0;
        this.locationWatcher = null;
        this.routeDeviationThreshold = 15; // meters
        
        // Predefined locations (no database needed) + localStorage support
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
        
        // Wake word detection
        this.isListeningForWakeWord = true;
        this.wakeWords = ['hey blindmate', 'hey blind mate', 'blindmate'];
        this.continuousRecognition = null;
        
        // Volume key detection
        this.volumeUpPressed = false;
        this.volumeKeyTimeout = null;
        
        this.init();
    }

    /**
     * Load saved locations from localStorage
     */
    loadSavedLocations() {
        try {
            const savedLocations = localStorage.getItem('blindmate_locations');
            if (savedLocations) {
                const parsed = JSON.parse(savedLocations);
                Object.assign(this.locations, parsed);
                console.log('Loaded saved locations:', Object.keys(parsed));
            }
        } catch (error) {
            console.warn('Failed to load saved locations:', error);
        }
    }

    /**
     * Save a new location to localStorage
     */
    async saveLocation(locationName, coordinates = null) {
        try {
            let coords = coordinates;
            if (!coords) {
                coords = await this.getCurrentPosition();
            }
            
            // Add to locations object
            this.locations[locationName.toLowerCase()] = {
                lat: coords.lat,
                lng: coords.lng,
                name: locationName
            };
            
            // Get existing saved locations
            let savedLocations = {};
            try {
                const existing = localStorage.getItem('blindmate_locations');
                if (existing) {
                    savedLocations = JSON.parse(existing);
                }
            } catch (e) {
                console.warn('Failed to parse existing locations');
            }
            
            // Add new location to saved locations
            savedLocations[locationName.toLowerCase()] = this.locations[locationName.toLowerCase()];
            
            // Save to localStorage
            localStorage.setItem('blindmate_locations', JSON.stringify(savedLocations));
            
            this.updateActionStatus(`Location "${locationName}" saved successfully`);
            this.speak(`Location ${locationName} has been saved`);
            
            return true;
        } catch (error) {
            console.error('Failed to save location:', error);
            this.showError('Failed to save location. Please enable location access.');
            return false;
        }
    }

    /**
     * Get current position with error handling
     */
    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported'));
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
                        default:
                            errorMessage += 'An unknown error occurred.';
                            break;
                    }
                    this.showError(errorMessage);
                    this.speak('Location access is required. Please enable GPS in your browser settings.');
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
     * Update action status display
     */
    updateActionStatus(message, type = 'info') {
        if (this.elements && this.elements.status && this.elements.statusText) {
            this.elements.statusText.textContent = message;
            this.elements.status.style.display = 'block';
            this.elements.status.className = `alert alert-${type} mt-2`;
            
            // Auto-hide after 5 seconds for non-critical messages
            if (type !== 'danger') {
                setTimeout(() => {
                    if (this.elements.status && this.elements.statusText.textContent === message) {
                        this.elements.status.style.display = 'none';
                    }
                }, 5000);
            }
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        if (this.elements && this.elements.errorMessage && this.elements.errorText) {
            this.elements.errorText.textContent = message;
            this.elements.errorMessage.style.display = 'block';
            
            // Auto-hide after 8 seconds
            setTimeout(() => {
                if (this.elements.errorMessage && this.elements.errorText.textContent === message) {
                    this.elements.errorMessage.style.display = 'none';
                }
            }, 8000);
        }
    }

    /**
     * Monitor user position for route deviation
     */
    monitorPosition(expectedPath) {
        if (this.locationWatcher) {
            navigator.geolocation.clearWatch(this.locationWatcher);
        }
        
        this.locationWatcher = navigator.geolocation.watchPosition(
            (position) => {
                const currentPos = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                
                // Check if user has deviated from route
                if (this.isNavigating && this.currentRoute && this.currentRoute.legs) {
                    const currentStep = this.getCurrentRouteStep();
                    if (currentStep) {
                        const distance = this.calculateDistance(
                            currentPos,
                            {
                                lat: currentStep.end_location.lat(),
                                lng: currentStep.end_location.lng()
                            }
                        );
                        
                        // If user is more than threshold distance away, re-route
                        if (distance > this.routeDeviationThreshold) {
                            this.handleRouteDeviation(currentPos);
                        }
                    }
                }
            },
            (error) => {
                console.warn('Position monitoring error:', error);
                this.showError('GPS monitoring failed. Navigation accuracy may be reduced.');
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 10000
            }
        );
    }

    /**
     * Handle route deviation and re-calculate route
     */
    async handleRouteDeviation(currentPosition) {
        try {
            this.speak('You have moved off the route, recalculating...', true);
            this.updateActionStatus('Re-routing...', 'warning');
            
            // Get the destination from current route
            const destination = this.currentDestination;
            if (!destination) {
                this.showError('Cannot re-route: destination unknown');
                return;
            }
            
            // Re-calculate route from current position
            await this.getDirections(currentPosition, destination);
            
            this.updateActionStatus('Route recalculated', 'success');
            this.speak('New route calculated. Continuing navigation.');
            
        } catch (error) {
            console.error('Re-routing failed:', error);
            this.showError('Failed to recalculate route');
            this.speak('Route recalculation failed. Please navigate manually.');
        }
    }

    /**
     * Get current route step
     */
    getCurrentRouteStep() {
        if (!this.currentRoute || !this.currentRoute.legs || !this.currentRoute.legs[0]) {
            return null;
        }
        
        const steps = this.currentRoute.legs[0].steps;
        if (this.currentStepIndex < steps.length) {
            return steps[this.currentStepIndex];
        }
        
        return null;
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
     * Get location coordinates (supports both hardcoded and saved locations)
     */
    getLocationCoordinates(destinationName) {
        const destKey = destinationName.toLowerCase().trim();
        
        // Check hardcoded locations first
        let location = this.locations[destKey];
        
        // Try fuzzy matching for common variations
        if (!location) {
            const locationKeys = Object.keys(this.locations);
            const match = locationKeys.find(key => 
                key.includes(destKey) || 
                destKey.includes(key) ||
                this.locations[key].name.toLowerCase().includes(destKey)
            );
            if (match) {
                location = this.locations[match];
            }
        }
        
        return location;
    }

    /**
     * Simple stop navigation function
     */
    stopNavigationSimple() {
        console.log('Stopping navigation');
        
        this.isNavigating = false;
        this.currentRoute = null;
        this.currentStepIndex = 0;
        this.currentDestination = null;
        
        // Stop position monitoring
        if (this.locationWatcher) {
            navigator.geolocation.clearWatch(this.locationWatcher);
            this.locationWatcher = null;
        }
        
        this.updateActionStatus('Navigation stopped', 'warning');
        this.speak('Navigation has been stopped', true);
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            this.updateStatus('Initializing BlindMate...', 'info');
            
            // Check if this is a first-time user
            this.checkFirstTimeUser();
            
            // Initialize DOM elements first
            this.initDOMElements();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize speech recognition
            this.initSpeechRecognition();
            
            // Load TensorFlow model
            await this.loadModel();
            
            // Start voice interaction
            this.startVoiceInteraction();
            
        } catch (error) {
            console.error('Initialization error:', error);
            this.updateStatus('Failed to initialize. Please refresh the page.', 'danger');
            this.speak('Sorry, there was an error initializing the application. Please refresh the page.');
        }
    }
    
    /**
     * Initialize DOM elements with fallback for missing elements
     */
    initDOMElements() {
        this.elements = {
            video: document.getElementById('webcam'),
            canvas: document.getElementById('canvas'),
            startBtn: document.getElementById('startDetectionBtn'),
            stopBtn: document.getElementById('stopDetectionBtn'),
            voiceBtn: document.getElementById('voiceCommandBtn'),
            locationBtn: document.getElementById('locationBtn'),
            languageSelect: document.getElementById('languageSelect'),
            detectionStatus: document.getElementById('detectionStatus'),
            voiceStatus: document.getElementById('voiceStatus'),
            systemStatus: document.getElementById('systemStatus'),
            status: document.getElementById('status'),
            statusText: document.getElementById('statusText'),
            errorMessage: document.getElementById('error-message'),
            errorText: document.getElementById('errorText'),
            navigationStatus: document.getElementById('navigationStatus') || this.createNavigationStatus(),
            loadingOverlay: document.getElementById('loadingOverlay'),
            detectionIndicator: document.getElementById('detectionIndicator')
        };
    }
    
    /**
     * Create navigation status element if it doesn't exist
     */
    createNavigationStatus() {
        const navStatus = document.createElement('span');
        navStatus.id = 'navigationStatus';
        navStatus.className = 'badge bg-secondary';
        navStatus.textContent = 'Ready';
        return navStatus;
    }

    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        this.elements.startBtn.addEventListener('click', () => this.startDetection());
        this.elements.stopBtn.addEventListener('click', () => this.stopDetection());
        this.elements.voiceBtn.addEventListener('click', () => this.startVoiceCommand());
        this.elements.locationBtn.addEventListener('click', () => this.requestLocation());
        this.elements.languageSelect.addEventListener('change', (e) => this.changeLanguage(e.target.value));
        
        // Keyboard shortcuts for accessibility and volume key detection
        document.addEventListener('keydown', (e) => {
            // Volume Up key detection (multiple key codes for different devices)
            if (e.key === 'VolumeUp' || e.keyCode === 175 || e.keyCode === 174 || 
                e.code === 'VolumeUp' || e.code === 'AudioVolumeUp') {
                e.preventDefault();
                this.handleVolumeUpPress();
                return;
            }
            
            // Ctrl + key shortcuts
            if (e.ctrlKey) {
                switch(e.key) {
                    case 's':
                        e.preventDefault();
                        if (this.isDetecting) {
                            this.stopDetection();
                        } else {
                            this.startDetection();
                        }
                        break;
                    case 'v':
                        e.preventDefault();
                        this.startVoiceCommand();
                        break;
                    case 'l':
                        e.preventDefault();
                        this.requestLocation();
                        break;
                }
            }
        });
    }

    /**
     * Initialize speech recognition for voice commands
     */
    initSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Speech recognition not supported');
            this.elements.voiceBtn.disabled = true;
            this.updateStatus('Voice commands not supported. Use text input instead.', 'warning');
            this.showTextFallback();
            return;
        }

        // Initialize speech recognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        // Create recognition instance for voice commands
        this.commandRecognition = new SpeechRecognition();
        this.commandRecognition.continuous = false;
        this.commandRecognition.interimResults = false;
        this.commandRecognition.lang = this.currentLanguage;
        
        // Command recognition event handlers
        this.commandRecognition.onstart = () => {
            this.isListening = true;
            this.updateStatus('🎤 Listening... Speak your command now', 'primary');
            this.elements.voiceStatus.textContent = 'Listening';
            this.elements.voiceStatus.className = 'badge bg-primary';
            this.elements.voiceBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Listening';
            this.speak('Speak your command now', true);
        };
        
        this.commandRecognition.onresult = (event) => {
            const command = event.results[0][0].transcript.trim();
            const confidence = event.results[0][0].confidence;
            console.log('Voice command received:', command, 'Confidence:', confidence);
            
            // Show command in UI
            this.showRecognizedCommand(command);
            
            // Process the command via Gemini
            this.processVoiceCommand(command);
        };
        
        this.commandRecognition.onerror = (event) => {
            console.error('Command recognition error:', event.error);
            this.isListening = false;
            this.elements.voiceStatus.textContent = 'Error';
            this.elements.voiceStatus.className = 'badge bg-danger';
            this.elements.voiceBtn.innerHTML = '<i class="fas fa-microphone"></i> Voice Command';
            
            let errorMessage = 'Voice recognition error';
            if (event.error === 'not-allowed') {
                errorMessage = 'Microphone access denied. Please allow microphone access and try again.';
                this.showTextFallback();
            } else if (event.error === 'no-speech') {
                errorMessage = 'No speech detected. Please try again.';
            }
            
            this.updateStatus(errorMessage, 'danger');
            this.speak('Voice command failed. Try again or use the buttons.', true);
        };
        
        this.commandRecognition.onend = () => {
            this.isListening = false;
            this.elements.voiceStatus.textContent = 'Ready';
            this.elements.voiceStatus.className = 'badge bg-secondary';
            this.elements.voiceBtn.innerHTML = '<i class="fas fa-microphone"></i> Voice Command';
            this.updateStatus('Voice command completed. Say "Hey BlindMate" or press Volume Up for next command.', 'success');
            
            // Restart continuous listening for wake words
            setTimeout(() => {
                this.startContinuousListening();
            }, 1000);
        };

        // Add click handler for voice button
        this.elements.voiceBtn.addEventListener('click', () => {
            if (this.isListening) {
                this.stopVoiceCommand();
            } else {
                this.startVoiceCommand();
            }
        });
        
        // Initialize continuous recognition for wake words separately
        this.initContinuousListening();
    }
    
    /**
     * Initialize continuous listening for wake words
     */
    initContinuousListening() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.continuousRecognition = new SpeechRecognition();
        this.continuousRecognition.continuous = true;
        this.continuousRecognition.interimResults = true;
        this.continuousRecognition.lang = this.currentLanguage;
        
        this.continuousRecognition.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                const command = result[0].transcript.toLowerCase().trim();
                
                console.log('Continuous listening heard:', command);
                
                // Check for wake words with better matching
                if (this.wakeWords.some(wake => command.includes(wake))) {
                    console.log('Wake word detected:', command);
                    this.handleWakeWordDetected();
                    break;
                }
            }
        };
        
        this.continuousRecognition.onerror = (event) => {
            console.log('Continuous recognition error:', event.error);
            if (event.error !== 'aborted') {
                // Restart continuous listening after a short delay
                setTimeout(() => {
                    if (this.isListeningForWakeWord) {
                        this.startContinuousListening();
                    }
                }, 1000);
            }
        };
        
        this.continuousRecognition.onend = () => {
            // Restart continuous listening if it should be active
            if (this.isListeningForWakeWord && !this.isListening) {
                setTimeout(() => {
                    this.startContinuousListening();
                }, 500);
            }
        };
    }
    
    /**
     * Start voice command
     */
    startVoiceCommand() {
        if (!this.commandRecognition) {
            this.updateStatus('Voice recognition not available.', 'danger');
            this.showTextFallback();
            return;
        }

        if (this.isListening) {
            this.stopVoiceCommand();
            return;
        }

        try {
            // Stop continuous listening temporarily
            this.stopContinuousListening();
            
            // Start command recognition
            this.commandRecognition.lang = this.currentLanguage;
            this.commandRecognition.start();
        } catch (error) {
            console.error('Error starting voice recognition:', error);
            this.updateStatus('Could not start voice recognition. Try again.', 'danger');
            
            // Restart continuous listening
            this.startContinuousListening();
        }
    }
    
    /**
     * Stop voice command
     */
    stopVoiceCommand() {
        if (this.commandRecognition && this.isListening) {
            this.commandRecognition.stop();
        }
    }
    
    /**
     * Start continuous listening for wake words
     */
    startContinuousListening() {
        if (this.continuousRecognition && this.isListeningForWakeWord && !this.isListening) {
            try {
                this.continuousRecognition.lang = this.currentLanguage;
                this.continuousRecognition.start();
            } catch (error) {
                console.log('Continuous listening start error:', error.message);
            }
        }
    }
    
    /**
     * Stop continuous listening
     */
    stopContinuousListening() {
        if (this.continuousRecognition) {
            try {
                this.continuousRecognition.stop();
            } catch (error) {
                console.log('Continuous listening stop error:', error.message);
            }
        }
    }
    
    /**
     * Handle wake word detection
     */
    handleWakeWordDetected() {
        console.log('Wake word "Hey BlindMate" detected!');
        this.updateStatus('🎤 Wake word detected! Listening for command...', 'success');
        
        // Stop continuous listening temporarily
        this.stopContinuousListening();
        
        // Give audio feedback
        this.speak('Yes, how can I help you?', true);
        
        // Start command listening after response
        setTimeout(() => {
            this.startVoiceCommand();
        }, 1500);
    }
    
    /**
     * Handle volume up key press for voice activation
     */
    handleVolumeUpPress() {
        console.log('Volume Up key pressed for voice activation');
        
        // Prevent multiple rapid presses
        if (this.volumeKeyTimeout) {
            clearTimeout(this.volumeKeyTimeout);
        }
        
        // If already listening, stop
        if (this.isListening) {
            this.stopVoiceCommand();
            this.speak('Voice command stopped', true);
            return;
        }
        
        // Start voice command
        this.updateStatus('🎤 Volume Up pressed - Starting voice command...', 'info');
        this.speak('Voice command activated. Speak now.', true);
        
        // Small delay to let the speech finish
        this.volumeKeyTimeout = setTimeout(() => {
            this.startVoiceCommand();
        }, 1000);
    }
    
    /**
     * Show text fallback input for when voice is not available
     */
    showTextFallback() {
        if (document.getElementById('textCommandInput')) return; // Already shown
        
        const fallbackHtml = `
            <div class="mt-3 p-3 border rounded bg-light">
                <h6>Voice not available? Use text instead:</h6>
                <div class="input-group">
                    <input type="text" id="textCommandInput" class="form-control" 
                           placeholder="Type your command (e.g., 'start detection', 'take me to library')">
                    <button class="btn btn-primary" id="textCommandBtn">
                        <i class="fas fa-paper-plane"></i> Send
                    </button>
                </div>
                <small class="text-muted">Commands: start detection, stop, where am i, take me to [place], enable location</small>
            </div>
        `;
        
        const controlsSection = document.querySelector('.col-md-6:last-child .card-body');
        if (controlsSection) {
            controlsSection.insertAdjacentHTML('beforeend', fallbackHtml);
            
            const textInput = document.getElementById('textCommandInput');
            const textBtn = document.getElementById('textCommandBtn');
            
            const processTextCommand = () => {
                const command = textInput.value.trim();
                if (command) {
                    this.showRecognizedCommand(command);
                    this.processVoiceCommand(command);
                    textInput.value = '';
                }
            };
            
            textBtn.addEventListener('click', processTextCommand);
            textInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    processTextCommand();
                }
            });
        }
    }
    
    /**
     * Show the recognized command in UI
     */
    showRecognizedCommand(command) {
        // Update the system status to show the command
        this.updateStatus(`Command received: "${command}"`, 'info');
        
        // Show in dedicated command display
        let commandDisplay = document.getElementById('lastCommand');
        if (!commandDisplay) {
            const statusArea = document.getElementById('systemStatus').parentElement;
            statusArea.insertAdjacentHTML('afterend', `
                <div class="alert alert-info mt-2" id="lastCommand" style="display: none;">
                    <strong>Last Command:</strong> <span id="commandText"></span>
                </div>
            `);
            commandDisplay = document.getElementById('lastCommand');
        }
        
        document.getElementById('commandText').textContent = command;
        commandDisplay.style.display = 'block';
        
        // Hide after 5 seconds
        setTimeout(() => {
            commandDisplay.style.display = 'none';
        }, 5000);
    }

    /**
     * Load TensorFlow.js Coco SSD model
     */
    async loadModel() {
        try {
            this.updateStatus('Loading AI detection model...', 'warning');
            
            // Ensure TensorFlow.js is ready
            await tf.ready();
            
            // Load COCO-SSD model
            this.model = await cocoSsd.load();
            
            this.updateStatus('AI model loaded successfully!', 'success');
            this.elements.loadingOverlay.style.display = 'none';
            
            console.log('COCO-SSD model loaded successfully');
            
        } catch (error) {
            console.error('Error loading model:', error);
            this.updateStatus('Failed to load AI model. Please refresh the page.', 'danger');
            throw error;
        }
    }

    /**
     * Start voice interaction flow
     */
    startVoiceInteraction() {
        const greeting = 'Hello! I am BlindMate, your AI assistant. Say "Hey BlindMate" or press Volume Up anytime to give me voice commands.';
        this.speak(greeting, true); // High priority
        
        // Start continuous listening for wake word after greeting
        setTimeout(() => {
            this.startContinuousListening();
            this.updateStatus('👂 Always listening for "Hey BlindMate" or Volume Up key', 'info');
        }, 4000);
    }
    
    /**
     * Setup voice-guided permission flow
     */
    setupVoicePermissionFlow() {
        if (this.recognition && !this.isListening) {
            this.recognition.continuous = false; // Short responses for permissions
            this.recognition.interimResults = false;
            
            this.recognition.onresult = (event) => {
                const command = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
                console.log('Permission flow - heard:', command);
                
                if (command.includes('yes') || command.includes('हाँ') || command.includes('ওয়াই') || command.includes('ஆம்')) {
                    this.handlePermissionYes();
                } else if (command.includes('no') || command.includes('नहीं') || command.includes('না') || command.includes('இল்லை')) {
                    this.handlePermissionNo();
                }
            };
            
            this.recognition.onerror = (event) => {
                console.log('Permission recognition error:', event.error);
                this.isListening = false;
            };
            
            this.recognition.onend = () => {
                this.isListening = false;
            };
            
            try {
                this.recognition.start();
                this.isListening = true;
            } catch (error) {
                console.log('Could not start permission recognition:', error);
            }
        }
    }
    
    /**
     * Handle "yes" response during permission flow
     */
    async handlePermissionYes() {
        if (!this.stream) {
            // First "yes" - start detection
            this.speak('Starting camera detection now.', true);
            await this.startDetection();
            
            // Ask for location
            setTimeout(() => {
                this.speak('Would you like to enable location for navigation?', true);
            }, 2000);
        } else if (!this.userLocation) {
            // Second "yes" - enable location
            this.speak('Enabling location services.', true);
            await this.requestLocation();
            this.finalizeSetup();
        }
    }
    
    /**
     * Handle "no" response during permission flow
     */
    handlePermissionNo() {
        this.speak('Okay, you can enable features later using voice commands or buttons.', true);
        this.finalizeSetup();
    }
    
    /**
     * Finalize setup and start continuous listening
     */
    finalizeSetup() {
        setTimeout(() => {
            this.speak('Setup complete. Say "Hey BlindMate" followed by your command to interact with me.', true);
            this.startContinuousListening();
        }, 2000);
    }
    
    /**
     * Start continuous listening for wake word
     */
    startContinuousListening() {
        if (!this.recognition || this.continuousRecognition) return;
        
        try {
            this.continuousRecognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
            this.continuousRecognition.continuous = true;
            this.continuousRecognition.interimResults = false;
            this.continuousRecognition.lang = this.currentLanguage;
            
            this.continuousRecognition.onresult = (event) => {
                const command = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
                console.log('Continuous listening heard:', command);
                
                // Check for wake word
                const hasWakeWord = this.wakeWords.some(wake => command.includes(wake));
                
                if (hasWakeWord) {
                    // Extract command after wake word
                    const commandAfterWake = command.split(/hey\s*blind\s*mate\s*/i)[1]?.trim();
                    if (commandAfterWake) {
                        this.speak('Yes, how can I help?', true);
                        this.processVoiceCommand(commandAfterWake);
                    } else {
                        this.speak('Yes, I am listening. What can I do for you?', true);
                    }
                }
            };
            
            this.continuousRecognition.onerror = (event) => {
                console.log('Continuous recognition error:', event.error);
                // Only restart if it's not already running
                if (event.error !== 'aborted') {
                    setTimeout(() => {
                        if (this.continuousRecognition && !this.isListening) {
                            try {
                                this.continuousRecognition.start();
                            } catch (e) {
                                console.log('Could not restart continuous recognition:', e);
                            }
                        }
                    }, 2000);
                }
            };
            
            this.continuousRecognition.onend = () => {
                // Only restart if we should be listening
                if (this.continuousRecognition && !this.isListening) {
                    setTimeout(() => {
                        try {
                            this.continuousRecognition.start();
                        } catch (e) {
                            console.log('Could not restart continuous recognition:', e);
                        }
                    }, 1000);
                }
            };
            
            this.continuousRecognition.start();
            
        } catch (error) {
            console.log('Could not start continuous listening:', error);
        }
    }

    /**
     * Start object detection
     */
    async startDetection() {
        try {
            if (!this.model) {
                this.speak('AI model is not ready. Please wait.');
                return;
            }

            this.updateStatus('Starting camera...', 'warning');
            
            // Request camera access
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: { ideal: 640 }, 
                    height: { ideal: 480 },
                    facingMode: 'environment' // Use back camera on mobile
                }
            });
            
            this.video.srcObject = this.stream;
            
            // Wait for video to be ready
            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    resolve();
                };
            });
            
            // Setup canvas dimensions
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            
            this.isDetecting = true;
            this.updateStatus('Detection active - Scanning for objects...', 'success');
            this.elements.detectionStatus.textContent = 'Active';
            this.elements.detectionStatus.className = 'badge bg-success';
            
            // Show detection indicator
            this.elements.detectionIndicator.style.display = 'block';
            this.elements.detectionIndicator.classList.add('active');
            
            this.elements.startBtn.disabled = true;
            this.elements.stopBtn.disabled = false;
            
            this.speak('Object detection started. I will alert you about any obstacles or objects I detect.');
            
            // Start detection loop
            this.detectObjects();
            
        } catch (error) {
            console.error('Error starting detection:', error);
            this.updateStatus('Camera access denied or unavailable.', 'danger');
            this.speak('Sorry, I cannot access the camera. Please check your permissions.');
        }
    }

    /**
     * Stop object detection
     */
    stopDetection() {
        this.isDetecting = false;
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        this.video.srcObject = null;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.updateStatus('Detection stopped.', 'secondary');
        this.elements.detectionStatus.textContent = 'Inactive';
        this.elements.detectionStatus.className = 'badge bg-secondary';
        
        // Hide detection indicator
        this.elements.detectionIndicator.style.display = 'none';
        this.elements.detectionIndicator.classList.remove('active');
        
        this.elements.startBtn.disabled = false;
        this.elements.stopBtn.disabled = true;
        
        this.speak('Object detection stopped.');
    }

    /**
     * Main object detection loop
     */
    async detectObjects() {
        if (!this.isDetecting || !this.model) {
            return;
        }

        try {
            // Perform detection
            const predictions = await this.model.detect(this.video);
            
            // Clear previous drawings
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Filter predictions by confidence threshold
            const validPredictions = predictions.filter(prediction => 
                prediction.score >= this.detectionThreshold
            );
            
            if (validPredictions.length > 0) {
                this.drawPredictions(validPredictions);
                this.announceDetections(validPredictions);
            }
            
            // Continue detection loop
            requestAnimationFrame(() => this.detectObjects());
            
        } catch (error) {
            console.error('Detection error:', error);
            // Continue detection even if one frame fails
            setTimeout(() => this.detectObjects(), 100);
        }
    }

    /**
     * Draw bounding boxes and labels on canvas with improved styling
     */
    drawPredictions(predictions) {
        // Clear previous drawings
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        predictions.forEach((prediction, index) => {
            const [x, y, width, height] = prediction.bbox;
            const confidence = Math.round(prediction.score * 100);
            const label = `${prediction.class} ${confidence}%`;
            
            // Color coding for different object types
            let boxColor = '#00ff00'; // Default green
            if (prediction.class === 'person') boxColor = '#ff6b6b'; // Red for people
            else if (prediction.class.includes('vehicle') || prediction.class === 'car' || prediction.class === 'truck') boxColor = '#ffa500'; // Orange for vehicles
            else if (prediction.class === 'chair' || prediction.class === 'couch') boxColor = '#4ecdc4'; // Teal for furniture
            
            // Draw bounding box with shadow for better visibility
            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            this.ctx.shadowBlur = 3;
            this.ctx.strokeStyle = boxColor;
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(x, y, width, height);
            
            // Reset shadow for text
            this.ctx.shadowBlur = 0;
            
            // Measure text to create proper background
            this.ctx.font = 'bold 16px Arial';
            const textMetrics = this.ctx.measureText(label);
            const textWidth = textMetrics.width + 10;
            const textHeight = 25;
            
            // Draw label background with some padding
            this.ctx.fillStyle = boxColor;
            this.ctx.fillRect(x, y - textHeight, textWidth, textHeight);
            
            // Draw label text
            this.ctx.fillStyle = '#000000';
            this.ctx.fillText(label, x + 5, y - 7);
            
            // Add distance indicator
            const distance = this.estimateDistance(prediction.bbox);
            this.ctx.font = 'bold 12px Arial';
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillText(distance, x + 5, y + height - 5);
        });
    }

    /**
     * Announce detected objects via speech with priority system
     */
    announceDetections(predictions) {
        const now = Date.now();
        
        // Throttle announcements
        if (now - this.lastAnnouncement < this.announcementInterval) {
            return;
        }
        
        // Priority objects (most important for navigation)
        const priorityObjects = ['person', 'chair', 'car', 'truck', 'bus', 'bicycle', 'motorcycle'];
        
        // Sort predictions by priority and distance
        const sortedPredictions = predictions.sort((a, b) => {
            const aPriority = priorityObjects.includes(a.class) ? 1 : 0;
            const bPriority = priorityObjects.includes(b.class) ? 1 : 0;
            
            if (aPriority !== bPriority) {
                return bPriority - aPriority; // Higher priority first
            }
            
            // If same priority, sort by size (closer objects are larger)
            const aSize = a.bbox[2] * a.bbox[3];
            const bSize = b.bbox[2] * b.bbox[3];
            return bSize - aSize;
        });
        
        // Take only the most important objects (max 2)
        const importantObjects = sortedPredictions.slice(0, 2);
        
        if (importantObjects.length > 0) {
            const objectsWithDistance = importantObjects.map(prediction => {
                const distance = this.estimateDistance(prediction.bbox);
                const position = this.getRelativePosition(prediction.bbox);
                return { 
                    name: prediction.class, 
                    distance: distance,
                    position: position,
                    confidence: Math.round(prediction.score * 100)
                };
            });
            
            // Create contextual announcement
            let announcement = '';
            objectsWithDistance.forEach((obj, index) => {
                if (index > 0) announcement += '. Also, ';
                
                // More natural language
                if (obj.name === 'person') {
                    announcement += `person ${obj.position}, ${obj.distance}`;
                } else {
                    announcement += `${obj.name} ${obj.position}, ${obj.distance}`;
                }
            });
            
            this.speak(announcement);
            this.lastAnnouncement = now;
        }
    }
    
    /**
     * Get relative position of object (left, center, right)
     */
    getRelativePosition(bbox) {
        const [x, y, width, height] = bbox;
        const centerX = x + width / 2;
        const canvasCenter = this.canvas.width / 2;
        const threshold = this.canvas.width * 0.25; // 25% threshold
        
        if (centerX < canvasCenter - threshold) {
            return 'on your left';
        } else if (centerX > canvasCenter + threshold) {
            return 'on your right';
        } else {
            return 'ahead of you';
        }
    }

    /**
     * Estimate distance based on bounding box size (simplified)
     */
    estimateDistance(bbox) {
        const [x, y, width, height] = bbox;
        const area = width * height;
        const videoArea = this.video.videoWidth * this.video.videoHeight;
        const relativeSize = area / videoArea;
        
        if (relativeSize > 0.3) return 'very close';
        if (relativeSize > 0.15) return '1 meter away';
        if (relativeSize > 0.05) return '2 meters away';
        return 'far away';
    }

    /**
     * Process voice commands via Gemini API
     */
    async processVoiceCommand(command) {
        console.log('Processing voice command:', command);
        
        try {
            this.updateStatus('Processing your command...', 'primary');
            
            // Send command to Gemini API for processing
            const response = await fetch('/api/process-command', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    command: command,
                    language: this.currentLanguage
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Gemini response:', result);
            
            // Execute the action based on Gemini's response
            await this.executeAction(result);
            
        } catch (error) {
            console.error('Error processing command:', error);
            
            // Fallback to basic command processing
            this.speak('Let me try to process that command locally.', true);
            await this.fallbackCommandProcessing(command);
        }
    }
    
    /**
     * Fallback command processing when Gemini is unavailable
     */
    async fallbackCommandProcessing(command) {
        const cmd = command.toLowerCase();
        
        if (cmd.includes('start') && cmd.includes('detection')) {
            this.speak('Starting object detection', true);
            this.startDetection();
        } else if (cmd.includes('stop')) {
            this.speak('Stopping detection', true);
            this.stopDetection();
        } else if (cmd.includes('location') || cmd.includes('where am i')) {
            this.speak('Enabling location services', true);
            this.requestLocation();
        } else if (cmd.includes('take me') || cmd.includes('navigate') || cmd.includes('go to')) {
            // Extract destination
            let destination = cmd.replace(/take me to|navigate to|go to/g, '').trim();
            
            // Handle common phrase variations
            if (cmd.includes('take me to the')) {
                destination = cmd.replace(/take me to the/g, '').trim();
            }
            
            if (destination) {
                console.log('Navigation command detected:', cmd, 'Destination:', destination);
                this.speak(`Navigating to ${destination}`, true);
                await this.navigateToLocation(destination);
            } else {
                this.speak('Where would you like to go? Available locations are: library, stairs, canteen, entrance, bathroom, office', true);
            }
        } else if (cmd.includes('preview') || cmd.includes('route to')) {
            // Extract destination for route preview
            let destination = cmd.replace(/preview route to|route to|preview/g, '').trim();
            if (destination) {
                console.log('Preview command detected:', cmd, 'Destination:', destination);
                await this.previewRoute(destination);
            } else {
                this.speak('Which location would you like to preview?', true);
            }
        } else if (cmd.includes('stop navigation') || cmd.includes('cancel navigation')) {
            this.stopNavigation();
        } else if (cmd.includes('language') && cmd.includes('hindi')) {
            this.changeLanguage('hi-IN');
        } else if (cmd.includes('language') && cmd.includes('english')) {
            this.changeLanguage('en-IN');
        } else if (cmd.includes('tutorial') || cmd.includes('help') || cmd.includes('guide') || cmd.includes('learn')) {
            this.speak('Starting BlindMate tutorial. This will help you learn all the features.', true);
            setTimeout(() => {
                window.location.href = '/tutorial';
            }, 2000);
        } else {
            this.speak('I did not understand that command. Try saying start detection, stop, take me to a location, or start tutorial for help.', true);
        }
    }

    /**
     * Execute actions based on Gemini response
     */
    async executeAction(result) {
        console.log('Executing action:', result);
        
        if (!result.action) {
            this.speak('I could not understand that command.');
            return;
        }
        
        // Update action status
        this.updateActionStatus(result.response || 'Processing command...', 'info');
        
        // Execute the requested action
        switch (result.action) {
            case 'start_detection':
                if (!this.isDetecting) {
                    await this.startDetection();
                    this.updateStatus('Object detection started via voice command', 'success');
                } else {
                    this.speak('Detection is already running', true);
                }
                break;
                
            case 'stop_detection':
            case 'stop':
                if (this.isDetecting) {
                    this.stopDetection();
                    this.updateStatus('Object detection stopped via voice command', 'success');
                } else {
                    this.speak('Detection is not currently running', true);
                }
                break;
                
            case 'navigate':
                console.log('Gemini navigate action:', destination);
                if (destination) {
                    await this.navigateToLocation(destination);
                } else {
                    this.speak('I need a destination to navigate to. Available locations are: library, stairs, canteen, entrance, bathroom, office', true);
                }
                break;
                
            case 'preview_route':
                console.log('Gemini preview action:', destination);
                if (destination) {
                    await this.previewRoute(destination);
                } else {
                    this.speak('I need a destination to preview the route', true);
                }
                break;
                
            case 'stop_navigation':
                console.log('Gemini stop navigation action');
                this.stopNavigation();
                break;
                
            case 'enable_location':
                await this.requestLocation();
                break;
                
            case 'change_language':
                if (language && this.languages[language]) {
                    this.changeLanguage(language);
                } else {
                    this.speak('Language not supported', true);
                }
                break;
                
            case 'get_location':
                if (this.userLocation) {
                    this.speak(`You are currently at latitude ${this.userLocation.latitude.toFixed(4)}, longitude ${this.userLocation.longitude.toFixed(4)}`, true);
                } else {
                    this.speak('Location not available. Please enable location services first.', true);
                }
                break;
                
            default:
                console.log('Unknown action:', action);
                if (!response) {
                    this.speak('I understood your command but could not perform the action.', true);
                }
        }
    }

    /**
     * Navigate to a predefined location
     */
    async navigateToLocation(destination) {
        console.log('navigateToLocation called with:', destination);
        
        if (!this.userLocation) {
            this.speak('Location access is required for navigation. Please enable location first.', true);
            await this.requestLocation();
            if (!this.userLocation) {
                return;
            }
        }
        
        // Normalize destination name and try different variations
        const destKey = destination.toLowerCase().trim();
        console.log('Looking for location:', destKey);
        console.log('Available locations:', Object.keys(this.locations));
        
        let location = this.locations[destKey];
        
        // Try fuzzy matching for common variations
        if (!location) {
            const locationKeys = Object.keys(this.locations);
            const match = locationKeys.find(key => 
                key.includes(destKey) || 
                destKey.includes(key) ||
                this.locations[key].name.toLowerCase().includes(destKey)
            );
            if (match) {
                location = this.locations[match];
                console.log('Found fuzzy match:', match, location);
            }
        }
        
        if (!location) {
            const availableLocations = Object.keys(this.locations).join(', ');
            this.speak(`I don't know that location. Available locations are: ${availableLocations}`, true);
            console.log('No location found for:', destKey);
            return;
        }
        
        try {
            this.updateStatus(`Getting directions to ${location.name}...`, 'primary');
            this.speak(`Getting directions to ${location.name}`, true);
            
            console.log('User location:', this.userLocation);
            console.log('Destination:', location);
            
            // Get directions from Google Maps API
            const route = await this.getDirections(
                this.userLocation.latitude, 
                this.userLocation.longitude,
                location.lat,
                location.lng
            );
            
            console.log('Route received:', route);
            
            if (route) {
                this.currentRoute = route;
                this.currentStepIndex = 0;
                this.isNavigating = true;
                
                // Update navigation status
                if (this.elements.navigationStatus) {
                    this.elements.navigationStatus.textContent = 'Navigating';
                    this.elements.navigationStatus.className = 'badge bg-success';
                }
                
                // Speak route overview
                await this.speakRouteOverview(route, location.name);
                
                // Start position tracking for rerouting
                this.startLocationTracking();
                
                this.updateStatus(`Navigating to ${location.name}`, 'success');
            } else {
                this.speak(`Could not get directions to ${location.name}. Please try again.`, true);
            }
            
        } catch (error) {
            console.error('Navigation error:', error);
            this.speak(`Sorry, I couldn't get directions to ${location.name}. Please try again.`, true);
        }
    }
    
    /**
     * Preview route to destination without starting navigation
     */
    async previewRoute(destination) {
        console.log('previewRoute called with:', destination);
        
        if (!this.userLocation) {
            this.speak('Location access is required for route preview. Please enable location first.', true);
            await this.requestLocation();
            if (!this.userLocation) {
                return;
            }
        }
        
        // Normalize destination name and try different variations
        const destKey = destination.toLowerCase().trim();
        let location = this.locations[destKey];
        
        // Try fuzzy matching for common variations
        if (!location) {
            const locationKeys = Object.keys(this.locations);
            const match = locationKeys.find(key => 
                key.includes(destKey) || 
                destKey.includes(key) ||
                this.locations[key].name.toLowerCase().includes(destKey)
            );
            if (match) {
                location = this.locations[match];
            }
        }
        
        if (!location) {
            const availableLocations = Object.keys(this.locations).join(', ');
            this.speak(`I don't know that location. Available locations are: ${availableLocations}`, true);
            return;
        }
        
        try {
            this.updateStatus(`Previewing route to ${location.name}...`, 'primary');
            
            const route = await this.getDirections(
                this.userLocation.latitude,
                this.userLocation.longitude, 
                location.lat,
                location.lng
            );
            
            if (route) {
                await this.speakRoutePreview(route, location.name);
                this.updateStatus(`Route preview completed for ${location.name}`, 'success');
            }
            
        } catch (error) {
            console.error('Route preview error:', error);
            this.speak(`Sorry, I couldn't preview the route to ${location.name}`, true);
        }
    }
    
    /**
     * Get directions from Google Maps API
     */
    async getDirections(originLat, originLng, destLat, destLng) {
        try {
            // Use backend proxy to avoid exposing API key
            const response = await fetch('/api/directions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    origin: `${originLat},${originLng}`,
                    destination: `${destLat},${destLng}`,
                    mode: 'walking'
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.status === 'OK' && data.routes && data.routes.length > 0) {
                return data.routes[0];
            } else {
                throw new Error('No routes found');
            }
            
        } catch (error) {
            console.error('Directions API error:', error);
            // Fallback: calculate straight-line distance and basic directions
            return this.getFallbackDirections(originLat, originLng, destLat, destLng);
        }
    }
    
    /**
     * Fallback directions when API is unavailable
     */
    getFallbackDirections(originLat, originLng, destLat, destLng) {
        const distance = this.calculateDistance(originLat, originLng, destLat, destLng);
        const bearing = this.calculateBearing(originLat, originLng, destLat, destLng);
        const direction = this.getDirectionFromBearing(bearing);
        
        return {
            legs: [{
                distance: { text: `${Math.round(distance)} meters`, value: distance },
                duration: { text: `${Math.round(distance / 1.4)} minutes`, value: Math.round(distance / 1.4) * 60 },
                steps: [{
                    distance: { text: `${Math.round(distance)} meters`, value: distance },
                    duration: { text: `${Math.round(distance / 1.4)} minutes`, value: Math.round(distance / 1.4) * 60 },
                    html_instructions: `Walk ${direction} for ${Math.round(distance)} meters`,
                    start_location: { lat: originLat, lng: originLng },
                    end_location: { lat: destLat, lng: destLng }
                }]
            }]
        };
    }
    
    /**
     * Speak route overview when starting navigation
     */
    async speakRouteOverview(route, destinationName) {
        const leg = route.legs[0];
        const totalDistance = leg.distance.text;
        const totalTime = leg.duration.text;
        
        this.speak(`You are ${totalDistance} from ${destinationName}. Estimated walking time: ${totalTime}`, true);
        
        // Speak first 2-3 steps
        const steps = leg.steps.slice(0, 3);
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const instruction = this.cleanHtmlInstructions(step.html_instructions);
            
            setTimeout(() => {
                this.speak(`Step ${i + 1}: ${instruction}`, true);
            }, (i + 1) * 3000);
        }
    }
    
    /**
     * Speak route preview (first few steps only)
     */
    async speakRoutePreview(route, destinationName) {
        const leg = route.legs[0];
        const totalDistance = leg.distance.text;
        const totalTime = leg.duration.text;
        
        this.speak(`Route preview to ${destinationName}: ${totalDistance}, about ${totalTime} walking`, true);
        
        setTimeout(() => {
            if (leg.steps.length > 0) {
                const firstStep = this.cleanHtmlInstructions(leg.steps[0].html_instructions);
                this.speak(`First step: ${firstStep}`, true);
            }
        }, 2000);
        
        if (leg.steps.length > 1) {
            setTimeout(() => {
                const secondStep = this.cleanHtmlInstructions(leg.steps[1].html_instructions);
                this.speak(`Then: ${secondStep}`, true);
            }, 4000);
        }
    }
    
    /**
     * Clean HTML instructions from Google Maps API
     */
    cleanHtmlInstructions(htmlInstructions) {
        return htmlInstructions
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
            .replace(/&amp;/g, '&') // Replace HTML entities
            .trim();
    }
    
    /**
     * Start location tracking for rerouting
     */
    startLocationTracking() {
        if (!navigator.geolocation) {
            console.warn('Geolocation not supported for tracking');
            return;
        }
        
        // Watch position every 5 seconds
        this.locationWatcher = navigator.geolocation.watchPosition(
            (position) => {
                this.checkRouteDeviation(position.coords.latitude, position.coords.longitude);
            },
            (error) => {
                console.error('Location tracking error:', error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 5000
            }
        );
    }
    
    /**
     * Check if user has deviated from the route
     */
    checkRouteDeviation(currentLat, currentLng) {
        if (!this.isNavigating || !this.currentRoute) return;
        
        const currentStep = this.currentRoute.legs[0].steps[this.currentStepIndex];
        if (!currentStep) return;
        
        // Calculate distance to expected route point
        const expectedLat = currentStep.start_location.lat;
        const expectedLng = currentStep.start_location.lng;
        const deviation = this.calculateDistance(currentLat, currentLng, expectedLat, expectedLng);
        
        // If user is too far off track, reroute
        if (deviation > this.routeDeviationThreshold) {
            this.speak('You have moved off the path. Recalculating route...', true);
            this.reroute(currentLat, currentLng);
        }
    }
    
    /**
     * Reroute from current position
     */
    async reroute(currentLat, currentLng) {
        if (!this.isNavigating) return;
        
        // Find the destination from current route
        const originalDestination = this.currentRoute.legs[0].end_location;
        
        try {
            const newRoute = await this.getDirections(
                currentLat, currentLng,
                originalDestination.lat, originalDestination.lng
            );
            
            if (newRoute) {
                this.currentRoute = newRoute;
                this.currentStepIndex = 0;
                
                const leg = newRoute.legs[0];
                this.speak(`New route calculated. ${leg.distance.text} remaining.`, true);
                
                // Speak next instruction
                if (leg.steps.length > 0) {
                    setTimeout(() => {
                        const instruction = this.cleanHtmlInstructions(leg.steps[0].html_instructions);
                        this.speak(instruction, true);
                    }, 2000);
                }
            }
        } catch (error) {
            console.error('Rerouting error:', error);
            this.speak('Could not recalculate route. Please use your navigation app.', true);
        }
    }
    
    /**
     * Stop navigation and location tracking
     */
    stopNavigation() {
        this.isNavigating = false;
        this.currentRoute = null;
        this.currentStepIndex = 0;
        
        if (this.locationWatcher) {
            navigator.geolocation.clearWatch(this.locationWatcher);
            this.locationWatcher = null;
        }
        
        this.speak('Navigation stopped', true);
        this.updateStatus('Navigation stopped', 'info');
        
        // Update navigation status
        this.elements.navigationStatus.textContent = 'Ready';
        this.elements.navigationStatus.className = 'badge bg-secondary';
    }
    
    /**
     * Calculate distance between two points in meters
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
        
        return R * c;
    }
    
    /**
     * Calculate bearing between two points
     */
    calculateBearing(lat1, lng1, lat2, lng2) {
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δλ = (lng2 - lng1) * Math.PI / 180;
        
        const y = Math.sin(Δλ) * Math.cos(φ2);
        const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
        
        const θ = Math.atan2(y, x);
        return (θ * 180 / Math.PI + 360) % 360;
    }
    
    /**
     * Get direction name from bearing
     */
    getDirectionFromBearing(bearing) {
        const directions = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
        const index = Math.round(bearing / 45) % 8;
        return directions[index];
    }

    /**
     * Provide basic navigation assistance
     */
    provideNavigationGuidance(destination) {
        const guidance = [
            `I'm helping you navigate to ${destination}.`,
            "Since I opened navigation in your maps app, please follow the turn-by-turn directions there.",
            "You can still use voice commands with me:",
            "Say 'start detection' to scan for obstacles while walking.",
            "Say 'stop' to pause any features.",
            "Stay safe and be aware of your surroundings."
        ];
        
        guidance.forEach((message, index) => {
            setTimeout(() => this.speak(message), index * 3000);
        });
    }

    /**
     * Request user location
     */
    async requestLocation() {
        try {
            this.updateStatus('Requesting location access...', 'warning');
            
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000
                });
            });
            
            this.userLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };
            
            this.updateStatus('Location access granted.', 'success');
            this.elements.locationBtn.className = 'btn btn-success btn-lg';
            this.elements.locationBtn.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Location Enabled';
            
            this.speak('Location access granted. I can now provide navigation assistance.');
            
        } catch (error) {
            console.error('Location error:', error);
            this.updateStatus('Location access denied.', 'danger');
            this.speak('Location access is required for navigation features. Please enable location in your browser settings.');
        }
    }

    /**
     * Change application language
     */
    changeLanguage(langCode) {
        if (!this.languages[langCode]) {
            return;
        }
        
        this.currentLanguage = langCode;
        this.elements.languageSelect.value = langCode;
        
        if (this.recognition) {
            this.recognition.lang = langCode;
        }
        
        const langName = this.languages[langCode].name;
        this.speak(`Language changed to ${langName}`);
    }

    /**
     * Text-to-speech function with queue management and cooldown
     */
    speak(text, priority = false) {
        if (!this.synth || !text) {
            return;
        }

        const now = Date.now();
        
        // If high priority or enough time has passed since last speech
        if (priority || (now - this.lastSpeechTime > this.speechCooldown && !this.isSpeaking)) {
            this._speakNow(text);
        } else if (!priority) {
            // Add to queue for non-priority speech
            this.speechQueue.push(text);
            if (!this.isSpeaking) {
                this._processNextSpeech();
            }
        }
    }
    
    /**
     * Internal function to speak immediately
     */
    _speakNow(text) {
        try {
            // Cancel any ongoing speech
            this.synth.cancel();
            this.isSpeaking = true;
            this.lastSpeechTime = Date.now();
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = this.currentLanguage;
            utterance.rate = 0.8;
            utterance.pitch = 1;
            utterance.volume = 0.8;
            
            // Find appropriate voice
            const voices = this.synth.getVoices();
            if (voices.length > 0) {
                const voice = voices.find(v => v.lang === this.currentLanguage) || 
                             voices.find(v => v.lang.startsWith(this.currentLanguage.split('-')[0])) ||
                             voices.find(v => v.default);
                
                if (voice) {
                    utterance.voice = voice;
                }
            }
            
            utterance.onend = () => {
                this.isSpeaking = false;
                setTimeout(() => this._processNextSpeech(), 500);
            };
            
            utterance.onerror = () => {
                this.isSpeaking = false;
                setTimeout(() => this._processNextSpeech(), 500);
            };
            
            this.synth.speak(utterance);
            
        } catch (error) {
            this.isSpeaking = false;
            console.warn('Speech error:', error);
        }
    }
    
    /**
     * Process next item in speech queue
     */
    _processNextSpeech() {
        if (this.speechQueue.length > 0 && !this.isSpeaking) {
            const text = this.speechQueue.shift();
            this._speakNow(text);
        }
    }

    /**
     * Check if this is a first-time user and offer tutorial
     */
    checkFirstTimeUser() {
        const hasCompletedTutorial = localStorage.getItem('blindmate_tutorial_completed');
        const hasUsedApp = localStorage.getItem('blindmate_first_use');
        
        if (!hasCompletedTutorial && !hasUsedApp) {
            // Mark that the user has seen the app
            localStorage.setItem('blindmate_first_use', 'true');
            
            // Wait a moment for the interface to load, then offer tutorial
            setTimeout(() => {
                this.speak('Welcome to BlindMate! This is your first time using the app. Would you like to start with a guided tutorial to learn all the features? You can also access the tutorial anytime by saying "start tutorial" or clicking the tutorial button.');
                
                // Show tutorial button prominently
                const tutorialButton = document.getElementById('tutorialButton');
                if (tutorialButton) {
                    tutorialButton.classList.add('btn-warning');
                    tutorialButton.innerHTML = '<i class="fas fa-graduation-cap"></i> Recommended: Start Tutorial';
                }
            }, 2000);
        }
    }

    /**
     * Update system status display
     */
    updateStatus(message, type = 'info') {
        if (this.elements && this.elements.systemStatus) {
            this.elements.systemStatus.textContent = message;
            this.elements.systemStatus.className = `alert alert-${type}`;
            
            // Auto-clear success and warning messages
            if (type === 'success' || type === 'warning') {
                setTimeout(() => {
                    if (this.elements.systemStatus && this.elements.systemStatus.textContent === message) {
                        this.updateStatus('System ready', 'info');
                    }
                }, 5000);
            }
        } else {
            console.log('Status update:', message, type);
        }
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.blindMate = new BlindMate();
});

// Handle page visibility changes to pause/resume detection
document.addEventListener('visibilitychange', () => {
    if (window.blindMate) {
        if (document.hidden && window.blindMate.isDetecting) {
            // Pause detection when page is hidden
            window.blindMate.isDetecting = false;
        } else if (!document.hidden && window.blindMate.stream) {
            // Resume detection when page becomes visible
            window.blindMate.isDetecting = true;
            window.blindMate.detectObjects();
        }
    }
});
