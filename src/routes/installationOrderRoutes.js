const express = require('express');
const { adminAuth } = require('../middlewares/requireAdminAuth');

const {
  createInstallationOrders,
  setupInstallationOrder,
  editInstallationOrder,
  deleteInstallationOrder,
  getInstallationOrders,
  getTotalCount,
  getUsersAndFiles,
  updateInstallationOrder,
  closeInstallationOrder,
  getInstallationOrder,
} = require('../controllers/installationOrderController');

const router = express.Router();

router.post(
  '/admin/createorders',
  adminAuth({ hasRole: ['admin', 'manager'] }),
  createInstallationOrders
);
router.post(
  '/admin/setuporder',
  adminAuth({ hasRole: ['admin', 'manager'] }),
  setupInstallationOrder
);
router.post(
  '/admin/editorder',
  adminAuth({ hasRole: ['admin', 'manager'] }),
  editInstallationOrder
);
router.post(
  '/admin/installationorders',
  adminAuth({ hasRole: ['admin', 'manager'] }),
  getInstallationOrders
);
router
  .route('/admin/installationorders/:id')
  .get(adminAuth({ hasRole: ['admin', 'manager'] }), getInstallationOrder)
  .put(adminAuth({ hasRole: ['admin', 'manager'] }), updateInstallationOrder);
router.get(
  '/admin/usersandfiles/:id',
  adminAuth({ hasRole: ['admin', 'manager'] }),
  getUsersAndFiles
);
router.post(
  '/admin/countorders',
  adminAuth({ hasRole: ['admin', 'manager'] }),
  getTotalCount
);
router.post(
  '/admin/closeorder',
  adminAuth({ hasRole: ['admin', 'manager'] }),
  closeInstallationOrder
);
router.post(
  '/admin/deleteorder',
  adminAuth({ hasRole: ['admin', 'manager'] }),
  deleteInstallationOrder
);

module.exports = router;
