from flask import Flask
from config import Config


def create_app():
    """Application factory for the CatMatch Flask backend."""
    app = Flask(__name__)
    # Load configuration from backend/config.py -> Config
    app.config.from_object(Config)

    @app.route("/")
    def index():
        return {"message": "CatMatch API is running"}

    return app
