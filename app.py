import os
import logging
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
        return jsonify({
            'error': 'Failed to process command',
            'action': 'unknown',
            'response': 'Sorry, I could not understand your command. Please try again.'
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'BlindMate API',
        'version': '1.0.0'
    })

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    logging.error(f"Internal server error: {error}")
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Bind to all interfaces on port 5000
    app.run(host='0.0.0.0', port=5000, debug=True)
