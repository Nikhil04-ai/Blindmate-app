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
        
        // Wake word detection
        this.isListeningForWakeWord = true;
        this.wakeWords = ['hey blindmate', 'hey blind mate', 'blindmate'];
        this.continuousRecognition = null;
        
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            this.updateStatus('Initializing BlindMate...', 'info');
            
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
     * Setup all event listeners
     */
    setupEventListeners() {
        this.elements.startBtn.addEventListener('click', () => this.startDetection());
        this.elements.stopBtn.addEventListener('click', () => this.stopDetection());
        this.elements.voiceBtn.addEventListener('click', () => this.startVoiceCommand());
        this.elements.locationBtn.addEventListener('click', () => this.requestLocation());
        this.elements.languageSelect.addEventListener('change', (e) => this.changeLanguage(e.target.value));
        
        // Keyboard shortcuts for accessibility
        document.addEventListener('keydown', (e) => {
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
     * Initialize speech recognition
     */
    initSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = this.currentLanguage;
            
            this.recognition.onstart = () => {
                this.isListening = true;
                this.elements.voiceStatus.style.display = 'block';
                this.elements.voiceBtn.disabled = true;
            };
            
            this.recognition.onresult = (event) => {
                const command = event.results[0][0].transcript.toLowerCase().trim();
                console.log('Voice command received:', command);
                this.processVoiceCommand(command);
            };
            
            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.speak('Sorry, I could not understand your command. Please try again.');
                this.stopListening();
            };
            
            this.recognition.onend = () => {
                this.stopListening();
            };
        } else {
            console.warn('Speech recognition not supported');
            this.elements.voiceBtn.disabled = true;
        }
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
     * Start voice interaction flow with permissions
     */
    startVoiceInteraction() {
        const greeting = this.languages[this.currentLanguage].greeting;
        this.speak(greeting, true); // High priority
        
        // Start continuous listening for wake word
        this.startContinuousListening();
        
        // Wait for user response to greeting
        setTimeout(() => {
            this.setupVoicePermissionFlow();
        }, 3000);
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
     * Start voice command listening
     */
    startVoiceCommand() {
        if (!this.recognition) {
            this.speak('Voice commands are not supported on this device.');
            return;
        }
        
        if (this.isListening) {
            return;
        }
        
        this.recognition.lang = this.currentLanguage;
        this.recognition.start();
    }

    /**
     * Stop voice command listening
     */
    stopListening() {
        this.isListening = false;
        this.elements.voiceStatus.style.display = 'none';
        this.elements.voiceBtn.disabled = false;
    }

    /**
     * Process voice commands
     */
    async processVoiceCommand(command) {
        console.log('Processing command:', command);
        
        try {
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
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to process command');
            }
            
            // Execute the action
            this.executeAction(result);
            
        } catch (error) {
            console.error('Error processing command:', error);
            this.speak('Sorry, I could not process your command. Please try again.');
        }
    }

    /**
     * Execute actions based on Gemini response
     */
    async executeAction(result) {
        const { action, destination, response } = result;
        
        // Speak the response
        if (response) {
            this.speak(response);
        }
        
        switch (action) {
            case 'start_detection':
                if (!this.isDetecting) {
                    await this.startDetection();
                }
                break;
                
            case 'stop_detection':
                if (this.isDetecting) {
                    this.stopDetection();
                }
                break;
                
            case 'navigate':
                if (destination) {
                    await this.startNavigation(destination);
                }
                break;
                
            case 'enable_location':
                await this.requestLocation();
                break;
                
            case 'change_language':
                const lang = result.language;
                if (lang && this.languages[lang]) {
                    this.changeLanguage(lang);
                }
                break;
                
            default:
                console.log('Unknown action:', action);
        }
    }

    /**
     * Start navigation to destination
     */
    async startNavigation(destination) {
        if (!this.userLocation) {
            this.speak('Location access is required for navigation. Please enable location first.');
            await this.requestLocation();
            return;
        }
        
        try {
            this.speak(`I will help you navigate to ${destination}. Opening navigation in your default maps application.`);
            
            // Create navigation URL for default maps app
            const lat = this.userLocation.latitude;
            const lng = this.userLocation.longitude;
            const encodedDestination = encodeURIComponent(destination);
            
            // Try Google Maps first, fallback to Apple Maps, then generic maps
            const googleMapsUrl = `https://www.google.com/maps/dir/${lat},${lng}/${encodedDestination}`;
            const appleMapsUrl = `http://maps.apple.com/?saddr=${lat},${lng}&daddr=${encodedDestination}&dirflg=w`;
            const genericMapsUrl = `https://maps.google.com/maps?q=${encodedDestination}`;
            
            // Open navigation in new tab/window
            const navigationWindow = window.open(googleMapsUrl, '_blank');
            
            if (navigationWindow) {
                this.speak(`Navigation opened in a new window. You can also use voice commands like "next step" while navigating.`);
            } else {
                // Fallback - show directions manually
                this.speak(`Please open your maps application and navigate to ${destination}. Your current location is latitude ${lat.toFixed(4)}, longitude ${lng.toFixed(4)}.`);
            }
            
        } catch (error) {
            console.error('Navigation error:', error);
            this.speak(`I'll help you get to ${destination}. Please open your preferred navigation app and search for this location.`);
        }
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
     * Update system status display
     */
    updateStatus(message, type = 'info') {
        this.elements.systemStatus.textContent = message;
        this.elements.systemStatus.className = `alert alert-${type}`;
        
        // Auto-clear success and warning messages
        if (type === 'success' || type === 'warning') {
            setTimeout(() => {
                if (this.elements.systemStatus.textContent === message) {
                    this.updateStatus('System ready', 'info');
                }
            }, 5000);
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
