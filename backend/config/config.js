require('dotenv').config();

const config = {
  // Environment
  env: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',

  // Server
  port: parseInt(process.env.PORT, 10) || 5000,
  host: process.env.HOST || 'localhost',
  baseUrl: process.env.BASE_URL || 'http://localhost:5000',

  // Database
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacy-delivery',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  },

  // Authentication
  jwt: {
    secret: process.env.JWT_SECRET || 'your_jwt_secret_key_here',
    expire: process.env.JWT_EXPIRE || '30d',
    cookie: {
      expire: parseInt(process.env.JWT_COOKIE_EXPIRE, 10) || 30
    }
  },

  // File Upload
  upload: {
    maxSize: 5 * 1024 * 1024, // 5MB
    path: process.env.UPLOAD_PATH || 'uploads',
    types: {
      prescription: {
        allowedFormats: ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'],
        maxCount: 5
      },
      medicine: {
        allowedFormats: ['image/jpeg', 'image/png', 'image/jpg'],
        maxCount: 3
      },
      profile: {
        allowedFormats: ['image/jpeg', 'image/png', 'image/jpg'],
        maxCount: 1
      }
    }
  },

  // Geocoding
  geocoding: {
    provider: process.env.GEOCODER_PROVIDER || 'google',
    apiKey: process.env.GEOCODER_API_KEY,
    options: {
      formatter: null
    }
  },

  // Delivery
  delivery: {
    slots: [
      '6 AM',
      '9 AM',
      '12 PM',
      '3 PM',
      '6 PM',
      '9 PM',
      '12 AM'
    ],
    maxRadius: 10, // kilometers
    charges: {
      base: 50,
      perKm: 10,
      min: 50,
      max: 200
    }
  },

  // Order
  order: {
    timeouts: {
      pharmacyApproval: 10 * 60 * 1000, // 10 minutes
      customerConfirmation: 10 * 60 * 1000 // 10 minutes
    },
    statuses: {
      cart: 'cart',
      pendingApproval: 'pending_approval',
      approved: 'approved',
      rejected: 'rejected',
      processing: 'processing',
      readyForDelivery: 'ready_for_delivery',
      outForDelivery: 'out_for_delivery',
      delivered: 'delivered',
      cancelled: 'cancelled'
    }
  },

  // Prescription
  prescription: {
    validity: {
      default: 30, // days
      max: 180 // days
    },
    statuses: {
      pending: 'pending',
      underReview: 'under_review',
      verified: 'verified',
      rejected: 'rejected',
      expired: 'expired'
    }
  },

  // Medicine
  medicine: {
    categories: {
      prescription: 'prescription',
      nonPrescription: 'non-prescription',
      dailyNeeds: 'daily-needs'
    },
    subCategories: {
      prescription: [
        'tablets',
        'capsules',
        'syrups',
        'injections',
        'topical',
        'drops',
        'inhalers'
      ],
      nonPrescription: [
        'pain-relief',
        'cold-and-flu',
        'digestive-health',
        'first-aid',
        'vitamins-supplements'
      ],
      dailyNeeds: [
        'personal-care',
        'baby-care',
        'health-supplements',
        'skin-care',
        'health-devices',
        'ayurvedic'
      ]
    },
    lowStockThreshold: 10
  },

  // Notifications
  notifications: {
    email: {
      from: process.env.EMAIL_FROM || 'noreply@pharmacy-delivery.com',
      smtp: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT, 10) || 587,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        }
      }
    },
    sms: {
      provider: process.env.SMS_PROVIDER,
      apiKey: process.env.SMS_API_KEY,
      from: process.env.SMS_FROM
    },
    push: {
      fcmServerKey: process.env.FCM_SERVER_KEY
    }
  },

  // Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  },

  // Security
  security: {
    bcrypt: {
      saltRounds: 10
    },
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true
    }
  },

  // Pagination
  pagination: {
    defaultLimit: 10,
    maxLimit: 100
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log'
  },

  // Cache
  cache: {
    ttl: 60 * 60 * 1000, // 1 hour
    checkPeriod: 60 * 60 * 1000 // 1 hour
  },

  // Maintenance
  maintenance: {
    enabled: process.env.MAINTENANCE_MODE === 'true',
    message: 'Site is under maintenance. Please try again later.'
  }
};

module.exports = config;