from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2.extras
import psycopg2
from dotenv import load_dotenv
from app import create_app
import os

load_dotenv()

app = create_app()

if __name__ == "__main__":
    app.run(debug=True)