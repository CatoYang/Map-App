// Initialize the map, telling it we are NOT using standard geography
var map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -1
});

// Define your image bounds (e.g., a 2000x1500 pixel map)
var bounds = [[0,0], [1500, 2000]];
var image = L.imageOverlay('your-historical-map.jpg', bounds).addTo(map);

// Tell the map to fit the image to the screen
map.fitBounds(bounds);