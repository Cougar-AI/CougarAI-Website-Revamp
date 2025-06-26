import json

def test_protected_route_no_token(client):
    """
    GIVEN a Flask application configured for testing
    WHEN the '/auth/protected' page is requested (GET) without a token
    THEN check that a 401 response is returned
    """
    response = client.get('/auth/protected')
    assert response.status_code == 401
    data = json.loads(response.data)
    assert data['error'] == 'Token is missing!'