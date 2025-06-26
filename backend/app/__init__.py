from app.imports import *

def create_app(config_class='config.DevelopmentConfig'):
    app = Flask(__name__)
    app.config.from_object(config_class)
    CORS(app)

    for blueprint, prefix in blueprints_with_prefixes.items():
        app.register_blueprint(blueprint, url_prefix=prefix)
        
    return app