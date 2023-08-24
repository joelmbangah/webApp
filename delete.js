const app = require(__dirname + "/app.js");

exports.deleteProduct = function(productId){
    return new Promise(async (resolve, reject) => {
        const logger = await app.getLogger();
        let db = await app.getProductModel();        
        db.destroy({
            where: {
                id : productId
            }
        }).then(res => {
            resolve(res);
        }).catch((error) => {
            logger.error(`${error}`);
            reject(console.error('Failed to delete data : ', error));
        });
    });
};

exports.productExists = function(productId){
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
            reject(console.error('Failed to find the product : ', error));
        });
    });
};

exports.isUserProduct = function(productId, userId){
    return new Promise(async (resolve, reject) => {
        const logger = await app.getLogger();
        let db = await app.getProductModel();
        db.findOne({
            where: {
                id : productId,
                owner_user_id: userId
            }
        }).then(res => {
            resolve(res);
        }).catch((error) => {
            logger.error(`${error}`);
            reject(console.error('Failed to check if the product belongs to the user : ', error));
        });
    });
};

exports.deleteProductImage = function(imageId){
    return new Promise(async (resolve, reject) => {
        const logger = await app.getLogger();
        let db = await app.getProductImageModel();
        db.destroy({
            where: {
                image_id : imageId
            }
        }).then(res => {
            resolve(res);
        }).catch((error) => {
            logger.error(`${error}`);
            reject(console.error('Failed to delete data : ', error));
        });
    });
};

exports.deleteProductImages = function(productId){
    return new Promise(async (resolve, reject) => {
        const logger = await app.getLogger();
        let db = await app.getProductImageModel();
        db.destroy({
            where: {
                product_id : productId
            }
        }).then(res => {
            resolve(res);
        }).catch((error) => {
            logger.error(`${error}`);
            reject(console.error('Failed to delete data : ', error));
        });
    });
};