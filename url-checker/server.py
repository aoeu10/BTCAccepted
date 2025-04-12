import http.server
import json
import socketserver
import urllib.request
import urllib.error
import ssl
import threading
import time
import re
from urllib.parse import urlparse, parse_qs, urljoin

PORT = 8080
TIMEOUT = 10  # Timeout in seconds for URL checks

class URLCheckerHandler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        # Handle CORS
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        # Get POST data
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data.decode('utf-8'))
        
        # Get URLs to check
        urls = data.get('urls', [])
        
        # Check URLs
        results = []
        for url in urls:
            # Make sure URL has a protocol
            if not url.startswith('http://') and not url.startswith('https://'):
                url = 'https://' + url
                
            status = check_url(url)
            results.append({
                'url': url,
                'status': status
            })
        
        # Send response
        self.wfile.write(json.dumps({'results': results}).encode())

    def do_GET(self):
        # Only handle API requests, otherwise serve files
        if self.path.startswith('/api/check'):
            query = urlparse(self.path).query
            params = parse_qs(query)
            
            # Get URL to check
            url = params.get('url', [''])[0]
            
            # Make sure URL has a protocol
            if url and not url.startswith('http://') and not url.startswith('https://'):
                url = 'https://' + url
            
            # Handle CORS
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            # Check URL
            if url:
                status = check_url(url)
                result = {'url': url, 'status': status}
            else:
                result = {'error': 'No URL provided'}
            
            # Send response
            self.wfile.write(json.dumps(result).encode())
        elif self.path.startswith('/api/extract'):
            query = urlparse(self.path).query
            params = parse_qs(query)
            
            # Get URL to extract links from
            url = params.get('url', [''])[0]
            
            # Make sure URL has a protocol
            if url and not url.startswith('http://') and not url.startswith('https://'):
                url = 'https://' + url
            
            # Handle CORS
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            # Extract links
            if url:
                try:
                    links = extract_links(url)
                    result = {'success': True, 'links': links}
                except Exception as e:
                    result = {'success': False, 'message': str(e)}
            else:
                result = {'success': False, 'message': 'No URL provided'}
            
            # Send response
            self.wfile.write(json.dumps(result).encode())
        else:
            # For all other requests, serve files
            return http.server.SimpleHTTPRequestHandler.do_GET(self)

def check_url(url):
    """Check if a URL is valid and accessible."""
    try:
        # Create a context that doesn't verify SSL certificates
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        
        # Create a request with a timeout
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'Mozilla/5.0 (URL Checker)'} 
        )
        
        # Try to open the URL
        response = urllib.request.urlopen(req, timeout=TIMEOUT, context=ctx)
        
        # Return status code
        return {
            'code': response.getcode(),
            'message': 'OK',
            'success': True
        }
    except urllib.error.HTTPError as e:
        return {
            'code': e.code,
            'message': str(e),
            'success': False
        }
    except urllib.error.URLError as e:
        return {
            'code': None,
            'message': str(e.reason),
            'success': False
        }
    except Exception as e:
        return {
            'code': None,
            'message': str(e),
            'success': False
        }

def extract_links(url):
    """Extract all links from a webpage."""
    try:
        # Create a context that doesn't verify SSL certificates
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        
        # Create a request with a timeout
        req = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml'
            }
        )
        
        # Try to open the URL
        response = urllib.request.urlopen(req, timeout=TIMEOUT, context=ctx)
        content_type = response.getheader('Content-Type', '')
        
        # Only process HTML content
        if 'text/html' not in content_type.lower():
            return []
        
        # Read and decode the page content
        charset = 'utf-8'  # Default charset
        if 'charset=' in content_type.lower():
            charset = content_type.lower().split('charset=')[-1].split(';')[0].strip()
        
        html = response.read().decode(charset, errors='ignore')
        
        # Extract all href attributes
        links = []
        base_url = url
        
        # Extract base URL if specified in the HTML
        base_match = re.search(r'<base\s+href=[\'"]([^\'"]+)[\'"]', html, re.IGNORECASE)
        if base_match:
            base_url = base_match.group(1)
        
        # Extract all links
        href_matches = re.findall(r'<a\s+(?:[^>]*?\s+)?href=[\'"]([^\'"]+)[\'"]', html, re.IGNORECASE)
        for href in href_matches:
            # Skip anchor links and javascript links
            if href.startswith('#') or href.startswith('javascript:'):
                continue
                
            # Resolve relative URLs
            full_url = urljoin(base_url, href)
            links.append(full_url)
        
        return list(set(links))  # Remove duplicates
    except Exception as e:
        print(f"Error extracting links from {url}: {e}")
        return []

def start_server():
    print(f"Starting URL checker server on port {PORT}...")
    with socketserver.TCPServer(("", PORT), URLCheckerHandler) as httpd:
        print(f"Server running at http://localhost:{PORT}")
        httpd.serve_forever()

if __name__ == "__main__":
    # Start the server in a separate thread
    server_thread = threading.Thread(target=start_server)
    server_thread.daemon = True
    server_thread.start()
    
    try:
        # Keep the main thread alive
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Server stopped by user.") 