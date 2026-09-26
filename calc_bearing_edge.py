import cv2
import numpy as np
import requests
import math
import concurrent.futures

def deg2num(lat_deg, lon_deg, zoom):
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return (xtile, ytile)

def get_best_edge_angle(layer_id, zoom):
    cx, cy = deg2num(31.23, 121.47, zoom)
    
    # spiral search for border tiles
    def spiral():
        x, y = 0, 0
        dx = 0
        dy = -1
        for i in range(150):
            if (-12 < x <= 12) and (-12 < y <= 12):
                yield cx + x, cy + y
            if x == y or (x < 0 and x == -y) or (x > 0 and x == 1 - y):
                dx, dy = -dy, dx
            x, y = x + dx, y + dy

    tiles_to_fetch = list(spiral())
    
    def fetch(coord):
        tx, ty = coord
        url = f"https://pub-1ad0a1b477eb435da7cb742dd295579b.r2.dev/{layer_id}/{zoom}/{tx}/{ty}.png"
        try:
            resp = requests.get(url, timeout=3)
            if resp.status_code == 200:
                arr = np.frombuffer(resp.content, np.uint8)
                img = cv2.imdecode(arr, cv2.IMREAD_UNCHANGED)
                if img is not None and img.shape[2] == 4:
                    alpha = img[:, :, 3]
                    # if border tile
                    if 0 < cv2.countNonZero(alpha) < alpha.size:
                        edges = cv2.Canny(alpha, 50, 150, apertureSize=3)
                        lines = cv2.HoughLinesP(edges, 1, np.pi/180, 50, minLineLength=50, maxLineGap=10)
                        if lines is not None:
                            best_len = 0
                            best_angle = None
                            for line in lines:
                                x1, y1, x2, y2 = line[0]
                                length = math.hypot(x2 - x1, y2 - y1)
                                angle_deg = math.degrees(math.atan2(y2 - y1, x2 - x1))
                                if length > best_len:
                                    best_len = length
                                    best_angle = angle_deg
                            if best_angle is not None:
                                return best_angle, best_len
        except Exception:
            pass
        return None, 0

    all_lines = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        for result in executor.map(fetch, tiles_to_fetch):
            angle, length = result
            if angle is not None:
                # normalize angle modulo 90
                norm = angle % 90
                if norm > 45: norm -= 90
                all_lines.append((norm, length))
                
    if not all_lines: return None
    
    # Weight average or just take the longest
    all_lines.sort(key=lambda x: x[1], reverse=True)
    # Average the top 5 longest lines
    top_lines = all_lines[:5]
    avg_angle = sum(a * l for a, l in top_lines) / sum(l for a, l in top_lines)
    return avg_angle

layers_minzoom = {
    "shanghai-1855": 11,
    "shanghai-1907": 10,
    "shanghai-1910": 10,
    "shanghai-1932": 13,
    "shanghai-1937": 10,
    "shanghai-1948": 10
}

for layer, z in layers_minzoom.items():
    angle = get_best_edge_angle(layer, z)
    print(f"{layer}: {angle}")
