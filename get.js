const app = require(__dirname + "/app.js");
const bcrypt = require("bcrypt");

exports.getUserDetails = function(user_name){
  return new Promise(async (resolve, reject) => {
      const logger = await app.getLogger();
      let db = await app.getUserModel();
      db.findOne({
          where: {
              username : user_name
          }
      }).then(res => {
          resolve(res);
      }).catch((error) => {
          logger.error(`${error}`);
          reject(console.error('Failed to retrieve data : ', error));
      });
    });
};

exports.isPasswordSame = function(user_pass, result){
    return new Promise((resolve, reject) => {
        bcrypt.compare(user_pass, result.password, function(err, same){
            if(err)
            {
                const logger = app.getLogger();
                logger.error(`${err}`);
                reject(console.log(err));
            }
            else
            {
                resolve(same);
            }
        });
    });
};

exports.getProductDetails = function(productId){
  return new Promise(async (resolve, reject) => {
      const logger = await app.getLogger();
      let db = await app.getProductModel();
      db.findOne({
          where: {
              id : productId
          }
      }).then(res => {
          resolve(res);
      }).catch((error) => {
          logger.error(`${error}`);
          reject(console.error('Failed to retrieve data : ', error));
      });
  });
};

exports.getProductImages = function(productId){
    return new Promise(async (resolve, reject) => {
        const logger = await app.getLogger();
        let db = await app.getProductImageModel();
        db.findAll({
            where: {
                product_id : productId
            }
        }).then(res => {
            resolve(res);
        }).catch((error) => {
            logger.error(`${error}`);
            reject(console.error('Failed to retrieve data : ', error));
        });
    });
  };

  exports.getProductImage = function(imageId){
    return new Promise(async (resolve, reject) => {
        const logger = await app.getLogger();
        let db = await  app.getProductImageModel();
        db.findOne({
            where: {
                image_id : imageId
            }
        }).then(res => {
            resolve(res);
        }).catch((error) => {
            logger.error(`${error}`);
            reject(console.error('Failed to retrieve data : ', error));
        });
    });
  };