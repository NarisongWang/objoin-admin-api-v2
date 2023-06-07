const express = require('express');
const router = express.Router();
const {
  getCheckList,
  updateCheckList,
} = require('../controllers/checkListController');
const { adminAuth } = require('../middlewares/requireAdminAuth');

router.get(
  '/admin/getchecklist',
  adminAuth({ hasRole: ['admin', 'manager'] }),
  getCheckList
);
router.post(
  '/admin/updatechecklist',
  adminAuth({ hasRole: ['admin', 'manager'] }),
  updateCheckList
);

module.exports = router;
