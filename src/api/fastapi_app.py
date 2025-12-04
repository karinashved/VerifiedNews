import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
import requests

API_KEY = "30c603aed4a246bf9090266f7608d84a"
BASE_URL = "https://newsapi.org/v2"

PORT = 8000  # Port to run your backend


class NewsHandler(BaseHTTPRequestHandler):
    def _send_json(self, data, code=200):
        """Send JSON response to client"""
        self.send_response(code)
        self.send_header("Content-type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")  # Allow JS frontend
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        query = parse_qs(parsed_url.query)
        # Convert query values from list to single value
        query = {k: v[0] for k, v in query.items()}

        try:
            if path == "/news/everything":
                self.handle_everything(query)
            elif path == "/news/top-headlines":
                self.handle_top_headlines(query)
            else:
                self._send_json({"error": "Endpoint not found"}, code=404)
        except Exception as e:
            self._send_json({"error": str(e)}, code=500)

    def handle_everything(self, query):
        """Handle /news/everything"""
        if "q" not in query:
            self._send_json({"error": "Missing required parameter 'q'"}, code=400)
            return

        params = {
            "q": query.get("q"),
            "language": query.get("language"),
            "from": query.get("from"),
            "to": query.get("to"),
            "sortBy": query.get("sort_by", "publishedAt"),
            "pageSize": query.get("page_size", 20),
            "page": query.get("page", 1),
            "domains": query.get("domains"),
            "excludeDomains": query.get("exclude_domains"),
            "searchIn": query.get("search_in"),
            "apiKey": API_KEY
        }
        # Remove None values
        params = {k: v for k, v in params.items() if v is not None}

        response = requests.get(f"{BASE_URL}/everything", params=params)
        self._send_json(response.json())

    def handle_top_headlines(self, query):
        """Handle /news/top-headlines"""
        country = query.get("country")
        category = query.get("category")
        sources = query.get("sources")

        if sources and (country or category):
            self._send_json({"status": "error", "message": "Cannot combine sources with country or category"}, code=400)
            return

        params = {
            "country": country,
            "category": category,
            "sources": sources,
            "q": query.get("q"),
            "pageSize": query.get("page_size", 20),
            "page": query.get("page", 1),
            "apiKey": API_KEY
        }
        params = {k: v for k, v in params.items() if v is not None}

        response = requests.get(f"{BASE_URL}/top-headlines", params=params)
        self._send_json(response.json())


if __name__ == "__main__":
    print(f"Starting server at http://localhost:{PORT}")
    server = HTTPServer(("0.0.0.0", PORT), NewsHandler)
    server.serve_forever()
