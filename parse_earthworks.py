import re
from bs4 import BeautifulSoup
import json

with open('search_results.html', 'r', encoding='utf-8') as f:
    html = f.read()

soup = BeautifulSoup(html, 'html.parser')
results = []

# Find all catalog items
items = soup.find_all('article', class_='document')
for item in items:
    title_element = item.find('h3', class_='document-title-heading')
    if title_element and title_element.find('a'):
        a_tag = title_element.find('a')
        title = a_tag.text.strip()
        link = a_tag['href']
        results.append({"title": title, "link": f"https://earthworks.stanford.edu{link}"})

print(json.dumps(results, indent=2))
