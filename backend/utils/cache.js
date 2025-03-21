const NodeCache = require('node-cache');
const config = require('../config/config');
const logger = require('./logger');

class CacheService {
  constructor() {
    this.cache = new NodeCache({
      stdTTL: config.cache.ttl / 1000, // Convert to seconds
      checkperiod: config.cache.checkPeriod / 1000,
      useClones: false
    });

    // Listen for cache events
    this.setupEventListeners();
  }

  /**
   * Set up cache event listeners
   * @private
   */
  setupEventListeners() {
    this.cache.on('set', (key, value) => {
      logger.debug('Cache set', { key, size: JSON.stringify(value).length });
    });

    this.cache.on('del', (key, value) => {
      logger.debug('Cache delete', { key });
    });

    this.cache.on('expired', (key, value) => {
      logger.debug('Cache expired', { key });
    });

    this.cache.on('flush', () => {
      logger.debug('Cache flushed');
    });
  }

  /**
   * Generate cache key
   * @param {string} prefix 
   * @param {Object} params 
   * @returns {string}
   * @private
   */
  generateKey(prefix, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {});

    return `${prefix}:${JSON.stringify(sortedParams)}`;
  }

  /**
   * Get value from cache
   * @param {string} key 
   * @returns {any}
   */
  get(key) {
    try {
      const value = this.cache.get(key);
      logger.debug('Cache get', { key, hit: !!value });
      return value;
    } catch (error) {
      logger.error('Cache get error', { key, error: error.message });
      return null;
    }
  }

  /**
   * Set value in cache
   * @param {string} key 
   * @param {any} value 
   * @param {number} ttl 
   * @returns {boolean}
   */
  set(key, value, ttl = config.cache.ttl / 1000) {
    try {
      const success = this.cache.set(key, value, ttl);
      logger.debug('Cache set', { key, ttl, success });
      return success;
    } catch (error) {
      logger.error('Cache set error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Delete value from cache
   * @param {string} key 
   * @returns {number}
   */
  delete(key) {
    try {
      const deleted = this.cache.del(key);
      logger.debug('Cache delete', { key, deleted });
      return deleted;
    } catch (error) {
      logger.error('Cache delete error', { key, error: error.message });
      return 0;
    }
  }

  /**
   * Clear all cache
   * @returns {void}
   */
  flush() {
    try {
      this.cache.flushAll();
      logger.debug('Cache flushed');
    } catch (error) {
      logger.error('Cache flush error', { error: error.message });
    }
  }

  /**
   * Get cache statistics
   * @returns {Object}
   */
  getStats() {
    return this.cache.getStats();
  }

  /**
   * Cache middleware for Express routes
   * @param {string} prefix 
   * @param {number} ttl 
   * @returns {Function}
   */
  middleware(prefix, ttl) {
    return (req, res, next) => {
      const key = this.generateKey(prefix, {
        url: req.originalUrl,
        params: req.params,
        query: req.query,
        body: req.method === 'GET' ? undefined : req.body
      });

      const cachedResponse = this.get(key);

      if (cachedResponse) {
        return res.json(cachedResponse);
      }

      // Store original send function
      const originalSend = res.json;

      // Override send function
      res.json = (body) => {
        // Restore original send
        res.json = originalSend;

        // Cache the response
        this.set(key, body, ttl);

        // Send the response
        return res.json(body);
      };

      next();
    };
  }

  /**
   * Cache decorator for class methods
   * @param {string} prefix 
   * @param {number} ttl 
   * @returns {Function}
   */
  decorator(prefix, ttl) {
    return function(target, propertyKey, descriptor) {
      const originalMethod = descriptor.value;

      descriptor.value = async function(...args) {
        const key = this.cache.generateKey(prefix, {
          method: propertyKey,
          args
        });

        const cachedResult = this.cache.get(key);
        if (cachedResult) {
          return cachedResult;
        }

        const result = await originalMethod.apply(this, args);
        this.cache.set(key, result, ttl);

        return result;
      };

      return descriptor;
    };
  }

  /**
   * Cache medicine data
   * @param {string} id 
   * @param {Object} data 
   * @returns {boolean}
   */
  cacheMedicine(id, data) {
    return this.set(`medicine:${id}`, data);
  }

  /**
   * Cache pharmacy data
   * @param {string} id 
   * @param {Object} data 
   * @returns {boolean}
   */
  cachePharmacy(id, data) {
    return this.set(`pharmacy:${id}`, data);
  }

  /**
   * Cache user data
   * @param {string} id 
   * @param {Object} data 
   * @returns {boolean}
   */
  cacheUser(id, data) {
    // Don't cache sensitive information
    const { password, resetPasswordToken, ...safeData } = data;
    return this.set(`user:${id}`, safeData);
  }

  /**
   * Cache search results
   * @param {string} query 
   * @param {Object} results 
   * @returns {boolean}
   */
  cacheSearchResults(query, results) {
    return this.set(`search:${query}`, results, 300); // 5 minutes TTL for search results
  }

  /**
   * Cache category data
   * @param {string} category 
   * @param {Object} data 
   * @returns {boolean}
   */
  cacheCategory(category, data) {
    return this.set(`category:${category}`, data, 3600); // 1 hour TTL for categories
  }

  /**
   * Invalidate user-related caches
   * @param {string} userId 
   * @returns {void}
   */
  invalidateUserCache(userId) {
    const keys = [
      `user:${userId}`,
      `user:${userId}:orders`,
      `user:${userId}:prescriptions`
    ];
    keys.forEach(key => this.delete(key));
  }

  /**
   * Invalidate pharmacy-related caches
   * @param {string} pharmacyId 
   * @returns {void}
   */
  invalidatePharmacyCache(pharmacyId) {
    const keys = [
      `pharmacy:${pharmacyId}`,
      `pharmacy:${pharmacyId}:medicines`,
      `pharmacy:${pharmacyId}:orders`
    ];
    keys.forEach(key => this.delete(key));
  }

  /**
   * Invalidate medicine-related caches
   * @param {string} medicineId 
   * @returns {void}
   */
  invalidateMedicineCache(medicineId) {
    const keys = [
      `medicine:${medicineId}`,
      'medicines:featured',
      'medicines:popular'
    ];
    keys.forEach(key => this.delete(key));
  }
}

module.exports = new CacheService();