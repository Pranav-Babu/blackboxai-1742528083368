// ... existing code ...

/**
 * @desc    Search non-prescription medicines
 * @route   GET /api/medicines/search
 * @access  Public
 */
exports.searchMedicines = async (req, res, next) => {
  try {
    const { query, category = 'non-prescription' } = req.query;

    const medicines = await Medicine.find({
      category,
      prescriptionRequired: false,
      status: 'active',
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { genericName: { $regex: query, $options: 'i' } },
        { searchKeywords: { $regex: query, $options: 'i' } }
      ]
    }).populate('pharmacy', 'storeName address contactInfo ratings');

    res.status(200).json({
      success: true,
      count: medicines.length,
      data: medicines
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get daily needs products
 * @route   GET /api/medicines/daily-needs
 * @access  Public
 */
exports.getDailyNeeds = async (req, res, next) => {
  try {
    const {
      subCategory,
      minPrice,
      maxPrice,
      sort = '-ratings.average',
      page = 1,
      limit = 10
    } = req.query;

    const query = {
      category: 'daily-needs',
      status: 'active'
    };

    if (subCategory) {
      query.subCategory = subCategory;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    const skip = (page - 1) * limit;

    const products = await Medicine.find(query)
      .populate('pharmacy', 'storeName address contactInfo ratings')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Medicine.countDocuments(query);

    res.status(200).json({
      success: true,
      count: products.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: products
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get medicine suggestions
 * @route   GET /api/medicines/suggestions
 * @access  Public
 */
exports.getMedicineSuggestions = async (req, res, next) => {
  try {
    const { category, subCategory } = req.query;

    // Get top rated medicines in the category
    const suggestions = await Medicine.find({
      category,
      subCategory,
      status: 'active',
      'ratings.count': { $gt: 0 }
    })
      .sort('-ratings.average -ratings.count')
      .limit(10)
      .populate('pharmacy', 'storeName address contactInfo ratings');

    res.status(200).json({
      success: true,
      count: suggestions.length,
      data: suggestions
    });
  } catch (error) {
    next(error);
  }
};

// ... rest of existing code ...