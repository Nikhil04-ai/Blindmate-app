#!/usr/bin/env python3
"""
BlindMate Local Setup Script
This script helps you set up the BlindMate application for local development.
"""

import os
import sys
import subprocess
import platform

def run_command(command, description):
    """Run a command and handle errors"""
    print(f"Running: {description}")
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✓ {description} completed successfully")
            return True
        else:
            print(f"✗ {description} failed: {result.stderr}")
            return False
    except Exception as e:
        print(f"✗ Error running {description}: {e}")
        return False

def check_python_version():
    """Check if Python version is compatible"""
    version = sys.version_info
    if version.major == 3 and version.minor >= 11:
        print(f"✓ Python {version.major}.{version.minor}.{version.micro} is compatible")
        return True
    else:
        print(f"✗ Python {version.major}.{version.minor}.{version.micro} is not compatible. Please use Python 3.11 or higher.")
        return False

def setup_virtual_environment():
    """Create and activate virtual environment"""
    print("\n=== Setting up Virtual Environment ===")
    
    if not run_command("python -m venv venv", "Creating virtual environment"):
        return False
    
    # Activation command differs by platform
    if platform.system() == "Windows":
        activate_cmd = "venv\\Scripts\\activate"
        pip_cmd = "venv\\Scripts\\pip"
    else:
        activate_cmd = "source venv/bin/activate"
        pip_cmd = "venv/bin/pip"
    
    print(f"Virtual environment created. To activate it, run: {activate_cmd}")
    
    # Install dependencies
    if not run_command(f"{pip_cmd} install -r requirements-local.txt", "Installing dependencies"):
        return False
    
    return True

def create_env_template():
    """Create a template .env file"""
    print("\n=== Creating Environment Template ===")
    
    env_template = """# BlindMate Environment Variables
# Copy this file to .env and fill in your actual values

# Database URL (use SQLite for local development or your PostgreSQL URL)
DATABASE_URL=sqlite:///blindmate.db

# Google Gemini API Key (get from Google AI Studio)
GEMINI_API_KEY=your_gemini_api_key_here

# Session secret for Flask (generate a random string)
SESSION_SECRET=your_secret_session_key_here

# Optional: Google Maps API Key for enhanced navigation
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
"""
    
    try:
        with open('.env.template', 'w') as f:
            f.write(env_template)
        print("✓ Created .env.template file")
        print("  Please copy it to .env and fill in your actual API keys")
        return True
    except Exception as e:
        print(f"✗ Failed to create .env.template: {e}")
        return False

def main():
    """Main setup function"""
    print("BlindMate Local Development Setup")
    print("=" * 40)
    
    # Check Python version
    if not check_python_version():
        sys.exit(1)
    
    # Setup virtual environment
    if not setup_virtual_environment():
        print("\n✗ Setup failed during virtual environment creation")
        sys.exit(1)
    
    # Create environment template
    create_env_template()
    
    print("\n" + "=" * 40)
    print("✓ Setup completed successfully!")
    print("\nNext steps:")
    print("1. Activate the virtual environment:")
    if platform.system() == "Windows":
        print("   venv\\Scripts\\activate")
    else:
        print("   source venv/bin/activate")
    print("2. Copy .env.template to .env and fill in your API keys")
    print("3. Run the application: python main.py")
    print("\nFor more information, see the README.md file")

if __name__ == "__main__":
    main()