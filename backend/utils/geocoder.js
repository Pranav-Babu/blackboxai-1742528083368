const NodeGeocoder = require('node-geocoder');
const ErrorResponse = require('./errorResponse');

class GeocodingService {
  constructor() {
    // Initialize geocoder with provider (e.g., Google Maps, Mapbox, etc.)
    this.geocoder = NodeGeocoder({
      provider: process.env.GEOCODER_PROVIDER || 'google',
      apiKey: process.env.GEOCODER_API_KEY,
      formatter: null
    });
  }

  /**
   * Geocode address to coordinates
   * @param {Object} address 
   * @returns {Promise<Object>}
   */
  async geocodeAddress(address) {
    try {
      const formattedAddress = this.formatAddress(address);
      const results = await this.geocoder.geocode(formattedAddress);

      if (!results || results.length === 0) {
        throw new ErrorResponse('Address not found', 404);
      }

      const location = {
        type: 'Point',
        coordinates: [results[0].longitude, results[0].latitude],
        formattedAddress: results[0].formattedAddress,
        street: results[0].streetName,
        city: results[0].city,
        state: results[0].administrativeLevels.level1long,
        zipcode: results[0].zipcode,
        country: results[0].country
      };

      return location;
    } catch (error) {
      console.error('Geocoding failed:', error);
      throw new ErrorResponse('Failed to geocode address', 500);
    }
  }

  /**
   * Reverse geocode coordinates to address
   * @param {number} latitude 
   * @param {number} longitude 
   * @returns {Promise<Object>}
   */
  async reverseGeocode(latitude, longitude) {
    try {
      const results = await this.geocoder.reverse({ lat: latitude, lon: longitude });

      if (!results || results.length === 0) {
        throw new ErrorResponse('Location not found', 404);
      }

      const location = {
        formattedAddress: results[0].formattedAddress,
        street: results[0].streetName,
        city: results[0].city,
        state: results[0].administrativeLevels.level1long,
        zipcode: results[0].zipcode,
        country: results[0].country
      };

      return location;
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      throw new ErrorResponse('Failed to reverse geocode location', 500);
    }
  }

  /**
   * Calculate distance between two points
   * @param {number} lat1 
   * @param {number} lon1 
   * @param {number} lat2 
   * @param {number} lon2 
   * @param {string} unit 
   * @returns {number}
   */
  calculateDistance(lat1, lon1, lat2, lon2, unit = 'km') {
    // Convert latitude and longitude to radians
    const radLat1 = (Math.PI * lat1) / 180;
    const radLon1 = (Math.PI * lon1) / 180;
    const radLat2 = (Math.PI * lat2) / 180;
    const radLon2 = (Math.PI * lon2) / 180;

    // Haversine formula
    const R = unit === 'km' ? 6371 : 3959; // Earth's radius in km or miles
    const dLat = radLat2 - radLat1;
    const dLon = radLon2 - radLon1;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(radLat1) * Math.cos(radLat2) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Find nearby pharmacies
   * @param {number} latitude 
   * @param {number} longitude 
   * @param {number} radius 
   * @returns {Object}
   */
  getNearbyPharmaciesQuery(latitude, longitude, radius = 10) {
    return {
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          $maxDistance: radius * 1000 // Convert km to meters
        }
      }
    };
  }

  /**
   * Format address object to string
   * @param {Object} address 
   * @returns {string}
   * @private
   */
  formatAddress(address) {
    const components = [
      address.street,
      address.city,
      address.state,
      address.zipCode,
      address.country || 'India' // Default country
    ];

    return components.filter(Boolean).join(', ');
  }

  /**
   * Validate coordinates
   * @param {number} latitude 
   * @param {number} longitude 
   * @returns {boolean}
   */
  validateCoordinates(latitude, longitude) {
    return (
      !isNaN(latitude) &&
      !isNaN(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  }

  /**
   * Calculate delivery zone
   * @param {Object} pharmacyLocation 
   * @param {number} maxRadius 
   * @returns {Object}
   */
  calculateDeliveryZone(pharmacyLocation, maxRadius = 10) {
    const coordinates = pharmacyLocation.coordinates;
    return {
      center: coordinates,
      radius: maxRadius,
      polygon: this.createCirclePolygon(coordinates[1], coordinates[0], maxRadius)
    };
  }

  /**
   * Create circle polygon for delivery zone
   * @param {number} centerLat 
   * @param {number} centerLon 
   * @param {number} radiusKm 
   * @returns {Array}
   * @private
   */
  createCirclePolygon(centerLat, centerLon, radiusKm) {
    const points = 32; // Number of points in the polygon
    const coords = [];
    const kmInLongitude = 111.32; // Approximate km per degree of longitude at equator

    for (let i = 0; i < points; i++) {
      const angle = (i * 360) / points;
      const radiusLat = radiusKm / 111.12; // Convert km to degrees latitude
      const radiusLon = radiusKm / (kmInLongitude * Math.cos(centerLat * Math.PI / 180));

      const lat = centerLat + radiusLat * Math.sin(angle * Math.PI / 180);
      const lon = centerLon + radiusLon * Math.cos(angle * Math.PI / 180);

      coords.push([lon, lat]);
    }

    // Close the polygon
    coords.push(coords[0]);

    return coords;
  }

  /**
   * Check if delivery is possible to location
   * @param {Object} pharmacyLocation 
   * @param {Object} deliveryLocation 
   * @param {number} maxRadius 
   * @returns {boolean}
   */
  isDeliveryPossible(pharmacyLocation, deliveryLocation, maxRadius = 10) {
    const distance = this.calculateDistance(
      pharmacyLocation.coordinates[1],
      pharmacyLocation.coordinates[0],
      deliveryLocation.coordinates[1],
      deliveryLocation.coordinates[0]
    );

    return distance <= maxRadius;
  }

  /**
   * Calculate delivery charge based on distance
   * @param {Object} pharmacyLocation 
   * @param {Object} deliveryLocation 
   * @param {Object} options 
   * @returns {number}
   */
  calculateDeliveryCharge(pharmacyLocation, deliveryLocation, options = {}) {
    const {
      baseCharge = 50,
      chargePerKm = 10,
      minCharge = 50,
      maxCharge = 200
    } = options;

    const distance = this.calculateDistance(
      pharmacyLocation.coordinates[1],
      pharmacyLocation.coordinates[0],
      deliveryLocation.coordinates[1],
      deliveryLocation.coordinates[0]
    );

    const charge = baseCharge + (distance * chargePerKm);
    return Math.min(Math.max(charge, minCharge), maxCharge);
  }
}

module.exports = new GeocodingService();