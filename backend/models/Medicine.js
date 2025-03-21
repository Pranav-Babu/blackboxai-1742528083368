const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add medicine name'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  genericName: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['prescription', 'non-prescription', 'daily-needs'],
  },
  subCategory: {
    type: String,
    enum: [
      'tablets', 'capsules', 'syrups', 'injections', 
      'topical', 'drops', 'inhalers',
      'personal-care', 'baby-care', 'health-supplements',
      'skin-care', 'health-devices', 'ayurvedic'
    ]
  },
  manufacturer: {
    type: String,
    required: [true, 'Please add manufacturer name']
  },
  description: {
    type: String,
    required: [true, 'Please add description'],
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  pharmacy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pharmacy',
    required: true
  },
  price: {
    type: Number,
    required: [true, 'Please add price'],
    min: [0, 'Price cannot be negative']
  },
  discountedPrice: {
    type: Number,
    min: [0, 'Discounted price cannot be negative']
  },
  stock: {
    type: Number,
    required: [true, 'Please add stock quantity'],
    min: [0, 'Stock cannot be negative']
  },
  unit: {
    type: String,
    required: [true, 'Please add unit'],
    enum: ['tablet', 'capsule', 'bottle', 'pack', 'piece', 'strip', 'tube', 'sachet']
  },
  packageSize: {
    type: String,
    required: true
  },
  images: [{
    type: String,
    required: [true, 'Please add at least one image']
  }],
  prescriptionRequired: {
    type: Boolean,
    default: false
  },
  dosageInstructions: {
    route: {
      type: String,
      enum: ['oral', 'topical', 'inhalation', 'injection', 'drops']
    },
    frequency: String,
    timing: String,
    specialInstructions: String
  },
  sideEffects: [{
    type: String
  }],
  warnings: [{
    type: String
  }],
  contraindications: [{
    type: String
  }],
  drugInteractions: [{
    medicine: String,
    effect: String,
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe']
    }
  }],
  storageInstructions: {
    type: String
  },
  expiryDate: {
    type: Date,
    required: true
  },
  batchNumber: {
    type: String,
    required: true
  },
  tags: [{
    type: String
  }],
  ratings: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'discontinued'],
    default: 'active'
  },
  featured: {
    type: Boolean,
    default: false
  },
  searchKeywords: [{
    type: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create indexes for better search performance
medicineSchema.index({ name: 'text', genericName: 'text', searchKeywords: 'text' });
medicineSchema.index({ category: 1, subCategory: 1 });
medicineSchema.index({ pharmacy: 1 });

// Virtual for checking if medicine is in stock
medicineSchema.virtual('inStock').get(function() {
  return this.stock > 0;
});

// Virtual for calculating discount percentage
medicineSchema.virtual('discountPercentage').get(function() {
  if (this.discountedPrice && this.price > this.discountedPrice) {
    return Math.round(((this.price - this.discountedPrice) / this.price) * 100);
  }
  return 0;
});

// Method to update stock
medicineSchema.methods.updateStock = async function(quantity) {
  if (this.stock + quantity >= 0) {
    this.stock += quantity;
    await this.save();
    return true;
  }
  return false;
};

// Method to add review
medicineSchema.methods.addReview = async function(userId, rating, comment) {
  this.reviews.push({
    user: userId,
    rating,
    comment
  });
  
  // Update average rating
  const totalRating = this.ratings.average * this.ratings.count + rating;
  this.ratings.count += 1;
  this.ratings.average = totalRating / this.ratings.count;
  
  await this.save();
};

// Static method to find medicines by category
medicineSchema.statics.findByCategory = function(category, subCategory) {
  const query = { category };
  if (subCategory) {
    query.subCategory = subCategory;
  }
  return this.find(query);
};

// Static method to search medicines
medicineSchema.statics.searchMedicines = function(searchTerm) {
  return this.find(
    { $text: { $search: searchTerm } },
    { score: { $meta: "textScore" } }
  ).sort({ score: { $meta: "textScore" } });
};

module.exports = mongoose.model('Medicine', medicineSchema);