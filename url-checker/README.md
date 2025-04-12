# URL Status Checker

A simple web-based tool for checking if URLs are accessible and returning valid responses.

## Features

- Check multiple URLs at once
- Load URLs from a JSON file
- Extract and check URLs from a website
- Real-time status updates
- Clear visual indicators for successful and failed URLs

## Installation & Usage

1. Make sure you have Python 3.x installed
2. Navigate to the `url-checker` directory
3. Run the server:
   ```
   python3 server.py
   ```
4. Open a web browser and go to:
   ```
   http://localhost:8080
   ```

## How to Use

### Checking URLs Manually

1. Enter URLs in the text area (one per line)
2. Click "Check URLs"
3. View the results to see which URLs are accessible

### Loading URLs from a JSON File

1. Select the "From JSON" tab
2. Choose a JSON file containing an array of objects with URL properties
3. Specify the property path to extract URLs (e.g., "website" or "socialMedia.twitter")
4. Click "Check URLs"

### Extracting URLs from a Website

1. Select the "From Website" tab
2. Enter the website URL
3. Choose whether to include external links
4. Click "Check URLs"

## Use Cases

- Verifying links in a website or documentation
- Checking if URLs in your database or API responses are valid
- Testing website availability after a deployment
- Identifying broken links in your content

## Technical Details

The tool consists of two main components:

1. A Python backend server that performs the URL checks
2. A browser-based frontend for user interaction

The backend server avoids CORS restrictions and handles SSL certificate validation, making it possible to check URLs that would otherwise be inaccessible from browser-based JavaScript.

## Example JSON Format

```json
[
  {
    "name": "Example Site",
    "website": "https://example.com"
  },
  {
    "name": "Another Site",
    "website": "https://another-example.com"
  },
  {
    "name": "Site with Social Media",
    "socialMedia": {
      "twitter": "https://twitter.com/example",
      "instagram": "https://instagram.com/example"
    }
  }
]
``` 