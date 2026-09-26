import cv2
import numpy as np
import requests
import math
import os

def deg2num(lat_deg, lon_deg, zoom):
  lat_rad = math.radians(lat_deg)
  n = 2.0 ** zoom
  xtile = int((lon_deg + 180.0) / 360.0 * n)
  ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
  return (xtile, ytile)

def get_angle(layer_id, zoom):
    cx, cy = deg2num(31.23, 121.47, zoom)
    grid_size = 4
    min_x, max_x = cx - grid_size, cx + grid_size
    min_y, max_y = cy - grid_size, cy + grid_size
    
    tile_size = 256
    w = (max_x - min_x + 1) * tile_size
    h = (max_y - min_y + 1) * tile_size
    
    stitched = np.zeros((h, w), dtype=np.uint8)
    
    has_data = False
    for x in range(min_x, max_x + 1):
        for y in range(min_y, max_y + 1):
            url = f"https://pub-1ad0a1b477eb435da7cb742dd295579b.r2.dev/{layer_id}/{zoom}/{x}/{y}.png"
            try:
                resp = requests.get(url, timeout=5)
                if resp.status_code == 200:
                    arr = np.frombuffer(resp.content, np.uint8)
                    img = cv2.imdecode(arr, cv2.IMREAD_UNCHANGED)
                    if img is not None:
                        # Extract alpha channel if exists, else assume full opacity if not perfectly black/white
                        if img.shape[2] == 4:
                            alpha = img[:, :, 3]
                        else:
                            # if no alpha, just use a mask of non-zero
                            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                            _, alpha = cv2.threshold(gray, 1, 255, cv2.THRESH_BINARY)
                        
                        px = (x - min_x) * tile_size
                        py = (y - min_y) * tile_size
                        stitched[py:py+tile_size, px:px+tile_size] = alpha
                        has_data = True
            except Exception as e:
                pass
                
    if not has_data:
        return None
        
    # Find contours
    contours, _ = cv2.findContours(stitched, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
        
    # Get largest contour
    c = max(contours, key=cv2.contourArea)
    rect = cv2.minAreaRect(c)
    angle = rect[2]
    
    # Angle processing
    # cv2.minAreaRect returns angle in [-90, 0)
    # We want to normalize it so that it represents the bearing offset.
    if angle < -45:
        angle += 90
        
    return angle

layers = ["shanghai-1855", "shanghai-1907", "shanghai-1910", "shanghai-1932", "shanghai-1937", "shanghai-1948"]
for layer in layers:
    # 1932 is minZoom 13, others around 11
    zoom = 13 if layer == "shanghai-1932" else 11
    angle = get_angle(layer, zoom)
    print(f"{layer}: {angle}")
