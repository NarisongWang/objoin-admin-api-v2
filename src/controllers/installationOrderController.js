const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const InstallationOrder = require('../models/InstallationOrder');
const CheckList = require('../models/KitchenInstallChecklist');
const {
  findPdfFiles,
  uploadPdfFilesToAzure,
  deleteInstallationOrderDirectoryFromAzure,
} = require('./fileController');
const admin = require('firebase-admin');

// @desc    create installation orders from loaded sales orders
// @request POST
// @route   /admin/loadinstallationorders
// @acccess Private & protected by adminAuth
const createInstallationOrders = asyncHandler(async (req, res) => {
  try {
    const { salesOrders } = req.body;
    for (let i = 0; i < salesOrders.length; i++) {
      const installationOrder = salesOrders[i];
      if (installationOrder.orderDetails) {
        const orderDetails = installationOrder.orderDetails.split('|');
        let checkItems = [];
        if (orderDetails && orderDetails.length > 0) {
          for (let j = 0; j < orderDetails.length; j++) {
            checkItems.push(orderDetails[j].replaceAll('&amp;', 'and'));
          }
        }
        installationOrder.checkItems = checkItems;
      }
      await InstallationOrder.create(installationOrder);
    }
    res.status(200).json(salesOrders);
  } catch (error) {
    res.status(400);
    throw error;
  }
});

// @desc    setup a new installation order, update { workStatus, deliverers, installers, checkList, timeFrames, files, localFilePath }
// @request POST
// @route   /admin/setupinstallationorder
// @acccess Private & protected by adminAuth
const setupInstallationOrder = asyncHandler(async (req, res) => {
  try {
    const { installationOrderId, update } = req.body;
    //load check list
    const checkList = await CheckList.find({});
    update.checkList = checkList;

    //add installation order id to user's installationOrders field
    //set _id and fullName for deliverer and installer
    await updateUserInstallationOrdersInfo(update, installationOrderId);

    const updateInstallationOrder = await InstallationOrder.findByIdAndUpdate(
      installationOrderId,
      update,
      { new: true }
    );

    //upload pdf files to Azure blob storage
    await uploadPdfFilesToAzure(
      updateInstallationOrder.installationOrderNumber,
      update.localFilePath,
      update.files
    );
    if (updateInstallationOrder) {
      res.status(200).json(updateInstallationOrder);
    } else {
      res.status(400);
      throw new Error('Invalid data');
    }
  } catch (error) {
    res.status(400);
    throw error;
  }
});

// @desc    edit an existing installation order, update { deliverers, installers, files, localFilePath }
// @request POST
// @route   /admin/editinstallationorder
// @acccess Private & protected by adminAuth
const editInstallationOrder = asyncHandler(async (req, res) => {
  try {
    const { installationOrderId, update } = req.body;
    const installationOrder = await InstallationOrder.findById(
      installationOrderId
    );
    //delete installation order id from installationOrders field for previous deliverers and installers
    await deleteUserInstallationOrdersInfo(installationOrder);
    const updateInstallationOrder = await InstallationOrder.findByIdAndUpdate(
      installationOrderId,
      update,
      { new: true }
    );
    //add installation order id to installationOrders field for new deliverers and installers
    await updateUserInstallationOrdersInfo(update, installationOrderId);
    //upload pdf files to Azure blob storage
    await uploadPdfFilesToAzure(
      updateInstallationOrder.installationOrderNumber,
      update.localFilePath,
      update.files
    );
    if (updateInstallationOrder) {
      res.status(200).json(updateInstallationOrder);
    } else {
      res.status(400);
      throw new Error('Invalid data');
    }
  } catch (error) {
    res.status(400);
    throw error;
  }
});

// @desc    delete an existing installation order
// @request POST
// @route   /admin/deleteinstallationorder
// @acccess Private & protected by adminAuth
const deleteInstallationOrder = asyncHandler(async (req, res) => {
  try {
    const { installationOrderId } = req.body;
    const installationOrder = await InstallationOrder.findById(
      installationOrderId
    );
    //delete installation order id from installationOrders field for deliverers and installers
    await deleteUserInstallationOrdersInfo(installationOrder);

    //delete InstallationOrder from InstallationOrder collection
    const result = await InstallationOrder.findByIdAndDelete(
      installationOrderId
    );

    //delete all documents under the installation order number on Azure blob storage
    await deleteInstallationOrderDirectoryFromAzure(
      installationOrder.installationOrderNumber
    );

    if (result) {
      res.status(200).json(result);
    } else {
      res.status(400);
      throw new Error('Delete Operation Error');
    }
  } catch (error) {
    res.status(400);
    throw error;
  }
});

// @desc    get all installation orders
// @request POST
// @route   /admin/installationorders
// @acccess Private & protected by adminAuth
const getInstallationOrders = asyncHandler(async (req, res) => {
  try {
    const { firstPageIndex, pageSize, searchText } = req.body;
    const installationOrders = await InstallationOrder.find({
      installationOrderNumber: { $regex: `.*${searchText}.*` },
    })
      .sort({ installationOrderNumber: -1 })
      .skip(firstPageIndex)
      .limit(pageSize);
    if (installationOrders) {
      res.status(200).send(installationOrders);
    } else {
      res.status(400);
      throw new Error('Invalid query ');
    }
  } catch (error) {
    res.status(400);
    throw error;
  }
});

// @desc    get installation order counts
// @request POST
// @route   /admin/countorders
// @acccess Private & protected by adminAuth
const getTotalCount = asyncHandler(async (req, res) => {
  try {
    const { searchText } = req.body;
    const count = await InstallationOrder.countDocuments({
      installationOrderNumber: { $regex: `.*${searchText}.*` },
    });
    res.status(200).send({ totalCount: count });
  } catch (error) {
    res.status(400);
    throw error;
  }
});

// @desc    get one installation order and related pdf files by id
// @request GET
// @route   /admin/installationorders/:id
// @acccess Private & protected by adminAuth
const getUsersAndFiles = asyncHandler(async (req, res) => {
  try {
    const installationOrder = await InstallationOrder.findById(req.params.id);
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

    // find all pdf files under the local file server directory
    let fileDir = `${
      process.env.LOCAL_FILE_SERVER2 +
      installationOrder.entryDate.toString().substring(11, 15)
    }\\${installationOrder.customer}\\${installationOrder.shipName.trim()} - ${
      installationOrder.shipAddress
    }`;
    fileDir =
      fileDir.substring(0, fileDir.length - 6) +
      ' - ' +
      installationOrder.installationOrderNumber;
    const rawFiles = await findPdfFiles(fileDir);
    const files = initFiles(
      installationOrder.installationOrderNumber,
      rawFiles
    );
    if (installationOrder) {
      res.status(200).json({ users: users, files });
    } else {
      res.status(404);
      throw new Error('Installation order not found');
    }
  } catch (error) {
    console.log(error.message);
    res.status(400);
    throw error;
  }
});

const initFiles = (installationOrderNumber, files) => {
  const result = files.reduce((accumulator, file, index) => {
    const lastIndex = file.lastIndexOf('\\') + 1;
    const file_path = file.substring(0, lastIndex);
    const file_dir = file.substring(
      file.indexOf(installationOrderNumber),
      lastIndex - 1
    );
    const file_name = file.substring(lastIndex, file.length);

    const dirIndex = accumulator.findIndex(
      (item) => item.file_dir === file_dir
    );
    if (dirIndex === -1) {
      let dirObject = {
        file_path: file_path,
        file_dir: file_dir,
        files: [{ id: index, file_name: file_name, isChecked: false }],
      };
      accumulator.push(dirObject);
    } else {
      accumulator[dirIndex].files.push({
        id: index,
        file_name: file_name,
        isChecked: false,
      });
    }
    return accumulator;
  }, []);
  return result;
};

// @desc    update an installation order by _id
// @request PUT
// @route   /admin/installationrders/:id
// @route   /installationrders/:id
// @acccess Private & protected by adminAuth or userAuth
const updateInstallationOrder = asyncHandler(async (req, res) => {
  try {
    const updateInstallationOrder = await InstallationOrder.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (updateInstallationOrder) {
      res.status(200).json(updateInstallationOrder);
    } else {
      res.status(400);
      throw new Error('Update failed, invalid data');
    }
  } catch (error) {
    res.status(400);
    throw error;
  }
});

// @desc    close installation order and delete order id
// @request POST
// @route   /admin/loadinstallationorders
// @acccess Private & protected by adminAuth
const closeInstallationOrder = asyncHandler(async (req, res) => {
  try {
    const { installationOrderId } = req.body;
    const installationOrder = await InstallationOrder.findByIdAndUpdate(
      installationOrderId,
      { workStatus: 5 },
      { new: true }
    );
    //delete installation order id from installationOrders field for deliverers and installers
    await deleteUserInstallationOrdersInfo(installationOrder);
    res.status(200).json(installationOrder);
  } catch (error) {
    res.status(400);
    throw error;
  }
});

// @desc    add installtionOrderId to the installationOrders field for delivery and installation users
// @request N/A
// @route   N/A
// @acccess Private function
const updateUserInstallationOrdersInfo = (update, installationOrderId) => {
  return new Promise(async (resolve, reject) => {
    try {
      //update installers info with new updated installation order _id
      for (let i = 0; i < update.installers.length; i++) {
        const installer = await User.findOne({
          email: update.installers[i].email,
        });
        await installer.updateOne({
          $set: {
            installationOrders: [
              ...installer.installationOrders,
              installationOrderId,
            ],
          },
        });
        update.installers[i] = {
          fullName: update.installers[i].displayName,
          id: installer._id,
        };
      }
      //update deliverers info with new updated installation order _id
      for (let i = 0; i < update.deliverers.length; i++) {
        const deliverer = await User.findOne({
          email: update.deliverers[i].email,
        });
        await deliverer.updateOne({
          $set: {
            installationOrders: [
              ...deliverer.installationOrders,
              installationOrderId,
            ],
          },
        });
        update.deliverers[i] = {
          fullName: update.deliverers[i].displayName,
          id: deliverer._id,
        };
      }
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

// @desc    delete installtionOrderId from the installationOrders field for delivery and installation users
// @request N/A
// @route   N/A
// @acccess Private function
const deleteUserInstallationOrdersInfo = (installationOrder) => {
  return new Promise(async (resolve, reject) => {
    try {
      //delete installation order id from delievery user's installation order field
      for (let i = 0; i < installationOrder.deliverers.length; i++) {
        const userId = installationOrder.deliverers[i].id;
        const deliverer = await User.findOne({ _id: userId });
        const installationOrders = deliverer.installationOrders.filter(
          (iOrder) => {
            if (!iOrder.equals(installationOrder._id)) return iOrder;
          }
        );
        await deliverer.updateOne({
          $set: { installationOrders: installationOrders },
        });
      }
      //delete installation order id from installation user's installation order field
      for (let i = 0; i < installationOrder.installers.length; i++) {
        const userId = installationOrder.installers[i].id;
        const installer = await User.findOne({ _id: userId });
        const installationOrders = installer.installationOrders.filter(
          (iOrder) => {
            if (!iOrder.equals(installationOrder._id)) return iOrder;
          }
        );
        await installer.updateOne({
          $set: { installationOrders: installationOrders },
        });
      }
      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = {
  createInstallationOrders,
  setupInstallationOrder,
  editInstallationOrder,
  deleteInstallationOrder,
  getInstallationOrders,
  getTotalCount,
  getUsersAndFiles,
  updateInstallationOrder,
  closeInstallationOrder,
};
