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
        this.currentTone = 'friendly';
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
            toneSelect: document.getElementById('toneSelect'),
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
        
        // Smart object announcement tracking system
        this.objectAnnouncementCount = new Map(); // Track how many times each object was announced
        this.objectLastSeen = new Map(); // Track when each object was last seen
        this.objectDisappearanceTime = new Map(); // Track when object disappeared
        this.maxAnnouncements = 3; // Maximum announcements per object
        this.cooldownPeriod = 7000; // 7 seconds cooldown after object disappears
        this.lastSpeechTime = 0;
        this.speechCooldown = 2000; // 2 seconds cooldown between speech
        this.isSpeaking = false;
        this.speechQueue = [];
        
        // Enhanced speech delay configuration for object announcements
        this.speechDelayTimer = null; // Timer for delaying speech
        this.minObjectAnnouncementDelay = 1500; // 1.5 second minimum delay between object announcements
        this.pendingAnnouncement = null; // Store pending announcement
        this.isAnnouncementDelayed = false; // Flag to track if announcement is delayed
        
        // Navigation settings
        this.isNavigating = false;
        this.currentRoute = null;
        this.currentStepIndex = 0;
        this.locationWatcher = null;
        this.routeDeviationThreshold = 15; // meters
        
        // Wake word detection
        this.isListeningForWakeWord = true;
        this.wakeWords = ['hey blindmate', 'hey blind mate', 'blindmate'];
        this.continuousRecognition = null;
        
        // Volume key detection
        this.volumeUpPressed = false;
        this.volumeKeyTimeout = null;
        
        // Mobile double-tap gesture detection
        this.lastTapTime = 0;
        this.tapTimeout = null;
        this.doubleTapDelay = 400; // milliseconds between taps (increased for better detection)
        this.isMobileDevice = this.detectMobileDevice();
        console.log('Mobile device detected:', this.isMobileDevice, {
            userAgent: navigator.userAgent,
            ontouchstart: 'ontouchstart' in window,
            maxTouchPoints: navigator.maxTouchPoints
        });
        
        this.init();
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
        // This function is deprecated - all destinations now go through Google Geocoding API
        // Return null to force use of the enhanced navigation system
        return null;
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
            
            // Load user preferences and check if this is a first-time user
            await this.loadServerPreferences();
            this.checkFirstTimeUser();
            
            // Initialize DOM elements first
            this.initDOMElements();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize speech recognition
            this.initSpeechRecognition();
            
            // Load TensorFlow model (optional - app works without it)
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
            toneSelect: document.getElementById('toneSelect'),
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

        // Ensure all critical elements exist
        this.validateElements();
    }

    /**
     * Validate that essential elements exist and create fallbacks if needed
     */
    validateElements() {
        const requiredElements = ['video', 'canvas', 'startBtn', 'stopBtn', 'voiceBtn', 'locationBtn', 'languageSelect', 'toneSelect', 'systemStatus'];
        
        for (const elementKey of requiredElements) {
            if (!this.elements[elementKey]) {
                console.warn(`Missing element: ${elementKey}`);
                
                // Create fallback element to prevent crashes
                if (elementKey === 'systemStatus') {
                    this.elements[elementKey] = this.createStatusElement();
                }
            }
        }
    }

    /**
     * Create fallback status element
     */
    createStatusElement() {
        const statusDiv = document.createElement('div');
        statusDiv.className = 'alert alert-info';
        statusDiv.textContent = 'System ready';
        return statusDiv;
    }

    /**
     * Detect if device is mobile
     */
    detectMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
               ('ontouchstart' in window) || 
               (navigator.maxTouchPoints > 0);
    }

    /**
     * Setup mobile double-tap gesture detection
     */
    setupMobileDoubleTap() {
        let firstTapTime = 0;
        let tapCount = 0;
        let tapTimeout = null;
        
        console.log('Setting up mobile double-tap gesture detection...');
        
        // Add touch event listener to entire document for full-screen double-tap
        document.addEventListener('touchend', (e) => {
            const currentTime = Date.now();
            
            // Clear existing timeout
            if (tapTimeout) {
                clearTimeout(tapTimeout);
                tapTimeout = null;
            }
            
            // Prevent interference with UI elements that need single taps
            const target = e.target;
            const isUIElement = target.tagName === 'BUTTON' || 
                              target.tagName === 'SELECT' || 
                              target.tagName === 'INPUT' ||
                              target.closest('button') || 
                              target.closest('select') ||
                              target.closest('input') ||
                              target.closest('.btn') ||
                              target.id.includes('Btn') ||
                              target.className.includes('btn') ||
                              target.classList.contains('form-control') ||
                              target.classList.contains('form-select');
            
            // Skip double-tap detection on UI elements
            if (isUIElement) {
                console.log('Tap on UI element ignored:', target.tagName, target.id || target.className);
                return;
            }
            
            tapCount++;
            
            if (tapCount === 1) {
                // First tap
                firstTapTime = currentTime;
                
                // Set timeout to reset tap count if no second tap
                tapTimeout = setTimeout(() => {
                    tapCount = 0;
                    firstTapTime = 0;
                    console.log('Double-tap timeout - single tap detected');
                }, this.doubleTapDelay);
                
                console.log('First tap detected, waiting for second tap...');
                
            } else if (tapCount === 2) {
                // Second tap - check if within double-tap delay
                const timeDiff = currentTime - firstTapTime;
                
                if (timeDiff <= this.doubleTapDelay) {
                    // Double-tap detected!
                    e.preventDefault(); // Prevent default zoom behavior
                    e.stopPropagation(); // Stop event bubbling
                    
                    console.log(`Double-tap detected! Time difference: ${timeDiff}ms`);
                    
                    // Provide immediate feedback
                    navigator.vibrate && navigator.vibrate(50); // Short vibration if available
                    this.speak('Listening started');
                    
                    // Call the same function as voice command button
                    setTimeout(() => {
                        this.startVoiceCommand();
                    }, 100); // Small delay to ensure speech starts first
                    
                    // Reset counters
                    tapCount = 0;
                    firstTapTime = 0;
                } else {
                    // Too slow, treat as new first tap
                    tapCount = 1;
                    firstTapTime = currentTime;
                    
                    tapTimeout = setTimeout(() => {
                        tapCount = 0;
                        firstTapTime = 0;
                    }, this.doubleTapDelay);
                    
                    console.log('Second tap too slow, treating as new first tap');
                }
            }
        }, { passive: false });
        
        // Also add touchstart to prevent default behaviors during double-tap
        document.addEventListener('touchstart', (e) => {
            // Only prevent default on non-UI elements during potential double-tap
            const target = e.target;
            const isUIElement = target.tagName === 'BUTTON' || 
                              target.tagName === 'SELECT' || 
                              target.tagName === 'INPUT' ||
                              target.closest('button') || 
                              target.closest('select') ||
                              target.closest('input') ||
                              target.closest('.btn') ||
                              target.id.includes('Btn') ||
                              target.className.includes('btn');
            
            if (!isUIElement && tapCount === 1) {
                // During potential double-tap sequence, prevent default behaviors
                e.preventDefault();
            }
        }, { passive: false });
        
        console.log('Mobile double-tap gesture enabled for voice commands with improved detection');
        
        // Add visual hint for mobile users
        this.addMobileHint();
    }

    /**
     * Add visual hint for mobile double-tap feature
     */
    addMobileHint() {
        // Create hint element
        const hintElement = document.createElement('div');
        hintElement.id = 'mobileHint';
        hintElement.className = 'alert alert-info mobile-hint';
        hintElement.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 1000;
            background: rgba(0, 123, 255, 0.9);
            color: white;
            padding: 10px 20px;
            border-radius: 25px;
            font-size: 14px;
            text-align: center;
            animation: fadeInOut 4s ease-in-out;
            pointer-events: none;
        `;
        hintElement.innerHTML = '💡 Double-tap anywhere to start voice commands';
        
        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
                15% { opacity: 1; transform: translateX(-50%) translateY(0); }
                85% { opacity: 1; transform: translateX(-50%) translateY(0); }
                100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            }
        `;
        document.head.appendChild(style);
        
        // Add to page
        document.body.appendChild(hintElement);
        
        // Remove after animation
        setTimeout(() => {
            if (hintElement.parentNode) {
                hintElement.parentNode.removeChild(hintElement);
            }
        }, 4000);
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
        // Add event listeners with null checks
        if (this.elements.startBtn) {
            this.elements.startBtn.addEventListener('click', () => this.startDetection());
        }
        if (this.elements.stopBtn) {
            this.elements.stopBtn.addEventListener('click', () => this.stopDetection());
        }
        if (this.elements.voiceBtn) {
            this.elements.voiceBtn.addEventListener('click', () => this.startVoiceCommand());
        }
        if (this.elements.locationBtn) {
            this.elements.locationBtn.addEventListener('click', () => this.requestLocation());
        }
        if (this.elements.languageSelect) {
            this.elements.languageSelect.addEventListener('change', (e) => this.changeLanguage(e.target.value));
        }
        if (this.elements.toneSelect) {
            this.elements.toneSelect.addEventListener('change', (e) => this.changeTone(e.target.value));
        }
        
        // Mobile double-tap gesture for voice commands
        console.log('Checking mobile device for double-tap setup:', this.isMobileDevice);
        if (this.isMobileDevice) {
            this.setupMobileDoubleTap();
        } else {
            console.log('Desktop device - double-tap not enabled');
        }
        
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
            
            // Check if TensorFlow.js is available
            if (typeof tf === 'undefined') {
                throw new Error('TensorFlow.js not loaded');
            }
            
            // Set backend to CPU if WebGL is not available
            if (!tf.ENV.getBool('WEBGL_VERSION')) {
                console.warn('WebGL not available, falling back to CPU backend');
                await tf.setBackend('cpu');
            }
            
            // Ensure TensorFlow.js is ready
            await tf.ready();
            
            // Check if COCO-SSD is available
            if (typeof cocoSsd === 'undefined') {
                throw new Error('COCO-SSD model not loaded');
            }
            
            // Load COCO-SSD model
            this.model = await cocoSsd.load();
            
            this.updateStatus('AI model loaded successfully!', 'success');
            if (this.elements.loadingOverlay) {
                this.elements.loadingOverlay.style.display = 'none';
            }
            
            console.log('COCO-SSD model loaded successfully');
            
        } catch (error) {
            console.error('Error loading model:', error);
            this.updateStatus('Object detection disabled. Voice commands and navigation still available.', 'warning');
            
            // Hide loading overlay even on error
            if (this.elements.loadingOverlay) {
                this.elements.loadingOverlay.style.display = 'none';
            }
            
            // Don't throw error - allow app to continue without object detection
            console.log('Continuing without object detection...');
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
            this.updateStatus('Camera unavailable. Voice commands and navigation are still active.', 'warning');
            this.speak('Camera is not available, but voice commands and navigation are ready to use.');
        }
    }

    /**
     * Stop object detection
     */
    stopDetection() {
        this.isDetecting = false;
        
        // Clean up speech delay timer
        if (this.speechDelayTimer) {
            clearTimeout(this.speechDelayTimer);
            this.speechDelayTimer = null;
        }
        this.pendingAnnouncement = null;
        this.isAnnouncementDelayed = false;
        
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
                
                // Update object tracking and announce with smart system
                this.updateObjectTracking(validPredictions);
                this.announceDetectionsSmart(validPredictions);
            } else {
                // No objects detected, update tracking for disappearances
                this.updateObjectTracking([]);
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
    /**
     * Update object tracking system for smart announcements
     */
    updateObjectTracking(predictions) {
        const now = Date.now();
        const currentDetectedObjects = new Set();
        
        // Extract object names from current predictions
        predictions.forEach(prediction => {
            currentDetectedObjects.add(prediction.class);
        });
        
        // Update last seen time for currently detected objects
        for (const objectName of currentDetectedObjects) {
            this.objectLastSeen.set(objectName, now);
            
            // Remove from disappearance tracking if it reappeared
            if (this.objectDisappearanceTime.has(objectName)) {
                this.objectDisappearanceTime.delete(objectName);
            }
        }
        
        // Check for disappeared objects and mark their disappearance time
        for (const [objectName, lastSeenTime] of this.objectLastSeen.entries()) {
            if (!currentDetectedObjects.has(objectName) && !this.objectDisappearanceTime.has(objectName)) {
                // Object just disappeared, mark the time
                this.objectDisappearanceTime.set(objectName, now);
            }
        }
        
        // Clean up objects that have been gone for longer than cooldown period
        for (const [objectName, disappearanceTime] of this.objectDisappearanceTime.entries()) {
            if (now - disappearanceTime > this.cooldownPeriod) {
                // Reset announcement count for objects that have been gone long enough
                this.objectAnnouncementCount.delete(objectName);
                this.objectLastSeen.delete(objectName);
                this.objectDisappearanceTime.delete(objectName);
            }
        }
    }

    /**
     * Smart announcement system with 3-announcement limit and cooldown
     */
    announceDetectionsSmart(predictions) {
        const now = Date.now();
        
        // Respect global announcement cooldown
        if (now - this.lastAnnouncement < this.announcementInterval) {
            return;
        }
        
        // Priority objects (most important for navigation)
        const priorityObjects = ['person', 'chair', 'car', 'truck', 'bus', 'bicycle', 'motorcycle'];
        
        // Filter predictions that can be announced based on smart tracking
        const announcablePredictions = predictions.filter(prediction => {
            const announcementCount = this.objectAnnouncementCount.get(prediction.class) || 0;
            
            if (announcementCount >= this.maxAnnouncements) {
                return false; // Already announced 3 times
            }
            
            // Check if object was missing and came back (reset scenario)
            const disappearanceTime = this.objectDisappearanceTime.get(prediction.class);
            if (disappearanceTime && (now - disappearanceTime) < this.cooldownPeriod) {
                return false; // Object reappeared too quickly, don't announce
            }
            
            return true;
        });
        
        if (announcablePredictions.length === 0) {
            // Debug: Show why objects weren't announced
            predictions.forEach(prediction => {
                const count = this.objectAnnouncementCount.get(prediction.class) || 0;
                const disappearanceTime = this.objectDisappearanceTime.get(prediction.class);
                const timeSinceDisappearance = disappearanceTime ? (now - disappearanceTime) : null;
                
                if (count >= this.maxAnnouncements) {
                    console.log(`${prediction.class}: Max announcements reached (${count}/${this.maxAnnouncements})`);
                } else if (timeSinceDisappearance !== null && timeSinceDisappearance < this.cooldownPeriod) {
                    console.log(`${prediction.class}: In cooldown (${Math.round(timeSinceDisappearance/1000)}s/${Math.round(this.cooldownPeriod/1000)}s)`);
                }
            });
            return; // No objects to announce
        }
        
        // Sort predictions by priority and distance
        const sortedPredictions = announcablePredictions.sort((a, b) => {
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
            // Increment announcement count for announced objects
            importantObjects.forEach(prediction => {
                const currentCount = this.objectAnnouncementCount.get(prediction.class) || 0;
                this.objectAnnouncementCount.set(prediction.class, currentCount + 1);
                
                // Debug logging for smart announcement system
                console.log(`Smart Announcement: ${prediction.class} (count: ${currentCount + 1}/${this.maxAnnouncements})`);
            });
            
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
            
            this.speak(announcement, false, true); // Mark as object announcement for special delay handling
            this.lastAnnouncement = now;
        }
    }

    /**
     * Legacy announcement method for backwards compatibility
     */
    announceDetections(predictions) {
        // Redirect to smart announcement system
        this.announceDetectionsSmart(predictions);
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
                    language: this.currentLanguage,
                    tone: this.currentTone
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
                this.speak('Where would you like to go? Please say the name of any place, landmark, or address.', true);
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
                console.log('Gemini navigate action:', result.destination);
                if (result.destination) {
                    await this.navigateToLocation(result.destination);
                } else {
                    this.speak('I need a destination to navigate to. Please say the name of any place, landmark, or address.', true);
                }
                break;
                
            case 'preview_route':
                console.log('Gemini preview action:', result.destination);
                if (result.destination) {
                    await this.previewRoute(result.destination);
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
                if (result.language) {
                    this.changeLanguage(result.language);
                } else {
                    this.speak('Language not supported', true);
                }
                break;
                
            case 'change_tone':
                if (result.tone) {
                    this.changeTone(result.tone);
                } else {
                    this.speak('Tone not supported', true);
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
     * Navigate to any worldwide destination using Google APIs
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
        
        try {
            this.updateStatus(`Getting directions to ${destination}...`, 'primary');
            this.speak(`Getting directions to ${destination}`, true);
            
            console.log('User location:', this.userLocation);
            console.log('Destination:', destination);
            
            // Use the enhanced navigation system that handles geocoding + directions
            if (window.blindMateNavigation) {
                // Use the enhanced navigation system
                window.blindMateNavigation.currentDestination = destination;
                await window.blindMateNavigation.startNavigation(destination);
            } else {
                // Fallback to direct API call
                const response = await fetch('/api/directions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        origin: `${this.userLocation.latitude},${this.userLocation.longitude}`,
                        destination: destination
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    this.currentRoute = data;
                    this.currentStepIndex = 0;
                    this.isNavigating = true;
                    
                    // Update navigation status
                    if (this.elements.navigationStatus) {
                        this.elements.navigationStatus.textContent = 'Navigating';
                        this.elements.navigationStatus.className = 'badge bg-success';
                    }
                    
                    // Speak route overview
                    await this.speakRouteOverview(data, destination);
                    
                    // Start position tracking for rerouting
                    this.startLocationTracking();
                    
                    this.updateStatus(`Navigating to ${destination}`, 'success');
                } else {
                    this.speak(data.message || `Could not get directions to ${destination}. Please try again.`, true);
                }
            }
            
        } catch (error) {
            console.error('Navigation error:', error);
            this.speak(`Sorry, I couldn't get directions to ${destination}. Please try again.`, true);
        }
    }
    
    /**
     * Preview route to any destination without starting navigation
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
        
        try {
            this.updateStatus(`Previewing route to ${destination}...`, 'primary');
            
            // Use the enhanced navigation system for route preview
            const response = await fetch('/api/directions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    origin: `${this.userLocation.latitude},${this.userLocation.longitude}`,
                    destination: destination
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                await this.speakRoutePreview(data, destination);
                this.updateStatus(`Route preview completed for ${destination}`, 'success');
            } else {
                this.speak(data.message || `Could not get route preview to ${destination}. Please try again.`, true);
            }
            
        } catch (error) {
            console.error('Route preview error:', error);
            this.speak(`Sorry, I couldn't preview the route to ${destination}`, true);
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
        console.log('Changing language to:', langCode);
        
        this.currentLanguage = langCode;
        this.elements.languageSelect.value = langCode;
        
        // Update recognition language
        if (this.commandRecognition) {
            this.commandRecognition.lang = langCode;
        }
        if (this.continuousRecognition) {
            this.continuousRecognition.lang = langCode;
        }
        
        // Update language preference on server
        this.updateServerPreferences();
        
        this.speak(`Language changed to ${this.getLanguageName(langCode)}`);
    }

    /**
     * Change voice tone
     */
    changeTone(tone) {
        console.log('Changing tone to:', tone);
        
        this.currentTone = tone;
        this.elements.toneSelect.value = tone;
        
        // Update tone preference on server
        this.updateServerPreferences();
        
        // Speak confirmation with new tone
        this.speak(`Voice tone changed to ${tone}`, true);
    }

    /**
     * Update preferences on server
     */
    async updateServerPreferences() {
        try {
            await fetch('/api/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    language: this.currentLanguage,
                    tone: this.currentTone
                })
            });
        } catch (error) {
            console.error('Error updating preferences:', error);
        }
    }

    /**
     * Load preferences from server
     */
    async loadServerPreferences() {
        try {
            const response = await fetch('/api/preferences');
            const preferences = await response.json();
            
            if (preferences.language) {
                this.currentLanguage = preferences.language;
                this.elements.languageSelect.value = preferences.language;
            }
            
            if (preferences.tone) {
                this.currentTone = preferences.tone;
                this.elements.toneSelect.value = preferences.tone;
            }
        } catch (error) {
            console.error('Error loading preferences:', error);
        }
    }

    /**
     * Get display name for language code
     */
    getLanguageName(langCode) {
        const languageNames = {
            'en-IN': 'English',
            'hi-IN': 'Hindi',
            'ta-IN': 'Tamil',
            'te-IN': 'Telugu',
            'bn-IN': 'Bengali',
            'mr-IN': 'Marathi',
            'gu-IN': 'Gujarati',
            'es-ES': 'Spanish',
            'fr-FR': 'French',
            'de-DE': 'German',
            'it-IT': 'Italian',
            'pt-PT': 'Portuguese',
            'ja-JP': 'Japanese',
            'zh-CN': 'Chinese',
            'ar-SA': 'Arabic'
        };
        return languageNames[langCode] || langCode;
    }

    /**
     * Get tone-specific voice settings
     */
    getToneSettings(tone) {
        const toneSettings = {
            'friendly': { rate: 0.9, pitch: 1.1, volume: 0.8 },
            'formal': { rate: 0.7, pitch: 0.9, volume: 0.8 },
            'energetic': { rate: 1.1, pitch: 1.2, volume: 0.9 },
            'calm': { rate: 0.6, pitch: 0.8, volume: 0.7 },
            'robotic': { rate: 0.8, pitch: 0.7, volume: 0.8 }
        };
        return toneSettings[tone] || toneSettings['friendly'];
    }

    /**
     * Find appropriate voice for tone
     */
    findVoiceForTone(voices, language, tone) {
        // Try to find voices that match tone characteristics
        const langVoices = voices.filter(v => v.lang === language || v.lang.startsWith(language.split('-')[0]));
        
        if (langVoices.length === 0) return null;
        
        // Different tone preferences for voice selection
        switch (tone) {
            case 'formal':
                return langVoices.find(v => v.name.toLowerCase().includes('professional') || 
                                          v.name.toLowerCase().includes('formal')) || langVoices[0];
            case 'energetic':
                return langVoices.find(v => v.name.toLowerCase().includes('young') || 
                                          v.name.toLowerCase().includes('bright')) || langVoices[0];
            case 'calm':
                return langVoices.find(v => v.name.toLowerCase().includes('calm') || 
                                          v.name.toLowerCase().includes('soft')) || langVoices[0];
            case 'robotic':
                return langVoices.find(v => v.name.toLowerCase().includes('robotic') || 
                                          v.name.toLowerCase().includes('computer')) || langVoices[0];
            default:
                return langVoices[0];
        }
    }

    /**
     * Text-to-speech function with queue management and cooldown
     */
    speak(text, priority = false, isObjectAnnouncement = false) {
        if (!this.synth || !text) {
            return;
        }

        const now = Date.now();
        
        // Handle object announcements with special delay logic
        if (isObjectAnnouncement && !priority) {
            this._handleObjectAnnouncement(text, now);
            return;
        }
        
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
     * Handle object announcements with special delay logic
     */
    _handleObjectAnnouncement(text, now) {
        // Cancel any pending announcement
        if (this.speechDelayTimer) {
            clearTimeout(this.speechDelayTimer);
            this.speechDelayTimer = null;
        }
        
        // Store the pending announcement
        this.pendingAnnouncement = text;
        
        // Calculate delay needed
        const timeSinceLastSpeech = now - this.lastSpeechTime;
        const minimumDelay = this.minObjectAnnouncementDelay;
        
        if (this.isSpeaking || timeSinceLastSpeech < minimumDelay) {
            // Need to delay announcement
            const delayNeeded = this.isSpeaking ? 
                minimumDelay : // Wait full delay if currently speaking
                minimumDelay - timeSinceLastSpeech; // Wait remaining time
                
            this.isAnnouncementDelayed = true;
            
            console.log(`Object announcement delayed by ${delayNeeded}ms for clarity`);
            
            this.speechDelayTimer = setTimeout(() => {
                if (this.pendingAnnouncement) {
                    this._speakNow(this.pendingAnnouncement);
                    this.pendingAnnouncement = null;
                    this.isAnnouncementDelayed = false;
                }
            }, delayNeeded);
        } else {
            // Can announce immediately
            this._speakNow(text);
            this.pendingAnnouncement = null;
        }
    }

    /**
     * Internal function to speak immediately
     */
    _speakNow(text) {
        try {
            // Cancel any ongoing speech immediately to prevent overlaps
            this.synth.cancel();
            
            // Small delay to ensure cancellation is processed
            setTimeout(() => {
                this.isSpeaking = true;
                this.lastSpeechTime = Date.now();
                
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = this.currentLanguage;
                
                // Apply tone-specific voice settings
                const toneSettings = this.getToneSettings(this.currentTone);
                utterance.rate = toneSettings.rate;
                utterance.pitch = toneSettings.pitch;
                utterance.volume = toneSettings.volume;
                
                // Find appropriate voice based on language and tone
                const voices = this.synth.getVoices();
                if (voices.length > 0) {
                    let voice = this.findVoiceForTone(voices, this.currentLanguage, this.currentTone);
                    
                    if (!voice) {
                        voice = voices.find(v => v.lang === this.currentLanguage) || 
                               voices.find(v => v.lang.startsWith(this.currentLanguage.split('-')[0])) ||
                               voices.find(v => v.default);
                    }
                    
                    if (voice) {
                        utterance.voice = voice;
                    }
                }
                
                utterance.onstart = () => {
                    console.log('Speech started successfully');
                };
                
                utterance.onend = () => {
                    console.log('Speech ended normally');
                    this.isSpeaking = false;
                    // Longer delay before next speech for better clarity
                    setTimeout(() => this._processNextSpeech(), 750);
                };
                
                utterance.onerror = (event) => {
                    console.warn('Speech error:', event);
                    this.isSpeaking = false;
                    setTimeout(() => this._processNextSpeech(), 750);
                };
                
                this.synth.speak(utterance);
                
            }, 50); // Small delay to ensure proper cancellation
            
        } catch (error) {
            this.isSpeaking = false;
            console.warn('Speech synthesis error:', error);
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
