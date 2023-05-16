const express = require('express');
const router = express.Router();
const { getAllUsers, createUser } = require('../controllers/adminController');
const { adminAuth } = require('../middlewares/requireAdminAuth');

router.get(
  '/admin/get-all-users',
  adminAuth({ hasRole: ['admin', 'manager'] }),
  getAllUsers
);
router.post(
  '/admin/create-user',
  adminAuth({ hasRole: ['admin', 'manager'] }),
  createUser
);

module.exports = router;
