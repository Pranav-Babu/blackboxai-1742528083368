const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const ErrorResponse = require('./errorResponse');

class FileHandler {
  constructor() {
    // Base upload directory
    this.uploadDir = 'uploads';
    
    // Ensure upload directories exist
    this.createUploadDirectories();
    
    // Configure storage for different file types
    this.prescriptionStorage = this.configureStorage('prescriptions');
    this.medicineStorage = this.configureStorage('medicines');
    this.profileStorage = this.configureStorage('profiles');
  }

  /**
   * Create necessary upload directories
   * @private
   */
  async createUploadDirectories() {
    const directories = [
      this.uploadDir,
      path.join(this.uploadDir, 'prescriptions'),
      path.join(this.uploadDir, 'medicines'),
      path.join(this.uploadDir, 'profiles'),
      path.join(this.uploadDir, 'temp')
    ];

    for (const dir of directories) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
      }
    }
  }

  /**
   * Configure multer storage
   * @param {string} subDirectory 
   * @returns {multer.StorageEngine}
   * @private
   */
  configureStorage(subDirectory) {
    return multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, path.join(this.uploadDir, subDirectory));
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
      }
    });
  }

  /**
   * Validate file type
   * @param {Object} file 
   * @param {string[]} allowedTypes 
   * @returns {boolean}
   * @private
   */
  validateFileType(file, allowedTypes) {
    const mimeType = file.mimetype;
    return allowedTypes.includes(mimeType);
  }

  /**
   * Configure prescription upload
   */
  prescriptionUpload = multer({
    storage: this.prescriptionStorage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
      files: 5 // Maximum 5 files per upload
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!this.validateFileType(file, allowedTypes)) {
        cb(new ErrorResponse('Invalid file type. Only JPEG, PNG, and PDF files are allowed.', 400), false);
        return;
      }
      cb(null, true);
    }
  }).array('prescriptionImages', 5);

  /**
   * Configure medicine image upload
   */
  medicineUpload = multer({
    storage: this.medicineStorage,
    limits: {
      fileSize: 2 * 1024 * 1024, // 2MB
      files: 3 // Maximum 3 images per medicine
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (!this.validateFileType(file, allowedTypes)) {
        cb(new ErrorResponse('Invalid file type. Only JPEG and PNG files are allowed.', 400), false);
        return;
      }
      cb(null, true);
    }
  }).array('medicineImages', 3);

  /**
   * Configure profile image upload
   */
  profileUpload = multer({
    storage: this.profileStorage,
    limits: {
      fileSize: 1 * 1024 * 1024, // 1MB
      files: 1 // Only one profile picture
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (!this.validateFileType(file, allowedTypes)) {
        cb(new ErrorResponse('Invalid file type. Only JPEG and PNG files are allowed.', 400), false);
        return;
      }
      cb(null, true);
    }
  }).single('profileImage');

  /**
   * Process uploaded image
   * @param {string} filePath 
   * @param {Object} options 
   * @returns {Promise<string>}
   */
  async processImage(filePath, options = {}) {
    try {
      const {
        width = 800,
        height = 800,
        quality = 80,
        format = 'jpeg'
      } = options;

      const processedFilePath = filePath.replace(/\.[^/.]+$/, '') + '_processed.' + format;
      
      await sharp(filePath)
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .toFormat(format, { quality })
        .toFile(processedFilePath);

      // Delete original file
      await fs.unlink(filePath);

      return processedFilePath;
    } catch (error) {
      console.error('Image processing failed:', error);
      throw new ErrorResponse('Failed to process image', 500);
    }
  }

  /**
   * Process prescription images
   * @param {Object[]} files 
   * @returns {Promise<string[]>}
   */
  async processPrescriptionImages(files) {
    try {
      const processedFiles = await Promise.all(
        files.map(file => 
          this.processImage(file.path, {
            width: 1200,
            height: 1600,
            quality: 85
          })
        )
      );
      return processedFiles;
    } catch (error) {
      throw new ErrorResponse('Failed to process prescription images', 500);
    }
  }

  /**
   * Process medicine images
   * @param {Object[]} files 
   * @returns {Promise<string[]>}
   */
  async processMedicineImages(files) {
    try {
      const processedFiles = await Promise.all(
        files.map(file =>
          this.processImage(file.path, {
            width: 800,
            height: 800,
            quality: 80
          })
        )
      );
      return processedFiles;
    } catch (error) {
      throw new ErrorResponse('Failed to process medicine images', 500);
    }
  }

  /**
   * Process profile image
   * @param {Object} file 
   * @returns {Promise<string>}
   */
  async processProfileImage(file) {
    try {
      const processedFile = await this.processImage(file.path, {
        width: 400,
        height: 400,
        quality: 85
      });
      return processedFile;
    } catch (error) {
      throw new ErrorResponse('Failed to process profile image', 500);
    }
  }

  /**
   * Delete file
   * @param {string} filePath 
   * @returns {Promise<void>}
   */
  async deleteFile(filePath) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error('File deletion failed:', error);
      throw new ErrorResponse('Failed to delete file', 500);
    }
  }

  /**
   * Delete multiple files
   * @param {string[]} filePaths 
   * @returns {Promise<void>}
   */
  async deleteFiles(filePaths) {
    try {
      await Promise.all(filePaths.map(filePath => this.deleteFile(filePath)));
    } catch (error) {
      console.error('Files deletion failed:', error);
      throw new ErrorResponse('Failed to delete files', 500);
    }
  }

  /**
   * Clean temporary files
   * @returns {Promise<void>}
   */
  async cleanTemp() {
    try {
      const tempDir = path.join(this.uploadDir, 'temp');
      const files = await fs.readdir(tempDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(tempDir, file)))
      );
    } catch (error) {
      console.error('Temp cleanup failed:', error);
      throw new ErrorResponse('Failed to clean temporary files', 500);
    }
  }
}

module.exports = new FileHandler();