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

    def process_voice_command(self, command: str, language: str = 'en-IN') -> Dict[str, Any]:
        """
        Process voice command using Gemini AI
        
        Args:
            command: User's voice command
            language: Language code (e.g., 'en-IN', 'hi-IN')
            
        Returns:
            Dictionary with action, destination (if applicable), and response
        """
        try:
            # If Gemini is not available, use fallback logic
            if not self.client:
                return self._fallback_command_processing(command, language)
            
            # Create system prompt for command processing
            system_prompt = self._create_system_prompt(language)
            
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
            return self._validate_and_enhance_response(result, language)
            
        except Exception as e:
            logging.error(f"Error processing command with Gemini: {e}")
            return self._fallback_command_processing(command, language)

    def _create_system_prompt(self, language: str) -> str:
        """Create system prompt for Gemini based on language"""
        
        base_prompt = """You are BlindMate, an AI assistant for visually impaired users. Process voice commands and return JSON responses.

Available actions:
1. start_detection - Start object detection
2. stop_detection - Stop object detection  
3. navigate - Navigate to a destination
4. preview_route - Preview route to destination
5. stop_navigation - Stop current navigation
6. save_location - Save current location with a name
7. enable_location - Enable location services
8. change_language - Change interface language
9. unknown - For unrecognized commands

Response format (JSON only):
{
    "action": "action_name",
    "destination": "place_name",
    "response": "what_to_speak_to_user"
}

Command examples:
- "start detection" -> {"action": "start_detection", "response": "Starting object detection"}
- "take me to library" -> {"action": "navigate", "destination": "library", "response": "Navigating to library"}
- "preview route to canteen" -> {"action": "preview_route", "destination": "canteen", "response": "Previewing route to canteen"}
- "save this location as hostel" -> {"action": "save_location", "destination": "hostel", "response": "Saving current location as hostel"}
- "stop navigation" -> {"action": "stop_navigation", "response": "Stopping navigation"}

Navigation works with ANY location worldwide - users can name any place, address, or landmark.
Examples: "take me to Central Park", "go to India Gate", "navigate to Eiffel Tower", "directions to Starbucks nearby"

Respond only with valid JSON, no extra text."""

        # Add language-specific instructions
        if language.startswith('hi'):
            base_prompt += "\n\nRespond in Hindi (हिंदी) when the user's language is Hindi."
        elif language.startswith('ta'):
            base_prompt += "\n\nRespond in Tamil (தமிழ்) when the user's language is Tamil."
        elif language.startswith('te'):
            base_prompt += "\n\nRespond in Telugu (తెలుగు) when the user's language is Telugu."
        elif language.startswith('bn'):
            base_prompt += "\n\nRespond in Bengali (বাংলা) when the user's language is Bengali."
        elif language.startswith('mr'):
            base_prompt += "\n\nRespond in Marathi (मराठी) when the user's language is Marathi."
        elif language.startswith('gu'):
            base_prompt += "\n\nRespond in Gujarati (ગુજરાતી) when the user's language is Gujarati."
        
        return base_prompt

    def _validate_and_enhance_response(self, result: Dict[str, Any], language: str) -> Dict[str, Any]:
        """Validate and enhance the Gemini response"""
        
        # Ensure required fields exist
        if 'action' not in result:
            result['action'] = 'unknown'
        
        if 'response' not in result:
            result['response'] = self._get_translation('unknown_command', language)
        
        # Validate action
        valid_actions = ['start_detection', 'stop_detection', 'navigate', 'enable_location', 'change_language', 'unknown']
        if result['action'] not in valid_actions:
            result['action'] = 'unknown'
            result['response'] = self._get_translation('unknown_command', language)
        
        return result

    def _fallback_command_processing(self, command: str, language: str) -> Dict[str, Any]:
        """Fallback command processing when Gemini is unavailable"""
        
        command_lower = command.lower().strip()
        
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
        
        elif any(word in command_lower for word in ['change language', 'switch language', 'भाषा बदलो', 'मोझी बदला', 'மொழியை மாற்று']):
            new_language = self._extract_language(command_lower)
            return {
                'action': 'change_language',
                'language': new_language,
                'response': self._get_translation('language_changed', language)
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

    def _get_translation(self, key: str, language: str) -> str:
        """Get translated text for the given key and language"""
        if language in self.translations and key in self.translations[language]:
            return self.translations[language][key]
        
        # Fallback to English
        return self.translations['en-IN'].get(key, 'Command processed.')
