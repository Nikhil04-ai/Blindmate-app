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
            loadingOverlay: document.getElementById('loadingOverlay')
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
        this.announcementInterval = 3000; // 3 seconds between announcements
        
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
     * Start voice interaction flow
     */
    startVoiceInteraction() {
        const greeting = this.languages[this.currentLanguage].greeting;
        this.speak(greeting);
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
     * Draw bounding boxes and labels on canvas
     */
    drawPredictions(predictions) {
        predictions.forEach(prediction => {
            const [x, y, width, height] = prediction.bbox;
            
            // Draw bounding box
            this.ctx.strokeStyle = '#00ff00';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(x, y, width, height);
            
            // Draw label background
            this.ctx.fillStyle = '#00ff00';
            this.ctx.fillRect(x, y - 25, width, 25);
            
            // Draw label text
            this.ctx.fillStyle = '#000000';
            this.ctx.font = '16px Arial';
            this.ctx.fillText(
                `${prediction.class} (${Math.round(prediction.score * 100)}%)`,
                x + 5,
                y - 5
            );
        });
    }

    /**
     * Announce detected objects via speech
     */
    announceDetections(predictions) {
        const now = Date.now();
        
        // Throttle announcements
        if (now - this.lastAnnouncement < this.announcementInterval) {
            return;
        }
        
        const objects = predictions.map(p => p.class);
        const uniqueObjects = [...new Set(objects)];
        
        // Calculate distances (simplified estimation based on bounding box size)
        const objectsWithDistance = uniqueObjects.map(objectName => {
            const prediction = predictions.find(p => p.class === objectName);
            const distance = this.estimateDistance(prediction.bbox);
            return { name: objectName, distance };
        });
        
        // Create announcement
        let announcement = 'Objects detected: ';
        objectsWithDistance.forEach((obj, index) => {
            if (index > 0) announcement += ', ';
            announcement += `${obj.name} at ${obj.distance}`;
        });
        
        this.speak(announcement);
        this.lastAnnouncement = now;
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
     * Text-to-speech function with improved error handling
     */
    speak(text) {
        if (!this.synth || !text) {
            console.warn('Speech synthesis not supported or no text provided');
            return;
        }

        try {
            // Cancel any ongoing speech
            this.synth.cancel();
            
            // Wait a moment for cancel to complete
            setTimeout(() => {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = this.currentLanguage;
                utterance.rate = 0.8;
                utterance.pitch = 1;
                utterance.volume = 0.8;
                
                // Wait for voices to be loaded
                const voices = this.synth.getVoices();
                if (voices.length === 0) {
                    // Voices not loaded yet, use default
                    console.log('Using default voice, voices not yet loaded');
                } else {
                    // Try to find appropriate voice
                    const voice = voices.find(v => v.lang === this.currentLanguage) || 
                                 voices.find(v => v.lang.startsWith(this.currentLanguage.split('-')[0])) ||
                                 voices.find(v => v.default);
                    
                    if (voice) {
                        utterance.voice = voice;
                    }
                }
                
                utterance.onerror = (event) => {
                    console.warn('Speech synthesis error (non-critical):', event.error);
                };
                
                utterance.onend = () => {
                    console.log('Speech completed successfully');
                };
                
                // Speak the utterance
                this.synth.speak(utterance);
                
            }, 100);
            
        } catch (error) {
            console.warn('Speech synthesis error:', error);
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
