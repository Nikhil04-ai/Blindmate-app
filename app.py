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
    """Get walking directions from OpenRouteService API"""
    try:
        data = request.get_json()
        
        if not data or 'origin' not in data or 'destination' not in data:
            return jsonify({'error': 'Missing origin or destination'}), 400
        
        origin = data['origin']
        destination = data['destination']
        
        # Get ORS API key from environment
        api_key = os.environ.get('ORS_API_KEY')
        if not api_key:
            logging.error("ORS_API_KEY not found in environment variables")
            return jsonify({'error': 'OpenRouteService API key not configured'}), 500
        
        # First, geocode the destination if it's not coordinates
        destination_coords = await_geocode_location(destination, api_key)
        if not destination_coords:
            return jsonify({'error': f'Could not find location: {destination}'}), 400
        
        # Parse origin coordinates
        try:
            origin_lat, origin_lng = map(float, origin.split(','))
        except ValueError:
            return jsonify({'error': 'Invalid origin coordinates format'}), 400
        
        # Get walking directions from ORS
        directions_data = await_get_ors_directions(
            [origin_lng, origin_lat], 
            destination_coords, 
            api_key
        )
        
        if not directions_data:
            return jsonify({'error': 'Could not get directions'}), 400
        
        # Parse and clean the directions
        cleaned_directions = parse_ors_directions(directions_data, destination)
        
        logging.info(f"Successfully got ORS directions with {len(cleaned_directions.get('steps', []))} steps")
        
        return jsonify(cleaned_directions)
        
    except Exception as e:
        logging.error(f"Error getting directions: {e}")
        return jsonify({'error': 'Directions request failed'}), 500

def await_geocode_location(location_name, api_key):
    """Geocode location name using OpenRouteService"""
    try:
        url = 'https://api.openrouteservice.org/geocode/search'
        headers = {
            'Authorization': api_key,
            'Content-Type': 'application/json'
        }
        params = {
            'text': location_name,
            'size': 1  # We only need the best match
        }
        
        logging.info(f"Geocoding location: {location_name}")
        response = requests.get(url, headers=headers, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        if data['features']:
            coords = data['features'][0]['geometry']['coordinates']
            logging.info(f"Geocoded {location_name} to {coords}")
            return coords  # [lng, lat]
        
        return None
        
    except Exception as e:
        logging.error(f"Geocoding error for {location_name}: {e}")
        return None

def await_get_ors_directions(start_coords, end_coords, api_key):
    """Get walking directions from OpenRouteService"""
    try:
        url = 'https://api.openrouteservice.org/v2/directions/foot-walking'
        headers = {
            'Authorization': api_key,
            'Content-Type': 'application/json'
        }
        
        body = {
            'coordinates': [start_coords, end_coords],
            'format': 'json',
            'units': 'm',
            'language': 'en',
            'geometry': 'true',
            'instructions': 'true',
            'instruction_format': 'text'
        }
        
        logging.info(f"Getting ORS directions from {start_coords} to {end_coords}")
        response = requests.post(url, headers=headers, json=body, timeout=15)
        response.raise_for_status()
        
        data = response.json()
        return data
        
    except Exception as e:
        logging.error(f"ORS directions error: {e}")
        return None

def parse_ors_directions(directions_data, destination_name):
    """Parse OpenRouteService directions response"""
    try:
        route = directions_data['routes'][0]
        summary = route['summary']
        segments = route['segments']
        
        # Extract overall route info
        total_distance_m = summary['distance']
        total_duration_s = summary['duration']
        
        # Format distance and duration
        total_distance = f"{total_distance_m:.0f} m" if total_distance_m < 1000 else f"{total_distance_m/1000:.1f} km"
        total_duration = f"{total_duration_s//60:.0f} min" if total_duration_s >= 60 else f"{total_duration_s:.0f} sec"
        
        # Parse each step
        steps = []
        step_number = 1
        
        for segment in segments:
            segment_steps = segment.get('steps', [])
            
            for step in segment_steps:
                # Clean and format instruction
                instruction = step.get('instruction', 'Continue')
                distance_m = step.get('distance', 0)
                duration_s = step.get('duration', 0)
                
                # Format step distance and duration
                step_distance = f"{distance_m:.0f} m" if distance_m < 1000 else f"{distance_m/1000:.1f} km"
                step_duration = f"{duration_s//60:.0f} min" if duration_s >= 60 else f"{duration_s:.0f} sec"
                
                # Get coordinates from route geometry (ORS uses [lng, lat] format)
                way_points = step.get('way_points', [0, 1])
                geometry = route.get('geometry', {}).get('coordinates', [])
                
                # Extract start and end coordinates for this step
                start_idx = way_points[0] if len(way_points) > 0 else 0
                end_idx = way_points[1] if len(way_points) > 1 else start_idx
                
                start_coord = geometry[start_idx] if start_idx < len(geometry) else [0, 0]
                end_coord = geometry[end_idx] if end_idx < len(geometry) else start_coord
                
                step_data = {
                    'step_number': step_number,
                    'instruction': clean_instruction_text(instruction),
                    'distance': step_distance,
                    'duration': step_duration,
                    'distance_meters': distance_m,
                    'duration_seconds': duration_s,
                    'start_location': {
                        'lat': start_coord[1],  # ORS uses [lng, lat]
                        'lng': start_coord[0]
                    },
                    'end_location': {
                        'lat': end_coord[1],    # ORS uses [lng, lat]
                        'lng': end_coord[0]
                    },
                    'maneuver': step.get('type', 'straight'),
                    'travel_mode': 'WALKING'
                }
                steps.append(step_data)
                step_number += 1
        
        return {
            'success': True,
            'route': {
                'distance': total_distance,
                'duration': total_duration,
                'distance_meters': total_distance_m,
                'duration_seconds': total_duration_s,
                'steps': steps,
                'start_address': 'Current Location',
                'end_address': destination_name,
                'overview_polyline': '',  # ORS has different polyline format
                'bounds': {}
            }
        }
        
    except (KeyError, IndexError) as e:
        logging.error(f"Error parsing ORS directions data: {e}")
        raise ValueError("Invalid ORS directions data format")

def clean_instruction_text(instruction):
    """Clean and optimize navigation instructions for voice"""
    if not instruction:
        return "Continue straight"
    
    # Clean up text
    clean_text = instruction.strip()
    
    # Make instructions more voice-friendly
    clean_text = clean_text.replace('toward', 'towards')
    clean_text = clean_text.replace('Destination will be on the right', 'Your destination will be on the right')
    clean_text = clean_text.replace('Destination will be on the left', 'Your destination will be on the left')
    clean_text = clean_text.replace('Continue on', 'Continue along')
    
    return clean_text

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)