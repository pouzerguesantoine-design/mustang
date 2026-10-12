"""Serveur de developpement — cache desactive pour toujours servir le code a jour.
Usage : python serve.py  →  http://localhost:8137
"""
import http.server


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    print('Mustang GT500 : http://localhost:8137')
    http.server.ThreadingHTTPServer(('127.0.0.1', 8137), NoCacheHandler).serve_forever()
