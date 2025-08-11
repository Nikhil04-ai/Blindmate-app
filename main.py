from app import app
import os

if __name__ == '__main__':
    # Get port from environment variable for production deployment
    port = int(os.environ.get('PORT', 5000))
    # Set debug=False for production
    debug = os.environ.get('FLASK_ENV') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug)
