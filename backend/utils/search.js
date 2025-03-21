const Medicine = require('../models/Medicine');
const Pharmacy = require('../models/Pharmacy');
const logger = require('./logger');
const cache = require('./cache');
const geocoder = require('./geocoder');

class SearchService {
  /**
   * Search medicines with advanced filtering
   * @param {Object} filters 
   * @param {Object} options 
   * @returns {Promise<Object>}
   */
  async searchMedicines(filters, options = {}) {
    try {
      const {
        search,
        category,
        subCategory,
        pharmacy,
        minPrice,
        maxPrice,
        inStock,
        prescriptionRequired,
        manufacturer,
        sort = '-createdAt',
        page = 1,
        limit = 10
      } = filters;

      // Build query
      const query = {};

      // Text search
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { genericName: { $regex: search, $options: 'i' } },
          { manufacturer: { $regex: search, $options: 'i' } },
          { searchKeywords: { $regex: search, $options: 'i' } }
        ];
      }

      // Category filters
      if (category) query.category = category;
      if (subCategory) query.subCategory = subCategory;

      // Pharmacy filter
      if (pharmacy) query.pharmacy = pharmacy;

      // Price range
      if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = parseFloat(minPrice);
        if (maxPrice) query.price.$lte = parseFloat(maxPrice);
      }

      // Stock filter
      if (inStock === 'true') query.stock = { $gt: 0 };

      // Prescription requirement
      if (prescriptionRequired !== undefined) {
        query.prescriptionRequired = prescriptionRequired === 'true';
      }

      // Manufacturer filter
      if (manufacturer) {
        query.manufacturer = { $regex: manufacturer, $options: 'i' };
      }

      // Status filter - only show active medicines
      query.status = 'active';

      // Cache key
      const cacheKey = `search:medicines:${JSON.stringify({ filters, options })}`;
      const cachedResult = cache.get(cacheKey);

      if (cachedResult) {
        return cachedResult;
      }

      // Execute query with pagination
      const skip = (page - 1) * limit;

      const [medicines, total] = await Promise.all([
        Medicine.find(query)
          .populate('pharmacy', 'storeName address contactInfo ratings')
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit)),
        Medicine.countDocuments(query)
      ]);

      const result = {
        medicines,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      };

      // Cache result for 5 minutes
      cache.set(cacheKey, result, 300);

      return result;
    } catch (error) {
      logger.error('Medicine search failed', {
        filters,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Search pharmacies with location-based filtering
   * @param {Object} filters 
   * @param {Object} options 
   * @returns {Promise<Object>}
   */
  async searchPharmacies(filters, options = {}) {
    try {
      const {
        search,
        latitude,
        longitude,
        radius = 10000, // Default 10km radius
        services,
        rating,
        openNow,
        sort = '-ratings.average',
        page = 1,
        limit = 10
      } = filters;

      // Build query
      const query = {
        status: 'active',
        verificationStatus: 'verified'
      };

      // Text search
      if (search) {
        query.$or = [
          { storeName: { $regex: search, $options: 'i' } },
          { 'address.city': { $regex: search, $options: 'i' } }
        ];
      }

      // Location-based search
      if (latitude && longitude) {
        query.location = {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(longitude), parseFloat(latitude)]
            },
            $maxDistance: parseInt(radius)
          }
        };
      }

      // Services filter
      if (services) {
        query.services = { $all: Array.isArray(services) ? services : [services] };
      }

      // Rating filter
      if (rating) {
        query['ratings.average'] = { $gte: parseFloat(rating) };
      }

      // Open now filter
      if (openNow === 'true') {
        const now = new Date();
        const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
        const time = now.toTimeString().slice(0, 5); // HH:MM format

        query['operatingHours'] = {
          $elemMatch: {
            day,
            isOpen: true,
            open: { $lte: time },
            close: { $gte: time }
          }
        };
      }

      // Cache key
      const cacheKey = `search:pharmacies:${JSON.stringify({ filters, options })}`;
      const cachedResult = cache.get(cacheKey);

      if (cachedResult) {
        return cachedResult;
      }

      // Execute query with pagination
      const skip = (page - 1) * limit;

      const [pharmacies, total] = await Promise.all([
        Pharmacy.find(query)
          .populate('user', 'name email phone')
          .select('-documents -statistics')
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit)),
        Pharmacy.countDocuments(query)
      ]);

      // Calculate distances if location provided
      if (latitude && longitude) {
        pharmacies.forEach(pharmacy => {
          pharmacy._doc.distance = geocoder.calculateDistance(
            latitude,
            longitude,
            pharmacy.location.coordinates[1],
            pharmacy.location.coordinates[0]
          );
        });
      }

      const result = {
        pharmacies,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      };

      // Cache result for 5 minutes
      cache.set(cacheKey, result, 300);

      return result;
    } catch (error) {
      logger.error('Pharmacy search failed', {
        filters,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get medicine suggestions
   * @param {string} query 
   * @returns {Promise<Array>}
   */
  async getMedicineSuggestions(query) {
    try {
      const cacheKey = `suggestions:medicines:${query}`;
      const cachedSuggestions = cache.get(cacheKey);

      if (cachedSuggestions) {
        return cachedSuggestions;
      }

      const suggestions = await Medicine.find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { genericName: { $regex: query, $options: 'i' } },
          { searchKeywords: { $regex: query, $options: 'i' } }
        ],
        status: 'active'
      })
        .select('name genericName manufacturer category')
        .limit(10);

      // Cache suggestions for 1 hour
      cache.set(cacheKey, suggestions, 3600);

      return suggestions;
    } catch (error) {
      logger.error('Medicine suggestions failed', {
        query,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get trending searches
   * @returns {Promise<Array>}
   */
  async getTrendingSearches() {
    // TODO: Implement trending searches tracking and retrieval
    return [
      'paracetamol',
      'vitamin c',
      'face mask',
      'sanitizer',
      'blood pressure monitor'
    ];
  }

  /**
   * Search medicines by symptoms
   * @param {Array} symptoms 
   * @returns {Promise<Array>}
   */
  async searchBySymptoms(symptoms) {
    // TODO: Implement symptom-based medicine search
    return [];
  }

  /**
   * Get alternative medicines
   * @param {string} medicineId 
   * @returns {Promise<Array>}
   */
  async getAlternatives(medicineId) {
    try {
      const medicine = await Medicine.findById(medicineId);
      if (!medicine) return [];

      return await Medicine.find({
        _id: { $ne: medicineId },
        $or: [
          { genericName: medicine.genericName },
          { category: medicine.category, subCategory: medicine.subCategory }
        ],
        status: 'active'
      })
        .limit(5)
        .populate('pharmacy', 'storeName address contactInfo ratings');
    } catch (error) {
      logger.error('Alternative medicines search failed', {
        medicineId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new SearchService();