const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pharmacy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pharmacy',
    required: true
  },
  items: [{
    medicine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1']
    },
    price: {
      type: Number,
      required: true
    },
    discountedPrice: {
      type: Number
    },
    selected: {  // For tick-box feature in cart
      type: Boolean,
      default: true
    },
    status: {
      type: String,
      enum: ['available', 'out_of_stock', 'alternative_suggested'],
      default: 'available'
    },
    alternativeMedicine: {
      medicine: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Medicine'
      },
      reason: String
    }
  }],
  prescription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription'
  },
  totalAmount: {
    type: Number,
    required: true
  },
  discountedAmount: {
    type: Number
  },
  deliveryCharge: {
    type: Number,
    default: 0
  },
  finalAmount: {
    type: Number,
    required: true
  },
  deliverySlot: {
    date: {
      type: Date,
      required: true
    },
    time: {
      type: String,
      enum: ['6 AM', '9 AM', '12 PM', '3 PM', '6 PM', '9 PM', '12 AM'],
      required: true
    }
  },
  deliveryAddress: {
    street: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    zipCode: {
      type: String,
      required: true
    },
    landmark: String,
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        required: true
      }
    }
  },
  status: {
    type: String,
    enum: [
      'cart',              // Initial state when items are in cart
      'pending_approval',  // Submitted to pharmacy for approval
      'approved',          // Pharmacy approved the order
      'rejected',          // Pharmacy rejected the order
      'payment_pending',   // Waiting for payment
      'paid',             // Payment received
      'processing',       // Order is being prepared
      'ready_for_delivery', // Order ready for delivery
      'out_for_delivery',  // Order is out for delivery
      'delivered',        // Order successfully delivered
      'cancelled',        // Order cancelled
      'refunded'          // Order refunded
    ],
    default: 'cart'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'wallet'],
  },
  paymentDetails: {
    transactionId: String,
    paymentDate: Date,
    paymentProof: String
  },
  approvalTimers: {
    pharmacyApprovalStart: Date,
    pharmacyApprovalEnd: Date,
    customerConfirmationStart: Date,
    customerConfirmationEnd: Date
  },
  notes: {
    customerNote: String,
    pharmacyNote: String,
    deliveryNote: String
  },
  rating: {
    value: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    createdAt: Date
  },
  timeline: [{
    status: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create indexes
orderSchema.index({ customer: 1, status: 1 });
orderSchema.index({ pharmacy: 1, status: 1 });
orderSchema.index({ 'deliverySlot.date': 1 });

// Virtual for time remaining for pharmacy approval
orderSchema.virtual('pharmacyApprovalTimeRemaining').get(function() {
  if (this.approvalTimers.pharmacyApprovalEnd) {
    const remaining = this.approvalTimers.pharmacyApprovalEnd - new Date();
    return Math.max(0, remaining);
  }
  return 0;
});

// Virtual for time remaining for customer confirmation
orderSchema.virtual('customerConfirmationTimeRemaining').get(function() {
  if (this.approvalTimers.customerConfirmationEnd) {
    const remaining = this.approvalTimers.customerConfirmationEnd - new Date();
    return Math.max(0, remaining);
  }
  return 0;
});

// Method to start pharmacy approval timer
orderSchema.methods.startPharmacyApprovalTimer = function() {
  this.approvalTimers.pharmacyApprovalStart = new Date();
  this.approvalTimers.pharmacyApprovalEnd = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  return this.save();
};

// Method to start customer confirmation timer
orderSchema.methods.startCustomerConfirmationTimer = function() {
  this.approvalTimers.customerConfirmationStart = new Date();
  this.approvalTimers.customerConfirmationEnd = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  return this.save();
};

// Method to extend timer
orderSchema.methods.extendTimer = function(timerType, extensionMinutes = 5) {
  if (timerType === 'pharmacy') {
    this.approvalTimers.pharmacyApprovalEnd = new Date(
      this.approvalTimers.pharmacyApprovalEnd.getTime() + extensionMinutes * 60 * 1000
    );
  } else if (timerType === 'customer') {
    this.approvalTimers.customerConfirmationEnd = new Date(
      this.approvalTimers.customerConfirmationEnd.getTime() + extensionMinutes * 60 * 1000
    );
  }
  return this.save();
};

// Method to add timeline event
orderSchema.methods.addTimelineEvent = function(status, note = '') {
  this.timeline.push({
    status,
    timestamp: new Date(),
    note
  });
  return this.save();
};

// Method to calculate order amounts
orderSchema.methods.calculateAmounts = function() {
  let totalAmount = 0;
  let discountedAmount = 0;

  this.items.forEach(item => {
    if (item.selected) {
      totalAmount += item.price * item.quantity;
      if (item.discountedPrice) {
        discountedAmount += item.discountedPrice * item.quantity;
      }
    }
  });

  this.totalAmount = totalAmount;
  this.discountedAmount = discountedAmount || totalAmount;
  this.finalAmount = this.discountedAmount + this.deliveryCharge;

  return this.save();
};

// Static method to find orders by status
orderSchema.statics.findByStatus = function(status) {
  return this.find({ status })
    .populate('customer', 'name email phone')
    .populate('pharmacy', 'storeName contactInfo')
    .populate('items.medicine', 'name manufacturer price');
};

module.exports = mongoose.model('Order', orderSchema);