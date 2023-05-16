require('dotenv').config({ path: '.env' });
const express = require('express');
const admin = require('firebase-admin');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const logger = require('morgan');
var path = require('path');
const fs = require('fs');
const adminRoutes = require('./routes/adminRoutes');
const installationOrderRoutes = require('./routes/installationOrderRoutes');
const mssqlRoutes = require('./routes/mssqlRoutes');
const checkListRoutes = require('./routes/checkListRoutes');
const { errorHandler } = require('./middlewares/errorHandler');

const app = express();

var serviceAccount = require('../objoin-adminsdk.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL:
    'https://objoin-14f62-default-rtdb.asia-southeast1.firebasedatabase.app',
});

app.use(bodyParser.json());
app.use(cors());
app.use(helmet());
app.use(express.static(path.join(__dirname, 'public')));

app.use(adminRoutes);
app.use(installationOrderRoutes);
app.use(mssqlRoutes);
app.use(checkListRoutes);

//logging
app.use(
  logger('combined', {
    stream: fs.createWriteStream('./access.log', { flags: 'a' }),
  })
);
app.use(logger('combined'));

//error handle
app.use(errorHandler);

//MongoDB connection
const mongoUri = process.env.MONGO_URI;
mongoose.connect(mongoUri);
mongoose.connection.on('connected', () => {
  console.log('Connected to MongoDB instance!');
});

app.use('*', (req, res) => {
  res.status(404);
  console.log(req.method + ': ' + req.baseUrl);
  throw new Error('Resource not found.');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`App server is running on port ${PORT}!`);
});
