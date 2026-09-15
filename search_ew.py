import urllib.request, json
url = 'https://earthworks.stanford.edu/catalog.json?f%5Bdc_title_s%5D%5B%5D=Shanghai'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json'})
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        for doc in data.get('data', []):
            print(doc.get('id'), doc.get('attributes', {}).get('title_ssim'))
except Exception as e:
    print(e)
