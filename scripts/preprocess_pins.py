import json
import os

raw_file = os.path.join(os.path.dirname(__file__), '../public/data/pins/buildings_pre1949.geojson')
out_file = os.path.join(os.path.dirname(__file__), '../public/data/pins/clean_pins.json')

def get_name(props):
    for key in ['NAME_EN', 'NAME', 'name', 'name_en']:
        if key in props and props[key] and str(props[key]).strip():
            return str(props[key]).strip()
    return ''

try:
    print(f"Reading raw GeoJSON from {raw_file}...")
    with open(raw_file, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)
        
    processed_features = []
    suppressed_count = 0
    
    for feature in raw_data.get('features', []):
        geom = feature.get('geometry')
        if not geom or not geom.get('coordinates'):
            continue
            
        coords = geom['coordinates']
        if len(coords) < 2:
            continue
            
        lng, lat = coords[0], coords[1]
        
        props = feature.get('properties', {})
        name = get_name(props)
        category = props.get('TYP01', 'Undefined')
        if not category:
            category = 'Undefined'
            
        idbat = str(props.get('IDBAT', ''))
        objectid = str(props.get('OBJECTID', ''))
        
        if not name or name == 'Historic building' or name == idbat or name == objectid:
            suppressed_count += 1
            continue
            
        start = props.get('START') or props.get('start_date') or 0
        try:
            start = int(start)
        except:
            start = 0
            
        end = props.get('END_') or props.get('END') or props.get('end_date') or 9999
        try:
            end = int(end)
        except:
            end = 9999
            
        if end == 0:
            end = 9999
            
        # Clean up properties
        clean_props = {k: v for k, v in props.items() if k not in [
            'GEOCODAGE', 'XC', 'YC', 'DATE_CREAT', 'Copyright', 'License', 'Creator',
            'TYP02', 'TYP03', 'TYP04', 'TYP05', 'TYP06', 'TYP07', 'TYP08', 'TYP09', 'TYP10', 'TYP11'
        ]}
            
        processed_features.append({
            'id': props.get('IDBAT') or props.get('OBJECTID'),
            'name': name,
            'address': props.get('F_ADDRESS', ''),
            'chineseName': props.get('CHINESE', ''),
            'category': category,
            'start': start,
            'end': end,
            'lat': lat,
            'lng': lng,
            'props': clean_props
        })
        
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(processed_features, f, ensure_ascii=False, separators=(',', ':'))
        
    print("Preprocessing complete!")
    print(f"Original features: {len(raw_data.get('features', []))}")
    print(f"Suppressed features: {suppressed_count}")
    print(f"Cleaned features exported: {len(processed_features)}")
    print(f"Output saved to: {out_file}")
    
except Exception as e:
    print(f"Failed to preprocess pins: {e}")
