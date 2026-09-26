import cv2
import numpy as np
import requests
import concurrent.futures

def fetch_tile(layer_id, zoom, x, y):
    url = f"https://pub-1ad0a1b477eb435da7cb742dd295579b.r2.dev/{layer_id}/{zoom}/{x}/{y}.png"
    try:
        resp = requests.get(url, timeout=5)
        if resp.status_code == 200:
            arr = np.frombuffer(resp.content, np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_UNCHANGED)
            return (x, y, img)
    except Exception:
        pass
    return (x, y, None)

def get_angle(layer_id, zoom):
    # Shanghai center at zoom 10 is X=857, Y=418
    # 2^10 = 1024. 
    # For zoom 11, X=1715, Y=836
    # Let's dynamically set center based on zoom
    if zoom == 10:
        cx, cy = 857, 418
        grid_size = 5
    elif zoom == 11:
        cx, cy = 1715, 836
        grid_size = 10
    elif zoom == 13:
        cx, cy = 6861, 3346
        grid_size = 20
    else:
        return None
        
    min_x, max_x = cx - grid_size, cx + grid_size
    min_y, max_y = cy - grid_size, cy + grid_size
    
    tile_size = 256
    w = (max_x - min_x + 1) * tile_size
    h = (max_y - min_y + 1) * tile_size
    
    stitched = np.zeros((h, w), dtype=np.uint8)
    has_data = False
    
    futures = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=30) as executor:
        for x in range(min_x, max_x + 1):
            for y in range(min_y, max_y + 1):
                futures.append(executor.submit(fetch_tile, layer_id, zoom, x, y))
        
        for future in concurrent.futures.as_completed(futures):
            x, y, img = future.result()
            if img is not None:
                if img.shape[2] == 4:
                    alpha = img[:, :, 3]
                else:
                    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                    _, alpha = cv2.threshold(gray, 1, 255, cv2.THRESH_BINARY)
                
                px = (x - min_x) * tile_size
                py = (y - min_y) * tile_size
                stitched[py:py+tile_size, px:px+tile_size] = alpha
                has_data = True
                
    if not has_data:
        return None
        
    # Morphological operations to clean up noise/text and solidify the map area
    kernel = np.ones((5,5), np.uint8)
    stitched = cv2.morphologyEx(stitched, cv2.MORPH_CLOSE, kernel, iterations=3)
        
    contours, _ = cv2.findContours(stitched, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
        
    c = max(contours, key=cv2.contourArea)
    rect = cv2.minAreaRect(c)
    angle = rect[2]
    
    # Debug output
    cv2.imwrite(f"{layer_id}_mask.png", stitched)
    
    # Angle processing
    if angle < -45:
        angle += 90
    return angle

layers_minzoom = {
    "shanghai-1855": 11,
    "shanghai-1907": 10,
    "shanghai-1910": 10,
    "shanghai-1932": 13,
    "shanghai-1937": 10,
    "shanghai-1948": 10
}

for layer, z in layers_minzoom.items():
    angle = get_angle(layer, z)
    print(f"{layer}: {angle}")
