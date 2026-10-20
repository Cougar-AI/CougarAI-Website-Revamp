from flask import request


def json_object_body():
    """The request's JSON body when it is an object, else None.

    None covers a missing body, a non-JSON content type, malformed JSON, and
    JSON that is null, a list, a string or a number — the cases where
    `request.json.get(...)` would raise and a catch-all would answer 500.
    """
    body = request.get_json(silent=True)
    return body if isinstance(body, dict) else None
