const asyncHandler = require('express-async-handler');
const admin = require('firebase-admin');

const adminAuth = (options) => {
  return asyncHandler(async (req, res, next) => {
    const { authorization } = req.headers;
    if (!authorization) throw new Error('Not authorized');
    if (!authorization.startsWith('Bearer')) throw new Error('Not authorized');
    const split = authorization.split('Bearer ');
    if (split.length !== 2) throw new Error('Not authorized');

    const token = split[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      const uid = decodedToken.uid;
      const role = decodedToken.role;
      const email = decodedToken.email;
      const { id } = req.params;

      //if the email address is system admin, will return next
      if (email === 'nwang@objoin.com.au') return next();

      //user can access their own resource
      if (options.allowSameUser && id && uid === id) return next();

      //no user role found from firebase token
      if (!role) throw new Error('Not authorized');

      //user has the appropriate permissions
      if (options.hasRole.includes(role)) return next();

      res.status(403);
      throw new Error('Not authorized');
    } catch (err) {
      res.status(400);
      throw new Error('Not authorized');
    }
  });
};

module.exports = { adminAuth };
