class BaseService:
    def __init__(self, conn):
        self.conn = conn

    def cursor(self):
        return self.conn.cursor()
