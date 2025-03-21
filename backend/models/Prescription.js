const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
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
  images: [{
    url: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  doctorDetails: {
    name: {
      type: String,
      required: true
    },
    registrationNumber: {
      type: String
    },
    hospital: String,
    specialization: String,
    consultationDate: Date
  },
  patientDetails: {
    name: {
      type: String,
      required: true
    },
    age: Number,
    gender: {
      type: String,
      enum: ['male', 'female', 'other']
    },
    weight: Number,
    height: Number
  },
  status: {
    type: String,
    enum: [
      'pending',           // Initial upload state
      'under_review',      // Pharmacist is reviewing
      'verified',          // Prescription verified
      'rejected',          // Prescription rejected
      'partially_approved', // Some medicines approved, some alternatives suggested
      'expired'            // Prescription validity expired
    ],
    default: 'pending'
  },
  verificationDetails: {
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'  // Reference to pharmacist who verified
    },
    verifiedAt: Date,
    notes: String,
    rejectionReason: String,
    validityPeriod: {
      start: Date,
      end: Date
    }
  },
  medicines: [{
    name: {
      type: String,
      required: true
    },
    dosage: String,
    frequency: String,
    duration: String,
    quantity: Number,
    instructions: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'alternative_suggested', 'unavailable'],
      default: 'pending'
    },
    alternative: {
      medicine: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Medicine'
      },
      reason: String
    }
  }],
  history: [{
    action: {
      type: String,
      enum: ['uploaded', 'reviewed', 'verified', 'rejected', 'resubmitted', 'expired']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: String
  }],
  forwardedTo: [{
    pharmacy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pharmacy'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    },
    response: String
  }],
  validity: {
    type: Date,
    required: true
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringDetails: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly']
    },
    nextRefillDate: Date,
    totalRefills: Number,
    remainingRefills: Number
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create indexes
prescriptionSchema.index({ customer: 1, status: 1 });
prescriptionSchema.index({ pharmacy: 1, status: 1 });
prescriptionSchema.index({ validity: 1 });

// Virtual for checking if prescription is valid
prescriptionSchema.virtual('isValid').get(function() {
  return new Date() <= this.validity;
});

// Virtual for time remaining until expiry
prescriptionSchema.virtual('validityRemaining').get(function() {
  if (this.validity) {
    const remaining = this.validity - new Date();
    return Math.max(0, remaining);
  }
  return 0;
});

// Method to add verification details
prescriptionSchema.methods.verify = async function(pharmacistId, notes, validityPeriod) {
  this.status = 'verified';
  this.verificationDetails = {
    verifiedBy: pharmacistId,
    verifiedAt: new Date(),
    notes: notes,
    validityPeriod: validityPeriod
  };
  
  // Add to history
  this.history.push({
    action: 'verified',
    performedBy: pharmacistId,
    notes: notes
  });
  
  return this.save();
};

// Method to reject prescription
prescriptionSchema.methods.reject = async function(pharmacistId, reason) {
  this.status = 'rejected';
  this.verificationDetails.rejectionReason = reason;
  
  // Add to history
  this.history.push({
    action: 'rejected',
    performedBy: pharmacistId,
    notes: reason
  });
  
  return this.save();
};

// Method to forward prescription to another pharmacy
prescriptionSchema.methods.forwardToPharmacy = async function(pharmacyId) {
  this.forwardedTo.push({
    pharmacy: pharmacyId,
    timestamp: new Date()
  });
  
  return this.save();
};

// Method to update medicine status
prescriptionSchema.methods.updateMedicineStatus = async function(medicineName, status, alternative = null) {
  const medicine = this.medicines.find(m => m.name === medicineName);
  if (medicine) {
    medicine.status = status;
    if (alternative) {
      medicine.alternative = alternative;
    }
    return this.save();
  }
  return false;
};

// Method to check if prescription needs refill
prescriptionSchema.methods.checkRefillStatus = function() {
  if (this.isRecurring && this.recurringDetails.remainingRefills > 0) {
    const today = new Date();
    return today >= this.recurringDetails.nextRefillDate;
  }
  return false;
};

// Method to process refill
prescriptionSchema.methods.processRefill = async function() {
  if (this.checkRefillStatus()) {
    // Update refill details
    this.recurringDetails.remainingRefills -= 1;
    
    // Calculate next refill date based on frequency
    const nextRefillDate = new Date(this.recurringDetails.nextRefillDate);
    switch (this.recurringDetails.frequency) {
      case 'daily':
        nextRefillDate.setDate(nextRefillDate.getDate() + 1);
        break;
      case 'weekly':
        nextRefillDate.setDate(nextRefillDate.getDate() + 7);
        break;
      case 'monthly':
        nextRefillDate.setMonth(nextRefillDate.getMonth() + 1);
        break;
      case 'quarterly':
        nextRefillDate.setMonth(nextRefillDate.getMonth() + 3);
        break;
    }
    
    this.recurringDetails.nextRefillDate = nextRefillDate;
    return this.save();
  }
  return false;
};

// Static method to find prescriptions by status
prescriptionSchema.statics.findByStatus = function(status) {
  return this.find({ status })
    .populate('customer', 'name email phone')
    .populate('pharmacy', 'storeName contactInfo')
    .populate('verificationDetails.verifiedBy', 'name');
};

// Static method to find expired prescriptions
prescriptionSchema.statics.findExpired = function() {
  return this.find({
    validity: { $lt: new Date() },
    status: { $ne: 'expired' }
  });
};

module.exports = mongoose.model('Prescription', prescriptionSchema);