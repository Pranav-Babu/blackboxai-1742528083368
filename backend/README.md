# Pharmacy Delivery Backend

A robust backend API for a pharmacy delivery application built with Node.js, Express, and MongoDB.

## Features

- 🔐 Authentication & Authorization
- 🏪 Pharmacy Management
- 💊 Medicine Inventory
- 📝 Prescription Management
- 🛒 Order Processing
- 📍 Location-based Services
- 💳 Payment Integration
- 📱 Push Notifications
- 📊 Analytics & Reporting
- 🔍 Advanced Search
- 🗄️ Caching System
- 📝 Logging System

## Tech Stack

- Node.js & Express.js
- MongoDB & Mongoose
- JWT Authentication
- Express Validator
- Multer (File Upload)
- Node Cache
- Winston (Logging)
- Node Schedule
- Node Geocoder
- Various Security Packages

## Prerequisites

- Node.js (>= 14.0.0)
- MongoDB
- npm or yarn
- Google Maps API Key (for geocoding)
- SMTP Server (for email notifications)
- SMS Gateway Account (for SMS notifications)
- Payment Gateway Account (Razorpay/Stripe/Paytm)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/pharmacy-delivery.git
   cd pharmacy-delivery/backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create .env file:
   ```bash
   cp .env.example .env
   ```

4. Update environment variables in .env file with your configurations

5. Create required directories:
   ```bash
   mkdir uploads logs
   ```

## Running the Application

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Database Seeding
```bash
npm run seed
```

## API Documentation

API documentation is available at `/api-docs` when the server is running.

### Main Endpoints

- Auth: `/api/auth`
- Pharmacies: `/api/pharmacies`
- Medicines: `/api/medicines`
- Orders: `/api/orders`
- Prescriptions: `/api/prescriptions`

## Testing

Run tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

## Code Quality

Run linter:
```bash
npm run lint
```

Fix linting issues:
```bash
npm run lint:fix
```

Format code:
```bash
npm run format
```

## Project Structure

```
backend/
├── config/             # Configuration files
├── controllers/        # Route controllers
├── middleware/         # Custom middleware
├── models/            # Database models
├── routes/            # API routes
├── utils/             # Utility functions
├── uploads/           # Uploaded files
├── logs/              # Application logs
├── tests/             # Test files
├── .env               # Environment variables
├── .gitignore         # Git ignore rules
├── package.json       # Project dependencies
└── server.js          # Application entry point
```

## Security Features

- JWT Authentication
- Password Hashing
- Rate Limiting
- CORS Protection
- XSS Protection
- NoSQL Injection Prevention
- Security Headers (Helmet)
- Request Sanitization
- File Upload Validation
- Error Handling

## Error Handling

The application uses a centralized error handling system:

- Custom error classes
- Async/await error handling
- Validation error handling
- Database error handling
- File upload error handling
- 404 handling

## Caching

- In-memory caching using node-cache
- Caching for:
  - Search results
  - Frequently accessed data
  - API responses
  - User sessions

## Logging

- Winston logger implementation
- Different log levels
- File and console transport
- Request logging
- Error logging
- Performance logging

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, email support@pharmacy-delivery.com or open an issue in the repository.

## Authors

- Your Name - Initial work - [YourGithub](https://github.com/yourusername)

## Acknowledgments

- Hat tip to anyone whose code was used
- Inspiration
- etc