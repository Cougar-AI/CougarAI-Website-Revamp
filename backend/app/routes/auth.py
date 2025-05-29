
from app.imports import *


auth_bp = Blueprint('auth', __name__)

JWT_SECRET = os.getenv('JWT_SECRET')
if not JWT_SECRET:
      raise RuntimeError("JWT_SECRET is not set in environment variables!")
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION = timedelta(days=1)

def generate_token(student_id):
    payload = {
        'student_id': student_id,
        'exp': datetime.utcnow() + JWT_EXPIRATION
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    student_id = data.get('student_id')
    password = data.get('password')
    if not student_id or not password:
        return jsonify({'error': 'Student ID and password are required'}), 400

    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT * FROM users
                 WHERE student_id = %s
                   AND password_hash = crypt(%s, password_hash)
                """,
                (student_id, password)
            )
            user = cur.fetchone()
    finally:
        conn.close()

    if not user:
        return jsonify({'error': 'Invalid student ID or password'}), 401

    token = generate_token(student_id)
    return jsonify({'token': token, 'student_id': student_id}), 200

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        if not token:
            return jsonify({'error': 'Token is missing!'}), 401
        try:
            data = jwt.decode(token, os.getenv('JWT_SECRET'), algorithms=['HS256'])
            # You can access data['student_id'] here if needed
        except Exception as e:
            return jsonify({'error': 'Token is invalid!'}), 401
        return f(*args, **kwargs)
    return decorated

@auth_bp.route('/protected', methods=['GET'])
@token_required
def protected():
    return jsonify({'message': 'You have access to this protected route!'})