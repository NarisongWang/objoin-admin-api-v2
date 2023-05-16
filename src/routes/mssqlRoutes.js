const express = require('express');
const { adminAuth } = require('../middlewares/requireAdminAuth');
const {
  getEmployees,
  getEmployee,
  getSalesOrders,
  getTotalCount,
  getTotalCount2,
} = require('../controllers/mssqlController');

const router = express.Router();
router.post(
  '/mssql/employees',
  adminAuth({ hasRole: ['admin', 'manager'] }),
  getEmployees
);
router.get(
  '/mssql/employees/:id',
  adminAuth({ hasRole: ['admin', 'manager'] }),
  getEmployee
);
router.post(
  '/mssql/salesorders',
  adminAuth({ hasRole: ['admin', 'manager'] }),
  getSalesOrders
);

router.post(
  '/mssql/countsalesorders',
  adminAuth({ hasRole: ['admin', 'manager'] }),
  getTotalCount
);
router.post(
  '/mssql/countemployees',
  adminAuth({ hasRole: ['admin', 'manager'] }),
  getTotalCount2
);

module.exports = router;
