from flask import Flask


def create_app():
    """Application factory for the CatMatch Flask backend."""
    app = Flask(__name__)

    @app.route("/")
    def index():
        return {"message": "CatMatch API is running"}

    return app
