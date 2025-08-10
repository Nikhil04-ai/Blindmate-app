import os
import json
import logging
import re
from typing import Dict, Any
from google import genai
from google.genai import types

class GeminiService:
    """Service for handling Gemini AI interactions"""
    
    def __init__(self):
        """Initialize Gemini client"""
        self.api_key = os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            logging.warning("GEMINI_API_KEY not found in environment variables")
            self.client = None
        else:
            try:
                self.client = genai.Client(api_key=self.api_key)
                logging.info("Gemini client initialized successfully")
            except Exception as e:
                logging.error(f"Failed to initialize Gemini client: {e}")
                self.client = None
        
        # Language translations for common responses
        self.translations = {
            'en-IN': {
                'start_detection': 'Starting object detection now.',
                'stop_detection': 'Stopping object detection.',
                'enable_location': 'Enabling location services.',
                'navigation_ready': 'Navigation is ready.',
                'unknown_command': 'I did not understand that command. Please try again.',
                'language_changed': 'Language has been changed.',
            },
            'hi-IN': {
                'start_detection': 'अब ऑब्जेक्ट डिटेक्शन शुरू कर रहा हूं।',
                'stop_detection': 'ऑब्जेक्ट डिटेक्शन बंद कर रहा हूं।',
                'enable_location': 'लोकेशन सेवाएं सक्षम कर रहा हूं।',
                'navigation_ready': 'नेवीगेशन तैयार है।',
                'unknown_command': 'मुझे वह कमांड समझ नहीं आई। कृपया फिर से कोशिश करें।',
                'language_changed': 'भाषा बदल दी गई है।',
            },
            'ta-IN': {
                'start_detection': 'இப்போது பொருள் கண்டறிதலைத் தொடங்குகிறேன்.',
                'stop_detection': 'பொருள் கண்டறிதலை நிறுத்துகிறேன்.',
                'enable_location': 'இடச் சேவைகளை இயக்குகிறேன்.',
                'navigation_ready': 'வழிசெலுத்தல் தயார்.',
                'unknown_command': 'அந்த கட்டளையை நான் புரிந்துகொள்ளவில்லை. மீண்டும் முயற்சிக்கவும்.',
                'language_changed': 'மொழி மாற்றப்பட்டது.',
            },
            'te-IN': {
                'start_detection': 'ఇప్పుడు వస్తు గుర్తింపును ప్రారంభిస్తున్నాను.',
                'stop_detection': 'వస్తు గుర్తింపును ఆపుతున్నాను.',
                'enable_location': 'స్థాన సేవలను ప్రారంభిస్తున్నాను.',
                'navigation_ready': 'నావిగేషన్ సిద్ధంగా ఉంది.',
                'unknown_command': 'ఆ కమాండ్ నాకు అర్థం కాలేదు. దయచేసి మళ్లీ ప్రయత్నించండి.',
                'language_changed': 'భాష మార్చబడింది.',
            },
            'bn-IN': {
                'start_detection': 'এখন অবজেক্ট ডিটেকশন শুরু করছি।',
                'stop_detection': 'অবজেক্ট ডিটেকশন বন্ধ করছি।',
                'enable_location': 'লোকেশন সেবা চালু করছি।',
                'navigation_ready': 'নেভিগেশন প্রস্তুত।',
                'unknown_command': 'সেই কমান্ডটি আমি বুঝতে পারিনি। দয়া করে আবার চেষ্টা করুন।',
                'language_changed': 'ভাষা পরিবর্তন করা হয়েছে।',
            },
            'mr-IN': {
                'start_detection': 'आता ऑब्जेक्ट डिटेक्शन सुरू करत आहे।',
                'stop_detection': 'ऑब्जेक्ट डिटेक्शन थांबवत आहे।',
                'enable_location': 'लोकेशन सेवा सक्षम करत आहे।',
                'navigation_ready': 'नेव्हिगेशन तयार आहे।',
                'unknown_command': 'मला ती कमांड समजली नाही. कृपया पुन्हा प्रयत्न करा.',
                'language_changed': 'भाषा बदलली आहे.',
            },
            'gu-IN': {
                'start_detection': 'હવે ઓબ્જેક્ટ ડિટેક્શન શરૂ કરી રહ્યો છું.',
                'stop_detection': 'ઓબ્જેક્ટ ડિટેક્શન બંધ કરી રહ્યો છું.',
                'enable_location': 'લોકેશન સેવાઓ સક્ષમ કરી રહ્યો છું.',
                'navigation_ready': 'નેવિગેશન તૈયાર છે.',
                'unknown_command': 'મને તે કમાન્ડ સમજાઈ નહીં. કૃપા કરીને ફરીથી પ્રયાસ કરો.',
                'language_changed': 'ભાષા બદલવામાં આવી છે.',
            }
        }

    def process_voice_command(self, command: str, language: str = 'en-IN', tone: str = 'friendly') -> Dict[str, Any]:
        """
        Process voice command using Gemini AI
        
        Args:
            command: User's voice command
            language: Language code (e.g., 'en-IN', 'hi-IN')
            tone: Voice tone preference (e.g., 'friendly', 'formal', 'energetic')
            
        Returns:
            Dictionary with action, destination (if applicable), and response
        """
        try:
            # If Gemini is not available, use fallback logic
            if not self.client:
                return self._fallback_command_processing(command, language, tone)
            
            # Create system prompt for command processing
            system_prompt = self._create_system_prompt(language, tone)
            
            # Process command with Gemini - ensure UTF-8 encoding
            user_prompt = f"User command: '{command}'"
            
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[
                    types.Content(role="user", parts=[types.Part(text=user_prompt)])
                ],
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    response_mime_type="application/json",
                    temperature=0.3,
                    max_output_tokens=1000
                )
            )
            
            if not response.text:
                raise ValueError("Empty response from Gemini")
            
            # Parse JSON response with proper encoding
            result = json.loads(response.text)
            
            # Validate and enhance response
            return self._validate_and_enhance_response(result, language, tone)
            
        except Exception as e:
            logging.error(f"Error processing command with Gemini: {e}")
            return self._fallback_command_processing(command, language, tone)

    def _create_system_prompt(self, language: str, tone: str = 'friendly') -> str:
        """Create system prompt for Gemini based on language and tone"""
        
        # Define tone characteristics
        tone_instructions = {
            'friendly': 'Use a warm, friendly, and encouraging tone. Be supportive and cheerful.',
            'formal': 'Use a professional, polite, and respectful tone. Be clear and courteous.',
            'energetic': 'Use an enthusiastic, vibrant, and motivating tone. Be upbeat and inspiring.',
            'calm': 'Use a gentle, soothing, and peaceful tone. Be reassuring and steady.',
            'robotic': 'Use a neutral, precise, and direct tone. Be factual and systematic.'
        }
        
        tone_instruction = tone_instructions.get(tone, tone_instructions['friendly'])
        
        base_prompt = f"""You are BlindMate, an AI assistant for visually impaired users. Process voice commands and return JSON responses.

IMPORTANT: {tone_instruction}

Available actions:
1. start_detection - Start object detection
2. stop_detection - Stop object detection  
3. navigate - Navigate to a destination
4. preview_route - Preview route to destination
5. stop_navigation - Stop current navigation
6. show_map - Show navigation map during navigation
7. emergency_stop - Emergency stop navigation immediately
8. test_voice - Test voice recognition functionality
9. toggle_obstacle_alerts - Enable/disable obstacle alerts during navigation
10. save_location - Save current location with a name
11. enable_location - Enable location services
12. change_language - Change interface language
13. change_tone - Change voice tone/style
14. unknown - For unrecognized commands

Response format (JSON only):
{{
    "action": "action_name",
    "destination": "place_name",
    "response": "what_to_speak_to_user",
    "language": "language_code_if_changed",
    "tone": "tone_if_changed"
}}

Command examples:
- "start detection" -> {{"action": "start_detection", "response": "Starting object detection"}}
- "show map" or "show navigation map" -> {{"action": "show_map", "response": "Showing navigation map"}}
- "emergency stop" or "stop navigation now" -> {{"action": "emergency_stop", "response": "Stopping navigation immediately"}}
- "test voice" or "check microphone" -> {{"action": "test_voice", "response": "Testing voice recognition"}}
- "toggle obstacle alerts" or "disable alerts" -> {{"action": "toggle_obstacle_alerts", "response": "Toggling obstacle alerts"}}
- "take me to library" -> {{"action": "navigate", "destination": "library", "response": "Navigating to library"}}
- "change language to Hindi" -> {{"action": "change_language", "language": "hi-IN", "response": "भाषा हिंदी में बदल दी गई है"}}
- "change tone to formal" -> {{"action": "change_tone", "tone": "formal", "response": "Voice tone changed to formal"}}
- "speak in friendly voice" -> {{"action": "change_tone", "tone": "friendly", "response": "Voice tone changed to friendly"}}

Language change commands:
- Detect commands like "change language to [language]", "speak in [language]", "switch to [language]"
- Support: English, Hindi, Spanish, French, German, Italian, Portuguese, Japanese, Chinese, Arabic

Tone change commands:
- Detect commands like "change tone to [tone]", "speak in [tone] voice", "be more [tone]"
- Support: friendly, formal, energetic, calm, robotic

Navigation works with ANY location worldwide - users can name any place, address, or landmark.

Respond only with valid JSON, no extra text."""

        # Add language-specific instructions
        if language.startswith('hi'):
            base_prompt += f"\n\nRespond in Hindi (हिंदी). {tone_instruction}"
        elif language.startswith('ta'):
            base_prompt += f"\n\nRespond in Tamil (தமிழ்). {tone_instruction}"
        elif language.startswith('te'):
            base_prompt += f"\n\nRespond in Telugu (తెలుగు). {tone_instruction}"
        elif language.startswith('bn'):
            base_prompt += f"\n\nRespond in Bengali (বাংলা). {tone_instruction}"
        elif language.startswith('mr'):
            base_prompt += f"\n\nRespond in Marathi (मराठी). {tone_instruction}"
        elif language.startswith('gu'):
            base_prompt += f"\n\nRespond in Gujarati (ગુજરાતી). {tone_instruction}"
        elif language.startswith('es'):
            base_prompt += f"\n\nRespond in Spanish (Español). {tone_instruction}"
        elif language.startswith('fr'):
            base_prompt += f"\n\nRespond in French (Français). {tone_instruction}"
        elif language.startswith('de'):
            base_prompt += f"\n\nRespond in German (Deutsch). {tone_instruction}"
        elif language.startswith('it'):
            base_prompt += f"\n\nRespond in Italian (Italiano). {tone_instruction}"
        elif language.startswith('pt'):
            base_prompt += f"\n\nRespond in Portuguese (Português). {tone_instruction}"
        elif language.startswith('ja'):
            base_prompt += f"\n\nRespond in Japanese (日本語). {tone_instruction}"
        elif language.startswith('zh'):
            base_prompt += f"\n\nRespond in Chinese (中文). {tone_instruction}"
        elif language.startswith('ar'):
            base_prompt += f"\n\nRespond in Arabic (العربية). {tone_instruction}"
        
        return base_prompt

    def _validate_and_enhance_response(self, result: Dict[str, Any], language: str, tone: str = 'friendly') -> Dict[str, Any]:
        """Validate and enhance the Gemini response"""
        
        # Ensure required fields exist
        if 'action' not in result:
            result['action'] = 'unknown'
        
        if 'response' not in result:
            result['response'] = self._get_translation('unknown_command', language)
        
        # Validate action
        valid_actions = ['start_detection', 'stop_detection', 'navigate', 'enable_location', 'change_language', 'change_tone', 'unknown']
        if result['action'] not in valid_actions:
            result['action'] = 'unknown'
            result['response'] = self._get_translation('unknown_command', language)
        
        # Add current tone to response
        result['current_tone'] = tone
        
        return result

    def _fallback_command_processing(self, command: str, language: str, tone: str = 'friendly') -> Dict[str, Any]:
        """Fallback command processing when Gemini is unavailable"""
        
        command_lower = command.lower().strip()
        
        # Filter out meaningless commands first
        meaningless_patterns = [
            r'^(um|uh|ah|er|hm|hmm|yes|yeah|no|okay|ok)$',
            r'^sorry i didn\'?t understand',
            r'^please try again',
            r'^what$',
            r'^\s*$',  # Empty or whitespace only
            r'^.{1,2}$'  # Very short commands (1-2 characters)
        ]
        
        for pattern in meaningless_patterns:
            if re.match(pattern, command_lower, re.IGNORECASE):
                # Return silent action for meaningless commands
                return {
                    'action': 'silent',
                    'response': ''
                }
        
        # Simple keyword matching
        if any(word in command_lower for word in ['start', 'begin', 'शुरू', 'தொடங்கு', 'ప్రారంభించు']):
            if any(word in command_lower for word in ['detection', 'scanning', 'डिटेक्शन', 'कॅन', 'கண்டறிதல்']):
                return {
                    'action': 'start_detection',
                    'response': self._get_translation('start_detection', language)
                }
        
        elif any(word in command_lower for word in ['stop', 'pause', 'बंद', 'रोक', 'நிறுத்து', 'ఆపు']):
            return {
                'action': 'stop_detection',
                'response': self._get_translation('stop_detection', language)
            }
        
        elif any(word in command_lower for word in ['take me', 'navigate', 'go to', 'ले चलो', 'जाना', 'என்னை அழைத்துச் செல்', 'నన్ను తీసుకెళ్లు']):
            # Extract destination
            destination = self._extract_destination(command_lower)
            return {
                'action': 'navigate',
                'destination': destination,
                'response': f"{self._get_translation('navigation_ready', language)} {destination}"
            }
        
        elif any(word in command_lower for word in ['location', 'enable location', 'लोकेशन', 'स्थान', 'இடம்', 'స్థానం']):
            return {
                'action': 'enable_location',
                'response': self._get_translation('enable_location', language)
            }
        
        elif any(word in command_lower for word in ['change language', 'switch language', 'speak in', 'भाषा बदलो', 'मोझी बदला', 'மொழியை மாற்று']):
            new_language = self._extract_language(command_lower)
            return {
                'action': 'change_language',
                'language': new_language,
                'response': self._get_translation('language_changed', language)
            }
        
        elif any(word in command_lower for word in ['change tone', 'switch tone', 'voice tone', 'be more', 'speak', 'sound']):
            new_tone = self._extract_tone(command_lower)
            if new_tone:
                return {
                    'action': 'change_tone',
                    'tone': new_tone,
                    'response': f"Voice tone changed to {new_tone}"
                }
        
        # Unknown command
        return {
            'action': 'unknown',
            'response': self._get_translation('unknown_command', language)
        }

    def _extract_destination(self, command: str) -> str:
        """Extract destination from navigation command"""
        # Simple extraction - look for common location words
        patterns = [
            r'(?:take me to|go to|navigate to)\s+(.+)',
            r'(?:ले चलो|जाना है)\s+(.+)',
            r'(?:என்னை அழைத்துச் செல்)\s+(.+)',
            r'(?:నన్ను తీసుకెళ్లు)\s+(.+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, command, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        
        # If no specific pattern matches, return a generic destination
        return "the requested location"

    def _extract_language(self, command: str) -> str:
        """Extract language from language change command"""
        language_map = {
            'hindi': 'hi-IN',
            'हिंदी': 'hi-IN',
            'tamil': 'ta-IN',
            'தமிழ்': 'ta-IN',
            'telugu': 'te-IN',
            'తెలుగు': 'te-IN',
            'bengali': 'bn-IN',
            'বাংলা': 'bn-IN',
            'marathi': 'mr-IN',
            'मराठी': 'mr-IN',
            'gujarati': 'gu-IN',
            'ગુજરાતી': 'gu-IN',
            'english': 'en-IN'
        }
        
        command_lower = command.lower()
        for lang_name, lang_code in language_map.items():
            if lang_name in command_lower:
                return lang_code
        
        return 'en-IN'  # Default to English

    def _extract_tone(self, command: str) -> str:
        """Extract tone from tone change command"""
        tone_map = {
            'friendly': 'friendly',
            'formal': 'formal',
            'professional': 'formal',
            'energetic': 'energetic',
            'enthusiastic': 'energetic',
            'excited': 'energetic',
            'calm': 'calm',
            'peaceful': 'calm',
            'soothing': 'calm',
            'robotic': 'robotic',
            'robot': 'robotic',
            'neutral': 'robotic'
        }
        
        command_lower = command.lower()
        for tone_name, tone_code in tone_map.items():
            if tone_name in command_lower:
                return tone_code
        
        return None  # No tone detected

    def _get_translation(self, key: str, language: str) -> str:
        """Get translated text for the given key and language"""
        if language in self.translations and key in self.translations[language]:
            return self.translations[language][key]
        
        # Fallback to English
        return self.translations['en-IN'].get(key, 'Command processed.')
