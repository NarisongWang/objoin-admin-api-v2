const asyncHandler = require('express-async-handler');
const admin = require('firebase-admin');
const mailer = require('nodemailer');
const User = require('../models/User');

// @desc    Get all users
// @request GET
// @route   /admin/getallusers
// @acccess Private
const getAllUsers = asyncHandler(async (req, res) => {
  try {
    const result = await admin.auth().listUsers();
    const users = result.users.map((user) => {
      return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        phoneNumber: user.phoneNumber,
        customClaims: user.customClaims,
        metadata: user.metadata,
      };
    });

    users.sort((a, b) => {
      return a.metadata.creationTime.localeCompare(b.metadata.creationTime);
    });

    if (users && users.length > 0) {
      res.status(200).send(users);
    } else {
      res.status(400);
      throw new Error('No user found');
    }
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

// @desc    Register a new user for delievery or installation user
// @request POST
// @route   /admin/activateuser
// @acccess Private, protected by admin auth

const createUser = asyncHandler(async (req, res) => {
  try {
    const { email, displayName, role, phoneNumber, photoURL } = req.body;
    if (!email || !displayName || !role) {
      res.status(400);
      throw new Error('Missing fields');
    }

    const password = generateRandomPassword(10);
    //console.log(email + ' : ' + password);

    const { uid } = await admin.auth().createUser({
      email: email,
      emailVerified: true,
      password: password,
      displayName: displayName,
      phoneNumber: phoneNumber,
      photoURL: photoURL,
      disabled: false,
    });

    await User.create({
      email,
    });

    await admin.auth().setCustomUserClaims(uid, { role });

    //send activation email to account
    const trans = mailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_ADDR,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_ADDR,
      to: email,
      subject: "Welcome to O'Brien Joinery Web App",
      html: `
      <html>
        <body>
          <div style="background-image: url('https://objoin.com.au/wp-content/uploads/2017/05/FisherStreet3Dark.jpg');
              background-size: cover;
              background-position: center center;
              background-repeat: no-repeat;
              height: 700px;
              width: 100%;
              position: absolute;
              top: 0;
              left: 0;
              z-index: -1;">
            <div style="background-color: rgba(255, 255, 255, 0.9);
                        border-radius: 10px;
                        width: 80%;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 40px;">
              <h2 style="color: #333;">Your account has been activated!</h2>
              <p style="color: #333;">Hi, ${displayName}!</p>
              <p style="color: #333;">Your initial password is: ${password}</p>
              <p style="color: #333;">Please change your password after logging in.</p>
              ${
                role === 'admin' || role === 'manager'
                  ? "<p style='color: #333;'>You can now visit http://192.168.2.5:3000 to login the admin web applicaiton in the local network.</p>"
                  : "<p style='color: #333;'>You can now download the OBJOIN mobile app from Google Play Store and log in with your account.</p>"
              }
            </div>
          </div>
        </body>
      </html>
    `,
    };

    trans.sendMail(mailOptions, function (error, info) {
      if (error) {
        res.status(400);
        throw new Error('Failed to send validation email!');
      }
    });
    const result = await admin.auth().listUsers();
    res.status(201).send(result.users);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

const generateRandomPassword = (length) => {
  var chars =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz~!@-#$';
  var randomstring = '';
  for (var i = 0; i < length; i++) {
    var rnum = Math.floor(Math.random() * chars.length);
    randomstring += chars.substring(rnum, rnum + 1);
  }
  return randomstring;
};

module.exports = {
  getAllUsers,
  createUser,
};
