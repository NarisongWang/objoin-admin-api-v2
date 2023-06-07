const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  createUser,
  updateUser,
} = require('../controllers/adminController');
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
router.post(
  '/admin/update-user',
  adminAuth({ hasRole: ['admin', 'manager'] }),
  updateUser
);

module.exports = router;
