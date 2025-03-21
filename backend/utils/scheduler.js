const schedule = require('node-schedule');
const Order = require('../models/Order');
const Prescription = require('../models/Prescription');
const Medicine = require('../models/Medicine');
const notifications = require('./notifications');
const ErrorResponse = require('./errorResponse');

class Scheduler {
  constructor() {
    this.jobs = new Map();
    this.initializeScheduledTasks();
  }

  /**
   * Initialize all scheduled tasks
   * @private
   */
  async initializeScheduledTasks() {
    // Schedule daily tasks
    this.scheduleDailyTasks();

    // Restore scheduled jobs for existing orders
    await this.restoreOrderTimers();

    // Restore medicine reminders
    await this.restoreMedicineReminders();

    // Schedule prescription expiry checks
    this.schedulePrescriptionExpiryCheck();

    // Schedule inventory checks
    this.scheduleInventoryChecks();
  }

  /**
   * Schedule daily tasks
   * @private
   */
  scheduleDailyTasks() {
    // Run daily at midnight
    schedule.scheduleJob('0 0 * * *', async () => {
      try {
        await this.checkPrescriptionRefills();
        await this.checkMedicineExpiry();
        await this.generateDailyReports();
      } catch (error) {
        console.error('Daily tasks failed:', error);
      }
    });
  }

  /**
   * Restore order timers from database
   * @private
   */
  async restoreOrderTimers() {
    try {
      const pendingOrders = await Order.find({
        status: { $in: ['pending_approval', 'approved'] },
        'approvalTimers.pharmacyApprovalEnd': { $gt: new Date() }
      });

      pendingOrders.forEach(order => {
        this.scheduleOrderTimeout(order);
      });
    } catch (error) {
      console.error('Failed to restore order timers:', error);
    }
  }

  /**
   * Schedule order timeout
   * @param {Object} order 
   * @returns {void}
   */
  scheduleOrderTimeout(order) {
    const jobId = `order_${order._id}`;

    // Cancel existing job if any
    if (this.jobs.has(jobId)) {
      this.jobs.get(jobId).cancel();
    }

    // Schedule new job
    const job = schedule.scheduleJob(order.approvalTimers.pharmacyApprovalEnd, async () => {
      try {
        const updatedOrder = await Order.findById(order._id);
        
        if (updatedOrder.status === 'pending_approval') {
          updatedOrder.status = 'cancelled';
          updatedOrder.notes.systemNote = 'Order auto-cancelled due to timeout';
          await updatedOrder.save();

          // Notify customer
          await notifications.sendOrderStatusNotification(updatedOrder, updatedOrder.customer);
        }
      } catch (error) {
        console.error(`Order timeout processing failed for order ${order._id}:`, error);
      } finally {
        this.jobs.delete(jobId);
      }
    });

    this.jobs.set(jobId, job);
  }

  /**
   * Restore medicine reminders
   * @private
   */
  async restoreMedicineReminders() {
    try {
      // TODO: Implement medicine reminder restoration from database
    } catch (error) {
      console.error('Failed to restore medicine reminders:', error);
    }
  }

  /**
   * Schedule prescription expiry check
   * @private
   */
  schedulePrescriptionExpiryCheck() {
    // Run daily at 1 AM
    schedule.scheduleJob('0 1 * * *', async () => {
      try {
        const expiredPrescriptions = await Prescription.find({
          status: { $ne: 'expired' },
          validity: { $lt: new Date() }
        });

        for (const prescription of expiredPrescriptions) {
          prescription.status = 'expired';
          await prescription.save();

          // Notify customer
          await notifications.sendPrescriptionVerificationNotification(
            prescription,
            prescription.customer
          );
        }
      } catch (error) {
        console.error('Prescription expiry check failed:', error);
      }
    });
  }

  /**
   * Schedule inventory checks
   * @private
   */
  scheduleInventoryChecks() {
    // Run every 6 hours
    schedule.scheduleJob('0 */6 * * *', async () => {
      try {
        const lowStockMedicines = await Medicine.find({
          stock: { $lt: 10 },
          status: 'active'
        }).populate('pharmacy');

        for (const medicine of lowStockMedicines) {
          await notifications.sendLowStockAlert(medicine, medicine.pharmacy);
        }
      } catch (error) {
        console.error('Inventory check failed:', error);
      }
    });
  }

  /**
   * Check prescription refills
   * @private
   */
  async checkPrescriptionRefills() {
    try {
      const refillablePrescriptions = await Prescription.find({
        isRecurring: true,
        'recurringDetails.remainingRefills': { $gt: 0 },
        'recurringDetails.nextRefillDate': { $lte: new Date() }
      }).populate('customer');

      for (const prescription of refillablePrescriptions) {
        if (prescription.checkRefillStatus()) {
          await prescription.processRefill();
          await notifications.sendPrescriptionVerificationNotification(
            prescription,
            prescription.customer
          );
        }
      }
    } catch (error) {
      console.error('Prescription refill check failed:', error);
    }
  }

  /**
   * Check medicine expiry
   * @private
   */
  async checkMedicineExpiry() {
    try {
      const expiringMedicines = await Medicine.find({
        expiryDate: {
          $gt: new Date(),
          $lt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        },
        status: 'active'
      }).populate('pharmacy');

      for (const medicine of expiringMedicines) {
        await notifications.sendLowStockAlert(medicine, medicine.pharmacy);
      }
    } catch (error) {
      console.error('Medicine expiry check failed:', error);
    }
  }

  /**
   * Generate daily reports
   * @private
   */
  async generateDailyReports() {
    try {
      // TODO: Implement daily report generation
    } catch (error) {
      console.error('Daily report generation failed:', error);
    }
  }

  /**
   * Schedule medicine reminder
   * @param {Object} reminder 
   * @param {Object} user 
   * @returns {void}
   */
  scheduleMedicineReminder(reminder, user) {
    const jobId = `reminder_${reminder._id}`;

    // Cancel existing job if any
    if (this.jobs.has(jobId)) {
      this.jobs.get(jobId).cancel();
    }

    // Schedule new job
    const job = schedule.scheduleJob(reminder.schedule, async () => {
      try {
        await notifications.sendMedicineReminder(reminder, user);
      } catch (error) {
        console.error(`Medicine reminder failed for ${reminder._id}:`, error);
      }
    });

    this.jobs.set(jobId, job);
  }

  /**
   * Cancel scheduled job
   * @param {string} jobId 
   * @returns {boolean}
   */
  cancelJob(jobId) {
    if (this.jobs.has(jobId)) {
      this.jobs.get(jobId).cancel();
      this.jobs.delete(jobId);
      return true;
    }
    return false;
  }

  /**
   * Get all active jobs
   * @returns {Map}
   */
  getActiveJobs() {
    return new Map(this.jobs);
  }

  /**
   * Clean up all jobs
   */
  cleanup() {
    for (const job of this.jobs.values()) {
      job.cancel();
    }
    this.jobs.clear();
  }
}

module.exports = new Scheduler();