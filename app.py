import os
import logging
import requests
import re
from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS
from gemini_service import GeminiService

# Configure logging with UTF-8 encoding
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)

# Create Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "blindmate-secret-key-2024")

# Enable CORS for frontend communication
CORS(app, origins=["*"])

# Initialize Gemini service
gemini_service = GeminiService()

@app.route('/')
def index():
    """Serve the main application page"""
    try:
        with open('index.html', 'r', encoding='utf-8') as f:
            html_content = f.read()
        return html_content
    except FileNotFoundError:
        return "Application files not found", 404

@app.route('/styles.css')
def styles():
    """Serve CSS file"""
    try:
        with open('styles.css', 'r', encoding='utf-8') as f:
            css_content = f.read()
        return css_content, 200, {'Content-Type': 'text/css'}
    except FileNotFoundError:
        return "CSS file not found", 404

@app.route('/app.js')
def app_js():
    """Serve JavaScript file"""
    try:
        with open('app.js', 'r', encoding='utf-8') as f:
            js_content = f.read()
        return js_content, 200, {'Content-Type': 'application/javascript'}
    except FileNotFoundError:
        return "JavaScript file not found", 404

@app.route('/navigation.js')
def navigation_js():
    """Serve new navigation JavaScript file"""
    try:
        with open('navigation.js', 'r', encoding='utf-8') as f:
            js_content = f.read()
        return js_content, 200, {'Content-Type': 'application/javascript'}
    except FileNotFoundError:
        return "Navigation JavaScript file not found", 404

@app.route('/sw.js')
def service_worker():
    """Serve service worker for PWA capabilities"""
    try:
        with open('sw.js', 'r', encoding='utf-8') as f:
            sw_content = f.read()
        return sw_content, 200, {'Content-Type': 'application/javascript'}
    except FileNotFoundError:
        return "Service worker not found", 404

@app.route('/tutorial')
def tutorial():
    """Serve the onboarding tutorial page"""
    try:
        with open('onboarding.html', 'r', encoding='utf-8') as f:
            html_content = f.read()
        return html_content
    except FileNotFoundError:
        return "Tutorial not found", 404

@app.route('/onboarding.js')
def onboarding_js():
    """Serve onboarding JavaScript file"""
    try:
        with open('onboarding.js', 'r', encoding='utf-8') as f:
            js_content = f.read()
        return js_content, 200, {'Content-Type': 'application/javascript'}
    except FileNotFoundError:
        return "Onboarding JavaScript file not found", 404

@app.route('/api/process-command', methods=['POST'])
def process_command():
    """Process voice commands using Gemini API"""
    try:
        data = request.get_json()
        
        if not data or 'command' not in data:
            return jsonify({'error': 'Missing command in request'}), 400
        
        command = data['command']
        language = data.get('language', 'en-IN')
        
        logging.info(f"Processing command: {command} in language: {language}")
        
        # Process command with Gemini
        result = gemini_service.process_voice_command(command, language)
        
        return jsonify(result)
        
    except Exception as e:
        logging.error(f"Error processing command: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/directions', methods=['POST'])
def get_directions():
    """Get walking directions from Google Directions API"""
    try:
        data = request.get_json()
        
        if not data or 'origin' not in data or 'destination' not in data:
            return jsonify({'error': 'Missing origin or destination'}), 400
        
        origin = data['origin']
        destination = data['destination']
        mode = data.get('mode', 'walking')
        
        # Get Google API key from environment
        api_key = os.environ.get('GOOGLE_API_KEY')
        if not api_key:
            logging.error("GOOGLE_API_KEY not found in environment variables")
            return jsonify({'error': 'Google API key not configured'}), 500
        
        # Call Google Directions API
        url = 'https://maps.googleapis.com/maps/api/directions/json'
        params = {
            'origin': origin,
            'destination': destination,
            'mode': mode,
            'key': api_key,
            'units': 'metric',
            'language': 'en'
        }
        
        logging.info(f"Getting directions from {origin} to {destination}")
        
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        
        directions_data = response.json()
        
        if directions_data['status'] != 'OK':
            error_msg = directions_data.get('error_message', 'Directions request failed')
            logging.error(f"Google Directions API error: {directions_data['status']} - {error_msg}")
            return jsonify({'error': f'Directions API error: {directions_data["status"]}'}), 400
        
        # Parse and clean the directions
        cleaned_directions = parse_directions(directions_data)
        
        logging.info(f"Successfully got directions with {len(cleaned_directions.get('steps', []))} steps")
        
        return jsonify(cleaned_directions)
        
    except requests.exceptions.RequestException as e:
        logging.error(f"HTTP error getting directions: {e}")
        return jsonify({'error': 'Failed to connect to Google Directions API'}), 500
    except Exception as e:
        logging.error(f"Error getting directions: {e}")
        return jsonify({'error': 'Directions request failed'}), 500

def parse_directions(directions_data):
    """Parse Google Directions response and clean HTML from instructions"""
    try:
        route = directions_data['routes'][0]
        leg = route['legs'][0]
        
        # Extract overall route info
        total_distance = leg['distance']['text']
        total_duration = leg['duration']['text']
        
        # Parse each step and clean HTML
        steps = []
        for i, step in enumerate(leg['steps']):
            # Clean HTML from instructions
            clean_instruction = clean_html_instruction(step['html_instructions'])
            
            step_data = {
                'step_number': i + 1,
                'instruction': clean_instruction,
                'distance': step['distance']['text'],
                'duration': step['duration']['text'],
                'distance_meters': step['distance']['value'],
                'duration_seconds': step['duration']['value'],
                'start_location': {
                    'lat': step['start_location']['lat'],
                    'lng': step['start_location']['lng']
                },
                'end_location': {
                    'lat': step['end_location']['lat'],
                    'lng': step['end_location']['lng']
                },
                'maneuver': step.get('maneuver', 'straight'),
                'polyline': step.get('polyline', {}).get('points', ''),
                'travel_mode': step.get('travel_mode', 'WALKING')
            }
            steps.append(step_data)
        
        return {
            'success': True,
            'route': {
                'distance': total_distance,
                'duration': total_duration,
                'distance_meters': leg['distance']['value'],
                'duration_seconds': leg['duration']['value'],
                'steps': steps,
                'start_address': leg['start_address'],
                'end_address': leg['end_address'],
                'overview_polyline': route.get('overview_polyline', {}).get('points', ''),
                'bounds': route.get('bounds', {})
            }
        }
        
    except (KeyError, IndexError) as e:
        logging.error(f"Error parsing directions data: {e}")
        raise ValueError("Invalid directions data format")

def clean_html_instruction(html_instruction):
    """Remove HTML tags and clean up navigation instructions"""
    # Remove HTML tags
    clean_text = re.sub(r'<[^>]+>', '', html_instruction)
    
    # Replace common HTML entities
    clean_text = clean_text.replace('&nbsp;', ' ')
    clean_text = clean_text.replace('&amp;', '&')
    clean_text = clean_text.replace('&lt;', '<')
    clean_text = clean_text.replace('&gt;', '>')
    clean_text = clean_text.replace('&quot;', '"')
    
    # Clean up multiple spaces
    clean_text = re.sub(r'\s+', ' ', clean_text)
    
    # Make instructions more voice-friendly
    clean_text = clean_text.replace('toward', 'towards')
    clean_text = clean_text.replace('Destination will be on the right', 'Your destination will be on the right')
    clean_text = clean_text.replace('Destination will be on the left', 'Your destination will be on the left')
    
    return clean_text.strip()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)