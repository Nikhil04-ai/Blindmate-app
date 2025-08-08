/**
 * BlindMate Onboarding Tutorial JavaScript
 * Comprehensive tutorial system for first-time users
 */

class OnboardingTutorial {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 8;
        this.audioEnabled = true;
        this.synthesis = window.speechSynthesis;
        this.practiceExercises = [
            {
                title: "Exercise 1: Basic Greeting",
                instruction: "Say 'Hello BlindMate' and wait for a response.",
                expectedResponse: "hello",
                successMessage: "Great! BlindMate recognized your greeting."
            },
            {
                title: "Exercise 2: Object Detection",
                instruction: "Say 'What do you see?' to start object detection.",
                expectedResponse: "see",
                successMessage: "Perfect! You've learned how to ask about your surroundings."
            },
            {
                title: "Exercise 3: Navigation Request",
                instruction: "Say 'Take me to the library' to practice navigation commands.",
                expectedResponse: "library",
                successMessage: "Excellent! You can now request navigation to any location."
            }
        ];
        this.currentExercise = 0;
        this.practiceProgress = 0;
        
        this.init();
    }
    
    init() {
        this.updateProgressIndicator();
        this.initializeSpeechRecognition();
        this.speakCurrentStep();
        
        // Announce tutorial start
        setTimeout(() => {
            this.speak("Welcome to the BlindMate tutorial. This interactive guide will teach you how to use all features safely. You can navigate using the next and previous buttons, or use keyboard shortcuts. Press space for next, or escape to exit the tutorial.");
        }, 1000);
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case ' ':
                case 'ArrowRight':
                    e.preventDefault();
                    this.nextStep();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.previousStep();
                    break;
                case 'Escape':
                    this.exitTutorial();
                    break;
                case 'r':
                case 'R':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.repeatCurrentStep();
                    }
                    break;
            }
        });
    }
    
    initializeSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Speech recognition not available');
            return;
        }
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';
        
        this.recognition.onresult = (event) => {
            const command = event.results[0][0].transcript.toLowerCase().trim();
            this.handleVoiceCommand(command);
        };
        
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
        };
    }
    
    handleVoiceCommand(command) {
        // Tutorial navigation commands
        if (command.includes('next') || command.includes('continue')) {
            this.nextStep();
        } else if (command.includes('previous') || command.includes('back')) {
            this.previousStep();
        } else if (command.includes('repeat')) {
            this.repeatCurrentStep();
        } else if (command.includes('exit') || command.includes('quit')) {
            this.exitTutorial();
        }
        
        // Practice exercise handling
        if (this.currentStep === 7 && this.isPracticing) {
            this.handlePracticeCommand(command);
        }
    }
    
    updateProgressIndicator() {
        const progressDots = document.getElementById('progressDots');
        const progressText = document.getElementById('progressText');
        
        // Create progress dots
        progressDots.innerHTML = '';
        for (let i = 1; i <= this.totalSteps; i++) {
            const dot = document.createElement('div');
            dot.className = 'progress-dot';
            
            if (i < this.currentStep) {
                dot.classList.add('completed');
            } else if (i === this.currentStep) {
                dot.classList.add('active');
            }
            
            progressDots.appendChild(dot);
        }
        
        progressText.textContent = `Step ${this.currentStep} of ${this.totalSteps}`;
    }
    
    showStep(stepNumber) {
        // Hide all steps
        document.querySelectorAll('.step-card').forEach(card => {
            card.classList.remove('active');
        });
        
        // Show current step
        const currentStepCard = document.querySelector(`[data-step="${stepNumber}"]`);
        if (currentStepCard) {
            currentStepCard.classList.add('active');
        }
        
        this.updateProgressIndicator();
        this.updateNavigationButtons();
        
        // Announce step change
        setTimeout(() => {
            this.speakCurrentStep();
        }, 500);
    }
    
    speakCurrentStep() {
        if (!this.audioEnabled) return;
        
        const currentStepCard = document.querySelector(`[data-step="${this.currentStep}"]`);
        if (!currentStepCard) return;
        
        const title = currentStepCard.querySelector('.step-title').textContent;
        const content = currentStepCard.querySelector('.step-content p').textContent;
        
        const announcement = `Step ${this.currentStep} of ${this.totalSteps}: ${title}. ${content}`;
        this.speak(announcement);
    }
    
    nextStep() {
        if (this.currentStep < this.totalSteps) {
            this.currentStep++;
            this.showStep(this.currentStep);
            
            // Special handling for practice step
            if (this.currentStep === 7) {
                this.initializePracticeSession();
            }
        }
    }
    
    previousStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.showStep(this.currentStep);
        }
    }
    
    updateNavigationButtons() {
        const prevButton = document.getElementById('prevButton');
        const nextButton = document.getElementById('nextButton');
        
        prevButton.disabled = this.currentStep === 1;
        
        if (this.currentStep === this.totalSteps) {
            nextButton.innerHTML = '<i class="fas fa-check"></i> Complete';
            nextButton.onclick = () => this.completeTutorial();
        } else {
            nextButton.innerHTML = 'Next <i class="fas fa-chevron-right"></i>';
            nextButton.onclick = () => this.nextStep();
        }
    }
    
    initializePracticeSession() {
        this.currentExercise = 0;
        this.practiceProgress = 0;
        this.updatePracticeExercise();
        
        // Show practice progress
        const practiceProgressDiv = document.getElementById('practiceProgress');
        practiceProgressDiv.style.display = 'block';
    }
    
    updatePracticeExercise() {
        if (this.currentExercise >= this.practiceExercises.length) {
            this.completePracticeSession();
            return;
        }
        
        const exercise = this.practiceExercises[this.currentExercise];
        
        document.getElementById('exerciseTitle').textContent = exercise.title;
        document.getElementById('exerciseInstruction').textContent = exercise.instruction;
        
        const progressBar = document.getElementById('practiceProgressBar');
        const progressPercent = (this.currentExercise / this.practiceExercises.length) * 100;
        progressBar.style.width = `${progressPercent}%`;
        
        document.getElementById('practiceStatus').textContent = `Exercise ${this.currentExercise + 1} of ${this.practiceExercises.length}`;
        
        // Reset practice button
        const practiceButton = document.getElementById('practiceButton');
        practiceButton.innerHTML = '<i class="fas fa-microphone"></i> Start Practice';
        practiceButton.onclick = () => this.startPractice();
        
        this.isPracticing = false;
        
        this.speak(exercise.instruction);
    }
    
    startPractice() {
        if (!this.recognition) {
            this.speak('Speech recognition is not available in your browser.');
            return;
        }
        
        this.isPracticing = true;
        const practiceButton = document.getElementById('practiceButton');
        practiceButton.innerHTML = '<i class="fas fa-stop"></i> Stop Practice';
        practiceButton.onclick = () => this.stopPractice();
        
        document.getElementById('practiceStatus').textContent = 'Listening... Speak now';
        
        this.speak('I\'m listening. Please speak your command now.');
        
        setTimeout(() => {
            try {
                this.recognition.start();
            } catch (error) {
                console.error('Speech recognition error:', error);
                this.speak('Unable to start speech recognition. Please try again.');
                this.stopPractice();
            }
        }, 2000);
    }
    
    stopPractice() {
        this.isPracticing = false;
        if (this.recognition) {
            this.recognition.stop();
        }
        
        const practiceButton = document.getElementById('practiceButton');
        practiceButton.innerHTML = '<i class="fas fa-microphone"></i> Start Practice';
        practiceButton.onclick = () => this.startPractice();
        
        document.getElementById('practiceStatus').textContent = 'Practice stopped';
    }
    
    handlePracticeCommand(command) {
        const exercise = this.practiceExercises[this.currentExercise];
        
        if (command.includes(exercise.expectedResponse)) {
            this.speak(exercise.successMessage);
            document.getElementById('practiceStatus').textContent = 'Success! Moving to next exercise...';
            
            setTimeout(() => {
                this.currentExercise++;
                this.updatePracticeExercise();
            }, 2000);
        } else {
            this.speak('Good try! Let\'s practice that command again. ' + exercise.instruction);
            document.getElementById('practiceStatus').textContent = 'Try again - listen for the instruction';
        }
        
        this.stopPractice();
    }
    
    skipExercise() {
        this.speak('Skipping exercise');
        this.currentExercise++;
        this.updatePracticeExercise();
    }
    
    completePracticeSession() {
        const progressBar = document.getElementById('practiceProgressBar');
        progressBar.style.width = '100%';
        
        document.getElementById('practiceStatus').textContent = 'All exercises completed!';
        document.getElementById('exerciseTitle').textContent = 'Practice Session Complete';
        document.getElementById('exerciseInstruction').textContent = 'Congratulations! You\'ve practiced all the essential BlindMate commands.';
        
        const practiceButton = document.getElementById('practiceButton');
        practiceButton.innerHTML = '<i class="fas fa-check"></i> Practice Complete';
        practiceButton.disabled = true;
        
        this.speak('Excellent work! You\'ve completed all practice exercises and are ready to use BlindMate confidently.');
    }
    
    repeatCurrentStep() {
        this.speakCurrentStep();
    }
    
    toggleAudio() {
        this.audioEnabled = !this.audioEnabled;
        const audioToggle = document.getElementById('audioToggle');
        
        if (this.audioEnabled) {
            audioToggle.innerHTML = '<i class="fas fa-volume-up"></i> Audio On';
            this.speak('Audio enabled');
        } else {
            audioToggle.innerHTML = '<i class="fas fa-volume-mute"></i> Audio Off';
            this.synthesis.cancel();
        }
    }
    
    speak(text, priority = false) {
        if (!this.audioEnabled) return;
        
        if (priority) {
            this.synthesis.cancel();
        }
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.8;
        utterance.pitch = 1;
        utterance.volume = 0.9;
        
        // Use a clear, friendly voice if available
        const voices = this.synthesis.getVoices();
        const englishVoice = voices.find(voice => 
            voice.lang.startsWith('en') && voice.name.includes('Female')
        ) || voices.find(voice => voice.lang.startsWith('en'));
        
        if (englishVoice) {
            utterance.voice = englishVoice;
        }
        
        this.synthesis.speak(utterance);
    }
    
    completeTutorial() {
        this.speak('Congratulations! You have completed the BlindMate tutorial. You are now ready to navigate with confidence. Would you like to launch BlindMate now?');
        
        // Store tutorial completion
        localStorage.setItem('blindmate_tutorial_completed', 'true');
        localStorage.setItem('blindmate_tutorial_date', new Date().toISOString());
        
        setTimeout(() => {
            if (confirm('Launch BlindMate now?')) {
                this.launchBlindMate();
            }
        }, 3000);
    }
    
    launchBlindMate() {
        this.speak('Launching BlindMate. Welcome to your navigation assistant!');
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
    }
    
    restartTutorial() {
        if (confirm('Are you sure you want to restart the tutorial from the beginning?')) {
            this.currentStep = 1;
            this.currentExercise = 0;
            this.practiceProgress = 0;
            this.showStep(1);
            this.speak('Tutorial restarted. Welcome back to the BlindMate tutorial.');
        }
    }
    
    exitTutorial() {
        if (confirm('Are you sure you want to exit the tutorial?')) {
            this.speak('Exiting tutorial. Goodbye!');
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
        }
    }
}

// Demo functions for button interactions
function speakExample(text) {
    const tutorial = window.tutorialInstance;
    tutorial.speak(`Example command: ${text}`);
}

function playDetectionDemo() {
    const tutorial = window.tutorialInstance;
    tutorial.speak('Detection demo: Person ahead at 3 meters. Car approaching from the right. Chair to your left. Tree blocking the path ahead.');
}

function playNavigationDemo() {
    const tutorial = window.tutorialInstance;
    tutorial.speak('Navigation demo: Route calculated to Central Library. Distance: 500 meters. Estimated time: 6 minutes. Starting navigation. In 50 meters, turn right onto Main Street. Continue straight for 200 meters. Turn left at the traffic light. Your destination is on the right. You have arrived at Central Library.');
}

function playEmergencyDemo() {
    const tutorial = window.tutorialInstance;
    tutorial.speak('Emergency demo: Emergency mode activated. Broadcasting location. Sending alerts to emergency contacts. Loud audio beacon active. Emergency services have been notified of your location.');
}

function startPractice() {
    const tutorial = window.tutorialInstance;
    tutorial.startPractice();
}

function skipExercise() {
    const tutorial = window.tutorialInstance;
    tutorial.skipExercise();
}

function nextStep() {
    const tutorial = window.tutorialInstance;
    tutorial.nextStep();
}

function previousStep() {
    const tutorial = window.tutorialInstance;
    tutorial.previousStep();
}

function toggleAudio() {
    const tutorial = window.tutorialInstance;
    tutorial.toggleAudio();
}

function launchBlindMate() {
    const tutorial = window.tutorialInstance;
    tutorial.launchBlindMate();
}

function restartTutorial() {
    const tutorial = window.tutorialInstance;
    tutorial.restartTutorial();
}

// Initialize tutorial when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.tutorialInstance = new OnboardingTutorial();
});

// Service worker registration for offline access
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
}