import os
import logging
import requests
import re
from flask import Flask, request, jsonify, render_template, session, send_from_directory
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

# Create Flask app with proper template and static folders
app = Flask(__name__, 
            template_folder='templates',
            static_folder='static')
app.secret_key = os.environ.get("SESSION_SECRET", "blindmate-secret-key-2024")

# Enable CORS for frontend communication
CORS(app, origins=["*"])

# Initialize Gemini service
gemini_service = GeminiService()

@app.route('/')
def index():
    """Serve the main application page"""
    try:
        return render_template('index.html')
    except Exception as e:
        logging.error(f"Error serving index.html: {e}")
        return "Application files not found", 404

# Static files are now served automatically by Flask from /static folder

@app.route('/tutorial')
def tutorial():
    """Serve the onboarding tutorial page"""
    try:
        return render_template('onboarding.html')
    except Exception as e:
        logging.error(f"Error serving onboarding.html: {e}")
        return "Tutorial not found", 404

@app.route('/navigation')
def navigation():
    """Serve navigation page"""
    try:
        return render_template('navigation.html')
    except Exception as e:
        logging.error(f"Error serving navigation.html: {e}")
        return "Navigation page not found", 404

@app.route('/simple-navigation')
def simple_navigation():
    """Serve simple navigation page"""
    try:
        return render_template('simple_navigation.html')
    except Exception as e:
        logging.error(f"Error serving simple_navigation.html: {e}")
        return "Simple navigation page not found", 404

# JavaScript files are now served automatically by Flask from /static folder

@app.route('/api/process-command', methods=['POST'])
def process_command():
    """Process voice commands using Gemini API"""
    try:
        data = request.get_json()
        
        if not data or 'command' not in data:
            return jsonify({'error': 'Missing command in request'}), 400
        
        command = data['command']
        language = data.get('language', session.get('current_language', 'en-IN'))
        tone = data.get('tone', session.get('current_tone', 'friendly'))
        
        logging.info(f"Processing command: {command} in language: {language} with tone: {tone}")
        
        # Check for language/tone change commands
        result = gemini_service.process_voice_command(command, language, tone)
        
        # Update session if language or tone changed
        if result.get('action') == 'change_language' and result.get('language'):
            session['current_language'] = result['language']
            logging.info(f"Language changed to: {result['language']}")
        
        if result.get('action') == 'change_tone' and result.get('tone'):
            session['current_tone'] = result['tone']
            logging.info(f"Tone changed to: {result['tone']}")
        
        # Add current session preferences to response
        result['current_language'] = session.get('current_language', 'en-IN')
        result['current_tone'] = session.get('current_tone', 'friendly')
        
        return jsonify(result)
        
    except Exception as e:
        logging.error(f"Error processing command: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/directions', methods=['POST'])
def get_directions():
    """Get walking directions using Google Directions API and Google Geocoding API"""
    try:
        data = request.get_json()
        
        if not data or 'origin' not in data or 'destination' not in data:
            return jsonify({'success': False, 'message': 'Missing origin or destination'}), 400
        
        origin = data['origin']  # Expected format: "lat,lng"
        destination = data['destination']  # Can be address text or "lat,lng"
        
        # Get Google API key from environment
        api_key = os.environ.get('GOOGLE_MAPS_API_KEY')
        if not api_key:
            logging.error("GOOGLE_MAPS_API_KEY not found in environment variables")
            return jsonify({'success': False, 'message': 'Navigation service not configured'}), 500
        
        # Validate origin coordinates format
        coord_pattern = r'^-?\d+\.?\d*,-?\d+\.?\d*$'
        if not re.match(coord_pattern, origin):
            return jsonify({'success': False, 'message': 'Invalid origin coordinates format'}), 400
        
        # Parse origin coordinates
        try:
            origin_lat, origin_lng = map(float, origin.split(','))
            if not (-90 <= origin_lat <= 90) or not (-180 <= origin_lng <= 180):
                return jsonify({'success': False, 'message': 'Origin coordinates out of range'}), 400
        except ValueError:
            return jsonify({'success': False, 'message': 'Invalid origin coordinates'}), 400
        
        # Check if destination is coordinates or address text
        destination_coords = destination
        if not re.match(coord_pattern, destination):
            # Destination is text address - try to geocode it first
            logging.info(f"Geocoding destination: {destination}")
            
            # Try standard geocoding first
            geocoded_coords = geocode_address(destination, api_key)
            
            # If geocoding fails and it's a generic term, try Places API search
            if not geocoded_coords or 'error' in geocoded_coords:
                logging.info(f"Standard geocoding failed, trying Places API for: {destination}")
                places_result = find_nearby_place(destination, origin, api_key)
                if places_result and 'lat' in places_result:
                    geocoded_coords = places_result
                    logging.info(f"Found place via Places API: {destination}")
                else:
                    return jsonify({'success': False, 'message': f'Could not find "{destination}" near your location. Please try a more specific address.'}), 404
            
            if 'error' in geocoded_coords:
                return jsonify({'success': False, 'message': geocoded_coords['message']}), 404
            destination_coords = f"{geocoded_coords['lat']},{geocoded_coords['lng']}"
            logging.info(f"Geocoded '{destination}' to {destination_coords}")
        
        # Get walking directions from Google Directions API
        directions_data = get_google_directions(origin, destination_coords, api_key)
        
        if not directions_data:
            return jsonify({'success': False, 'message': 'Route not available'}), 404
        elif 'error' in directions_data:
            return jsonify({'success': False, 'message': directions_data['message']}), 404
        
        # Parse and format the directions for voice navigation
        try:
            navigation_data = parse_google_directions(directions_data, destination)
            return jsonify(navigation_data)
        except Exception as parse_error:
            logging.error(f"Error parsing Google directions: {parse_error}")
            return jsonify({'success': False, 'message': 'Failed to parse navigation data'}), 500
        
    except requests.exceptions.Timeout:
        logging.error("Google API timeout")
        return jsonify({'success': False, 'message': 'Navigation service timeout'}), 504
    except requests.exceptions.RequestException as e:
        logging.error(f"HTTP error getting directions: {e}")
        return jsonify({'success': False, 'message': 'Navigation service unavailable'}), 503
    except Exception as e:
        logging.error(f"Error getting directions: {e}")
        return jsonify({'success': False, 'message': 'Navigation service error'}), 500

@app.route('/api/google-maps-key', methods=['GET'])
def get_google_maps_key():
    """Get Google Maps API key for frontend"""
    api_key = os.environ.get('GOOGLE_MAPS_API_KEY')
    if not api_key:
        return jsonify({'error': 'Google Maps API key not configured'}), 500
    return jsonify({'key': api_key})

@app.route('/api/preferences', methods=['GET', 'POST'])
def preferences():
    """Get or set user language and tone preferences"""
    if request.method == 'GET':
        return jsonify({
            'language': session.get('current_language', 'en-IN'),
            'tone': session.get('current_tone', 'friendly')
        })
    
    elif request.method == 'POST':
        data = request.get_json()
        
        if 'language' in data:
            session['current_language'] = data['language']
            logging.info(f"Language preference updated to: {data['language']}")
        
        if 'tone' in data:
            session['current_tone'] = data['tone']
            logging.info(f"Tone preference updated to: {data['tone']}")
        
        return jsonify({
            'success': True,
            'language': session.get('current_language'),
            'tone': session.get('current_tone')
        })

def enhance_search_terms(address):
    """Enhance generic search terms for better geocoding results"""
    address_lower = address.lower().strip()
    
    # Add "near me" to generic terms to get local results
    generic_terms = {
        'library': 'library near me',
        'hospital': 'hospital near me',
        'school': 'school near me',
        'restaurant': 'restaurant near me',
        'pharmacy': 'pharmacy near me',
        'bank': 'bank near me',
        'grocery store': 'grocery store near me',
        'gas station': 'gas station near me',
        'shopping mall': 'shopping mall near me',
        'park': 'park near me',
        'gym': 'gym near me',
        'university': 'university near me',
        'college': 'college near me',
        'airport': 'airport near me',
        'train station': 'train station near me',
        'bus station': 'bus station near me',
        'hotel': 'hotel near me',
        'cinema': 'cinema near me',
        'movie theater': 'movie theater near me',
        'coffee shop': 'coffee shop near me',
        'post office': 'post office near me'
    }
    
    # Check if it's a generic term
    for term, enhanced in generic_terms.items():
        if address_lower == term or address_lower == term + 's':
            return enhanced
    
    # If it's already a specific address, return as is
    return address

def find_nearby_place(place_type, origin_coords, api_key):
    """Find nearby places using Google Places API"""
    try:
        # Extract coordinates from origin
        origin_lat, origin_lng = map(float, origin_coords.split(','))
        
        # Map common terms to Google Places types
        place_type_mapping = {
            'library': 'library',
            'hospital': 'hospital', 
            'school': 'school',
            'restaurant': 'restaurant',
            'pharmacy': 'pharmacy',
            'bank': 'bank',
            'grocery store': 'grocery_or_supermarket',
            'gas station': 'gas_station',
            'shopping mall': 'shopping_mall',
            'park': 'park',
            'gym': 'gym',
            'university': 'university',
            'college': 'university',
            'airport': 'airport',
            'train station': 'train_station',
            'bus station': 'bus_station',
            'hotel': 'lodging',
            'cinema': 'movie_theater',
            'movie theater': 'movie_theater',
            'coffee shop': 'cafe',
            'post office': 'post_office'
        }
        
        # Get the Places API type
        search_type = place_type_mapping.get(place_type.lower(), place_type.lower())
        
        # Use Places API Nearby Search
        url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json'
        params = {
            'location': f"{origin_lat},{origin_lng}",
            'radius': 5000,  # 5km radius
            'type': search_type,
            'key': api_key
        }
        
        logging.info(f"Searching for nearby {search_type} at {origin_lat},{origin_lng}")
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        status = data.get('status')
        
        if status == 'OK' and data.get('results'):
            # Get the first (closest) result
            place = data['results'][0]
            location = place['geometry']['location']
            place_name = place.get('name', place_type)
            
            logging.info(f"Found nearby {place_type}: {place_name}")
            return {
                'lat': location['lat'],
                'lng': location['lng'],
                'name': place_name
            }
        else:
            logging.warning(f"No nearby {place_type} found via Places API")
            return None
            
    except Exception as e:
        logging.error(f"Error finding nearby place: {e}")
        return None

def geocode_address(address, api_key):
    """Geocode address using Google Geocoding API with enhanced search"""
    try:
        # Enhance generic search terms for better geocoding results
        enhanced_address = enhance_search_terms(address)
        
        url = 'https://maps.googleapis.com/maps/api/geocode/json'
        params = {
            'address': enhanced_address,
            'key': api_key
        }
        
        logging.info(f"Geocoding address: {address} (enhanced: {enhanced_address})")
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        
        try:
            data = response.json()
        except Exception as e:
            logging.error(f"Failed to parse geocoding response: {e}")
            return None
        
        # Check for Google API errors with specific handling
        status = data.get('status')
        if status != 'OK':
            if status == 'ZERO_RESULTS':
                logging.warning(f"No results found for address: {address}")
                return {'error': 'ZERO_RESULTS', 'message': 'Location not found, please try again.'}
            elif status == 'REQUEST_DENIED':
                logging.error(f"Google API request denied for address: {address}")
                return {'error': 'REQUEST_DENIED', 'message': 'Navigation service unavailable'}
            else:
                logging.error(f"Google Geocoding API error: {status}")
                return {'error': status, 'message': 'Unable to find location'}
        
        # Extract coordinates
        if data.get('results') and len(data['results']) > 0:
            location = data['results'][0]['geometry']['location']
            return {
                'lat': location['lat'],
                'lng': location['lng']
            }
        
        return None
        
    except requests.exceptions.Timeout:
        logging.error("Google Geocoding API timeout")
        return None
    except requests.exceptions.RequestException as e:
        logging.error(f"HTTP error geocoding address: {e}")
        return None
    except Exception as e:
        logging.error(f"Geocoding error: {e}")
        return None

def get_google_directions(origin, destination, api_key):
    """Get walking directions from Google Directions API"""
    try:
        url = 'https://maps.googleapis.com/maps/api/directions/json'
        params = {
            'origin': origin,
            'destination': destination,
            'mode': 'walking',
            'units': 'metric',
            'language': 'en',
            'key': api_key
        }
        
        logging.info(f"Getting Google directions from {origin} to {destination}")
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        
        # Parse response safely
        try:
            data = response.json()
        except Exception as e:
            logging.error(f"Failed to parse Google response as JSON: {e}")
            logging.error(f"Response content: {response.text[:500]}")
            return None
        
        # Check for Google API errors with specific handling
        status = data.get('status')
        if status != 'OK':
            if status == 'ZERO_RESULTS':
                logging.warning(f"No route found from {origin} to {destination}")
                return {'error': 'ZERO_RESULTS', 'message': 'Route not available'}
            elif status == 'NOT_FOUND':
                logging.warning(f"Location not found for directions: {origin} to {destination}")
                return {'error': 'NOT_FOUND', 'message': 'Location not found, please try again.'}
            elif status == 'REQUEST_DENIED':
                logging.error(f"Google Directions API request denied")
                return {'error': 'REQUEST_DENIED', 'message': 'Navigation service unavailable'}
            else:
                error_msg = data.get('error_message', 'Unknown error')
                logging.error(f"Google Directions API error: {status} - {error_msg}")
                return {'error': status, 'message': 'Route not available'}
        
        # Validate Google response structure
        if not data.get('routes') or len(data['routes']) == 0:
            logging.error("Google returned no routes")
            return None
            
        route = data['routes'][0]
        if not route.get('legs') or len(route['legs']) == 0:
            logging.error("Google route has no legs")
            return None
            
        return data
        
    except requests.exceptions.Timeout:
        logging.error("Google Directions API timeout")
        return None
    except requests.exceptions.RequestException as e:
        logging.error(f"HTTP error getting Google directions: {e}")
        return None
    except Exception as e:
        logging.error(f"Google directions error: {e}")
        return None

def parse_google_directions(directions_data, destination_name):
    """Parse Google Directions API response for voice navigation"""
    try:
        # Validate main structure
        if not directions_data.get('routes') or len(directions_data['routes']) == 0:
            raise ValueError("No routes in Google response")
            
        route = directions_data['routes'][0]
        
        # Get route legs (Google uses legs instead of segments)
        legs = route.get('legs', [])
        if not legs:
            raise ValueError("Missing route legs")
        
        # Calculate total distance and duration from all legs
        total_distance_m = 0
        total_duration_s = 0
        
        # Parse each step from all legs
        steps = []
        step_number = 1
        
        for leg in legs:
            # Add leg distance and duration to totals
            total_distance_m += leg.get('distance', {}).get('value', 0)
            total_duration_s += leg.get('duration', {}).get('value', 0)
            
            # Get steps from this leg
            leg_steps = leg.get('steps', [])
            
            for step in leg_steps:
                # Extract step information
                distance_m = step.get('distance', {}).get('value', 0)
                duration_s = step.get('duration', {}).get('value', 0)
                html_instruction = step.get('html_instructions', 'Continue straight')
                
                # Clean HTML tags from instruction
                instruction = clean_html_instruction(html_instruction)
                
                # Format step distance and duration
                step_distance = f"{distance_m:.0f} m" if distance_m < 1000 else f"{distance_m/1000:.1f} km"
                step_duration = f"{duration_s//60:.0f} min" if duration_s >= 60 else f"{duration_s:.0f} sec"
                
                # Get start and end coordinates
                start_location = step.get('start_location', {})
                end_location = step.get('end_location', {})
                
                step_data = {
                    'step_number': step_number,
                    'instruction': clean_instruction_text(instruction),
                    'distance': step_distance,
                    'duration': step_duration,
                    'distance_meters': distance_m,
                    'distance_value': distance_m,  # Add for frontend compatibility
                    'duration_seconds': duration_s,
                    'start_location': {
                        'lat': start_location.get('lat', 0),
                        'lng': start_location.get('lng', 0)
                    },
                    'end_location': {
                        'lat': end_location.get('lat', 0),
                        'lng': end_location.get('lng', 0)
                    },
                    'maneuver': step.get('maneuver', 'straight'),
                    'travel_mode': step.get('travel_mode', 'WALKING')
                }
                steps.append(step_data)
                step_number += 1
        
        # Format total distance and duration
        total_distance = f"{total_distance_m:.0f} m" if total_distance_m < 1000 else f"{total_distance_m/1000:.1f} km"
        total_duration = f"{total_duration_s//60:.0f} min" if total_duration_s >= 60 else f"{total_duration_s:.0f} sec"
        
        # Ensure we have at least one step
        if not steps:
            steps.append({
                'step_number': 1,
                'instruction': f'Walk to {destination_name}',
                'distance': total_distance,
                'duration': total_duration,
                'distance_meters': total_distance_m,
                'duration_seconds': total_duration_s,
                'start_location': {'lat': 0, 'lng': 0},
                'end_location': {'lat': 0, 'lng': 0},
                'maneuver': 'straight',
                'travel_mode': 'WALKING'
            })
        
        # Get route overview
        overview_polyline = route.get('overview_polyline', {}).get('points', '')
        bounds = route.get('bounds', {})
        start_address = legs[0].get('start_address', 'Current Location') if legs else 'Current Location'
        end_address = legs[-1].get('end_address', destination_name) if legs else destination_name
        
        return {
            'success': True,
            'route': {
                'distance': total_distance,
                'duration': total_duration,
                'distance_meters': total_distance_m,
                'duration_seconds': total_duration_s,
                'steps': steps,
                'start_address': start_address,
                'end_address': end_address,
                'overview_polyline': overview_polyline,
                'bounds': bounds
            }
        }
        
    except (KeyError, IndexError, TypeError) as e:
        logging.error(f"Error parsing Google directions data: {e}")
        logging.error(f"Google response structure keys: {list(directions_data.keys()) if isinstance(directions_data, dict) else 'Not a dict'}")
        raise ValueError("Invalid Google directions data format")

def clean_html_instruction(html_instruction):
    """Remove HTML tags from Google's instruction text"""
    import re
    
    if not html_instruction:
        return "Continue straight"
    
    # Remove HTML tags
    clean_text = re.sub('<[^<]+?>', '', html_instruction)
    
    # Decode HTML entities
    clean_text = clean_text.replace('&nbsp;', ' ')
    clean_text = clean_text.replace('&amp;', '&')
    clean_text = clean_text.replace('&lt;', '<')
    clean_text = clean_text.replace('&gt;', '>')
    clean_text = clean_text.replace('&quot;', '"')
    
    return clean_text.strip()

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