#!/usr/bin/env python3
"""
calc_map_bearing.py

Utility script to calculate the rotation angle (bearing) of a historical map's 
drawn border within a georectified GeoTIFF image.

IMPORTANT: Because Leaflet renders maps in Web Mercator (EPSG:3857), you MUST 
warp the GeoTIFF to EPSG:3857 before running this script to account for 
meridian convergence. Do this using gdalwarp:
    gdalwarp -t_srs EPSG:3857 original.tif warped.tif

Dependencies:
    pip install opencv-python numpy

Usage:
    python3 calc_map_bearing.py <path_to_WARPED_geotiff>
"""

import sys
import math
import numpy as np
try:
    import cv2
except ImportError:
    print('Error: opencv-python is not installed. Please run: pip install opencv-python numpy')
    sys.exit(1)

def calculate_bearing(image_path):
    print(f'Loading image: {image_path} ...')
    # Load image in grayscale
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        print(f'Error: Could not read image at {image_path}')
        return

    # Resize image to speed up processing. Map borders are large macro features,
    # so we don't need full 10k x 10k resolution.
    max_dimension = 2000
    h, w = img.shape
    scale = min(max_dimension / w, max_dimension / h)
    if scale < 1.0:
        new_w, new_h = int(w * scale), int(h * scale)
        img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

    print('Applying edge detection...')
    # Blur to reduce noise
    blurred = cv2.GaussianBlur(img, (5, 5), 0)
    # Canny Edge detection
    edges = cv2.Canny(blurred, 50, 150, apertureSize=3)

    print('Detecting lines via Hough Transform...')
    # minLineLength should be a significant fraction of image size to only catch borders
    min_line_length = max(new_w, new_h) * 0.3 
    lines = cv2.HoughLinesP(edges, rho=1, theta=np.pi/180, threshold=100,
                            minLineLength=min_line_length, maxLineGap=20)

    if lines is None:
        print('No long lines detected.')
        return

    angles = []
    for line in lines:
        x1, y1, x2, y2 = line.flatten()
        # Calculate angle in degrees
        angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
        
        # Normalize angle to be between 0 and 180
        if angle < 0:
            angle += 180
            
        angles.append(angle)

    print(f'Detected {len(angles)} significant lines.')

    # Since the map has 4 borders, lines should cluster around two orthogonal angles
    horizontal_angles = []
    for a in angles:
        # Wrap angles near 180 to be near 0 for easy clustering
        if a > 135:
            a_wrapped = a - 180
        else:
            a_wrapped = a
            
        # If the line is roughly horizontal (-45 to 45)
        if -45 < a_wrapped < 45:
            horizontal_angles.append(a_wrapped)
            
    if not horizontal_angles:
        print('Could not detect horizontal border lines.')
        return

    # Median is robust against outliers
    median_angle = np.median(horizontal_angles)
    
    print('-' * 40)
    print(f'Estimated Map Border Bearing: {median_angle:.2f} degrees')
    print('-' * 40)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python3 calc_map_bearing.py <path_to_geotiff>')
        sys.exit(1)
        
    calculate_bearing(sys.argv[1])
