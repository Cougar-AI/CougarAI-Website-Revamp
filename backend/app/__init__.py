from app.imports import *

def create_app():
    app = Flask(__name__)
    CORS(app)

    for blueprint, prefix in blueprints_with_prefixes.items():
        app.register_blueprint(blueprint, url_prefix=prefix)
        
    return app