const Order = require('../models/Order');
const Medicine = require('../models/Medicine');
const Pharmacy = require('../models/Pharmacy');
const User = require('../models/User');
const logger = require('./logger');
const cache = require('./cache');

class AnalyticsService {
  /**
   * Get pharmacy analytics
   * @param {string} pharmacyId 
   * @param {Object} dateRange 
   * @returns {Promise<Object>}
   */
  async getPharmacyAnalytics(pharmacyId, dateRange) {
    try {
      const cacheKey = `analytics:pharmacy:${pharmacyId}:${dateRange.start}:${dateRange.end}`;
      const cachedData = cache.get(cacheKey);

      if (cachedData) {
        return cachedData;
      }

      const query = {
        pharmacy: pharmacyId,
        createdAt: {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end)
        }
      };

      const [
        orderStats,
        revenueStats,
        popularMedicines,
        customerStats
      ] = await Promise.all([
        this.getOrderStatistics(query),
        this.getRevenueStatistics(query),
        this.getPopularMedicines(pharmacyId, dateRange),
        this.getCustomerStatistics(pharmacyId, dateRange)
      ]);

      const analytics = {
        orderStats,
        revenueStats,
        popularMedicines,
        customerStats,
        generatedAt: new Date()
      };

      // Cache for 1 hour
      cache.set(cacheKey, analytics, 3600);

      return analytics;
    } catch (error) {
      logger.error('Failed to get pharmacy analytics', {
        pharmacyId,
        dateRange,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get order statistics
   * @param {Object} query 
   * @returns {Promise<Object>}
   * @private
   */
  async getOrderStatistics(query) {
    const stats = await Order.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$finalAmount' }
        }
      }
    ]);

    return stats.reduce((acc, stat) => {
      acc[stat._id] = {
        count: stat.count,
        totalAmount: stat.totalAmount
      };
      return acc;
    }, {});
  }

  /**
   * Get revenue statistics
   * @param {Object} query 
   * @returns {Promise<Object>}
   * @private
   */
  async getRevenueStatistics(query) {
    return await Order.aggregate([
      { $match: { ...query, status: 'delivered' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          revenue: { $sum: '$finalAmount' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);
  }

  /**
   * Get popular medicines
   * @param {string} pharmacyId 
   * @param {Object} dateRange 
   * @returns {Promise<Array>}
   * @private
   */
  async getPopularMedicines(pharmacyId, dateRange) {
    return await Order.aggregate([
      {
        $match: {
          pharmacy: pharmacyId,
          status: 'delivered',
          createdAt: {
            $gte: new Date(dateRange.start),
            $lte: new Date(dateRange.end)
          }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.medicine',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'medicines',
          localField: '_id',
          foreignField: '_id',
          as: 'medicineDetails'
        }
      },
      { $unwind: '$medicineDetails' }
    ]);
  }

  /**
   * Get customer statistics
   * @param {string} pharmacyId 
   * @param {Object} dateRange 
   * @returns {Promise<Object>}
   * @private
   */
  async getCustomerStatistics(pharmacyId, dateRange) {
    const customerStats = await Order.aggregate([
      {
        $match: {
          pharmacy: pharmacyId,
          status: 'delivered',
          createdAt: {
            $gte: new Date(dateRange.start),
            $lte: new Date(dateRange.end)
          }
        }
      },
      {
        $group: {
          _id: '$customer',
          orderCount: { $sum: 1 },
          totalSpent: { $sum: '$finalAmount' }
        }
      },
      { $sort: { orderCount: -1 } }
    ]);

    return {
      totalCustomers: customerStats.length,
      topCustomers: await this.enrichCustomerData(customerStats.slice(0, 10))
    };
  }

  /**
   * Enrich customer data with user details
   * @param {Array} customers 
   * @returns {Promise<Array>}
   * @private
   */
  async enrichCustomerData(customers) {
    return await Promise.all(
      customers.map(async (customer) => {
        const userData = await User.findById(customer._id)
          .select('name email phone');
        return {
          ...customer,
          user: userData
        };
      })
    );
  }

  /**
   * Generate daily report
   * @param {string} pharmacyId 
   * @returns {Promise<Object>}
   */
  async generateDailyReport(pharmacyId) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    return await this.getPharmacyAnalytics(pharmacyId, {
      start: yesterday,
      end: today
    });
  }

  /**
   * Generate monthly report
   * @param {string} pharmacyId 
   * @param {number} month 
   * @param {number} year 
   * @returns {Promise<Object>}
   */
  async generateMonthlyReport(pharmacyId, month, year) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    return await this.getPharmacyAnalytics(pharmacyId, {
      start: startDate,
      end: endDate
    });
  }

  /**
   * Get inventory analytics
   * @param {string} pharmacyId 
   * @returns {Promise<Object>}
   */
  async getInventoryAnalytics(pharmacyId) {
    try {
      const medicines = await Medicine.find({ pharmacy: pharmacyId });

      const analytics = {
        totalMedicines: medicines.length,
        lowStock: medicines.filter(m => m.stock < 10).length,
        outOfStock: medicines.filter(m => m.stock === 0).length,
        expiringWithin30Days: medicines.filter(m => {
          const daysUntilExpiry = Math.ceil(
            (m.expiryDate - new Date()) / (1000 * 60 * 60 * 24)
          );
          return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
        }).length,
        categoryDistribution: medicines.reduce((acc, medicine) => {
          acc[medicine.category] = (acc[medicine.category] || 0) + 1;
          return acc;
        }, {})
      };

      return analytics;
    } catch (error) {
      logger.error('Failed to get inventory analytics', {
        pharmacyId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get delivery analytics
   * @param {string} pharmacyId 
   * @param {Object} dateRange 
   * @returns {Promise<Object>}
   */
  async getDeliveryAnalytics(pharmacyId, dateRange) {
    try {
      const deliveryStats = await Order.aggregate([
        {
          $match: {
            pharmacy: pharmacyId,
            status: { $in: ['delivered', 'cancelled'] },
            createdAt: {
              $gte: new Date(dateRange.start),
              $lte: new Date(dateRange.end)
            }
          }
        },
        {
          $group: {
            _id: '$deliverySlot.time',
            totalOrders: { $sum: 1 },
            deliveredOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
            },
            cancelledOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
            }
          }
        }
      ]);

      return {
        slotWiseAnalytics: deliveryStats,
        summary: deliveryStats.reduce((acc, stat) => {
          acc.totalOrders += stat.totalOrders;
          acc.deliveredOrders += stat.deliveredOrders;
          acc.cancelledOrders += stat.cancelledOrders;
          return acc;
        }, { totalOrders: 0, deliveredOrders: 0, cancelledOrders: 0 })
      };
    } catch (error) {
      logger.error('Failed to get delivery analytics', {
        pharmacyId,
        dateRange,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new AnalyticsService();