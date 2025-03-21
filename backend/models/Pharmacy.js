const mongoose = require('mongoose');

const pharmacySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  storeName: {
    type: String,
    required: [true, 'Please add a store name'],
    trim: true,
    maxlength: [100, 'Store name cannot be more than 100 characters']
  },
  licenseNumber: {
    type: String,
    required: [true, 'Please add a license number'],
    unique: true,
    trim: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true,
      index: '2dsphere'
    }
  },
  address: {
    street: {
      type: String,
      required: [true, 'Please add a street address']
    },
    city: {
      type: String,
      required: [true, 'Please add a city']
    },
    state: {
      type: String,
      required: [true, 'Please add a state']
    },
    zipCode: {
      type: String,
      required: [true, 'Please add a zip code']
    }
  },
  contactInfo: {
    phone: {
      type: String,
      required: [true, 'Please add a phone number']
    },
    email: {
      type: String,
      required: [true, 'Please add an email']
    },
    alternatePhone: String
  },
  operatingHours: [{
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      required: true
    },
    open: {
      type: String,
      required: true
    },
    close: {
      type: String,
      required: true
    },
    isOpen: {
      type: Boolean,
      default: true
    }
  }],
  deliverySlots: [{
    time: {
      type: String,
      enum: ['6 AM', '9 AM', '12 PM', '3 PM', '6 PM', '9 PM', '12 AM'],
      required: true
    },
    maxOrders: {
      type: Number,
      default: 10
    },
    currentOrders: {
      type: Number,
      default: 0
    }
  }],
  ratings: {
    average: {
      type: Number,
      default: 0,
      min: [0, 'Rating must be at least 0'],
      max: [5, 'Rating cannot be more than 5']
    },
    count: {
      type: Number,
      default: 0
    }
  },
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      required: true,
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  services: [{
    type: String,
    enum: ['Home Delivery', 'Night Service', '24x7', 'Online Consultation']
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  documents: {
    licenseCopy: {
      type: String,
      required: [true, 'Please upload pharmacy license']
    },
    ownerIdProof: {
      type: String,
      required: [true, 'Please upload owner ID proof']
    },
    additionalDocs: [String]
  },
  statistics: {
    totalOrders: {
      type: Number,
      default: 0
    },
    completedOrders: {
      type: Number,
      default: 0
    },
    cancelledOrders: {
      type: Number,
      default: 0
    },
    averageResponseTime: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create 2dsphere index for location
pharmacySchema.index({ location: '2dsphere' });

// Virtual for getting all medicines associated with this pharmacy
pharmacySchema.virtual('medicines', {
  ref: 'Medicine',
  localField: '_id',
  foreignField: 'pharmacy',
  justOne: false
});

// Method to check if delivery slot is available
pharmacySchema.methods.isDeliverySlotAvailable = function(slotTime) {
  const slot = this.deliverySlots.find(slot => slot.time === slotTime);
  return slot && slot.currentOrders < slot.maxOrders;
};

// Method to increment order count for a slot
pharmacySchema.methods.incrementSlotOrderCount = async function(slotTime) {
  const slot = this.deliverySlots.find(slot => slot.time === slotTime);
  if (slot) {
    slot.currentOrders += 1;
    await this.save();
    return true;
  }
  return false;
};

// Method to update pharmacy statistics
pharmacySchema.methods.updateStatistics = async function(orderStatus) {
  this.statistics.totalOrders += 1;
  if (orderStatus === 'completed') {
    this.statistics.completedOrders += 1;
  } else if (orderStatus === 'cancelled') {
    this.statistics.cancelledOrders += 1;
  }
  await this.save();
};

// Method to calculate and update average rating
pharmacySchema.methods.updateRating = async function(newRating) {
  const oldTotal = this.ratings.average * this.ratings.count;
  this.ratings.count += 1;
  this.ratings.average = (oldTotal + newRating) / this.ratings.count;
  await this.save();
};

module.exports = mongoose.model('Pharmacy', pharmacySchema);