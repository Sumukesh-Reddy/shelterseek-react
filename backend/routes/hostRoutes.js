// backend/routes/hostRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const hostController = require('../controllers/hostController');

const upload = multer({ dest: 'public/uploads/' }); // temp folder, files are moved to GridFS

router.post('/listings', upload.array('images', 12), hostController.createListing);
router.put('/listings/:id', upload.array('images', 12), hostController.updateListing);
router.get('/listings/:id', hostController.getListingById);
router.get('/images/:id', hostController.getImage);
router.get('/listings', hostController.getListings);
router.patch('/listings/:listingId/status', hostController.updateListingStatus);
router.delete('/listings/:id', hostController.deleteListing);

module.exports = router;