# 🚀 BlindMate - Quick Start Guide

## One-Command Setup

```bash
python setup-local.py
```

That's it! The script handles everything automatically.

## Manual Setup (3 steps)

```bash
# 1. Create virtual environment
python -m venv venv

# 2. Activate and install
source venv/bin/activate  # Linux/Mac
# OR
venv\Scripts\activate     # Windows

pip install -r requirements-local.txt

# 3. Set up environment
cp .env.template .env
# Edit .env with your API keys
```

## Get API Keys

1. **Gemini AI** (required): https://aistudio.google.com
2. **Google Maps** (optional): https://console.cloud.google.com

## Run the App

```bash
python main.py
```

Open: http://localhost:5000

## Need Help?

See `LOCAL_SETUP_GUIDE.md` for detailed instructions.