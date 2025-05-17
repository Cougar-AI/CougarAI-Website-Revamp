from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
from dotenv import load_dotenv
import os

load_dotenv()

databaseConnection = psycopg2.connect(
    dbname = os.getenv("DB_NAME"),
    user = os.getenv("DB_USER"),
    password = os.getenv("DB_PASS"),
    host = os.getenv("DB_HOST")
    port = os.getenv("DB_PORT")
    cursor_factory=psycopg2.extras.RealDictCursor # will make results be dictionary, and not tuple 
)

app = Flask(__name__)



@app.route("/discord/config/<string:guild_id>", methods=["POST", "GET"]):
def getDiscordConfig(guild_id):
    if request.method == "GET":
        with databaseConnection.cursor() as cur: 
            cur.execute(f"SELECT * FROM discord_config WHERE guild_id = %s", (guild_id, )) # we use %s to prevent SQL injection
            result = cur.fetchone()
            if result:
                return jsonify(result)
            else: 
                return jsonify({"error": "No config found"}), 404
    
    


if __name__ == "__main__":
    app.run(debug=True)