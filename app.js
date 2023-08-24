require('dotenv').config();
const bodyParser = require("body-parser");
const express = require("express");
const validator = require("email-validator");
const upload = require("express-fileupload");
const AWS = require("aws-sdk");
const uuid = require('uuid');
const statsd = require('node-statsd');
const winston = require('winston');
const os = require('os');
const app = express();
const saltRounds = 10;

app.use(bodyParser.json());

app.use(upload());

const client = new statsd({
    host: 'localhost',
    port: 8125,
    prefix: 'api.calls.'
});

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(info => {
        const hostname = os.hostname();
        const logObj = {
            hostname,
            level: info.level,
            message: info.message
        };
            return JSON.stringify(logObj);
        })
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: '/var/log/csye6225/webapp.log' })
    ]
});

const get = require(__dirname + "/get.js");
const post = require(__dirname + "/post.js");
const put = require(__dirname + "/put.js");
const del = require(__dirname + "/delete.js");

const sequelize = require("sequelize");

const db = new sequelize(
    process.env.DATABASE,
    process.env.USER_NAME,
    process.env.PASSWORD,
    {
        host: process.env.HOST,
        dialect: 'mysql',
        timezone: '-05:00'
    }
);

db.authenticate().then(() => {
    console.log('Connection has been established successfully.');
    logger.info(`Connection to the database is established successfully.`);
}).catch((error) => {
    console.log('Unable to connect to the database: ');
    logger.error(`Unable to connect to the database, ${error}.`);
});

const user = db.define("users", {
    id: {
        type: sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    username: {
        type: sequelize.STRING,
        allowNull: false
    },
    password: {
        type: sequelize.STRING,
        allowNull: false
    },
    first_name: {
        type: sequelize.STRING,
        allowNull: false
    },
    last_name: {
        type: sequelize.STRING,
        allowNull: false
    }},
    {
    createdAt: 'account_created',
    updatedAt: 'account_updated'
});

const product = db.define("products", {
        id: {
            type: sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        name: {
            type: sequelize.STRING,
            allowNull: false
        },
        description: {
            type: sequelize.STRING,
            allowNull: false
        },
        sku: {
            type: sequelize.STRING,
            allowNull: false
        },
        manufacturer: {
            type: sequelize.STRING,
            allowNull: false
        },
        quantity: {
            type: sequelize.INTEGER,
            allowNull: false,
            validate: {
                min: 0,
                max: 100
            }
        },
        owner_user_id: {
            type: sequelize.INTEGER,
            allowNull: false,
            noUpdate: true,
            references: {
                model: 'users',
                key: 'id'
            }
        }
    },
    {
        createdAt: 'date_added',
        updatedAt: 'date_last_updated'
    });

    const image = db.define("images", {
        image_id: {
            type: sequelize.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        product_id: {
            type: sequelize.INTEGER,
            allowNull: false,
            noUpdate: true,
            references: {
                model: 'products',
                key: 'id'
            }
        },
        file_name: {
            type: sequelize.STRING,
            allowNull: false
        },
        s3_bucket_path: {
            type: sequelize.STRING,
            allowNull: false
        }},
        {
        createdAt: 'date_created',
        updatedAt: false
    });

db.sync().then(() => {
    console.log('Tables are created successfully!');
    logger.info(`Tables are created successfully in the database.`);
}).catch((error) => {
    console.log('Unable to create tables : ');
    logger.error(`Unable to create tables in the database, ${error}.`);
});

exports.getUserModel = function()
{
    return user;
}

exports.getProductModel = function()
{
    return product;
}

exports.getProductImageModel = function()
{
    return image;
}

exports.getLogger = function()
{
    return logger;
}

//Check if server is running.
app.get("/healthz", function(req, res){
  client.increment('GET.healthz');
  res.status(200);
  res.send({"Status": 200, "Message": "Server is up and running."});
  logger.info('Called the healthz endpoint.');
});

//Make a GET call.
app.get("/v2/user/:userId", async function(req, res){
   client.increment('GET.v1.user.userId');
   let userId = req.params.userId;
   let auth_header = req.headers.authorization;
   if(!auth_header)
   {
     res.status(401);
     res.send({"Status": 401, "Message": "Please provide an Auth token."});
     logger.info(`Authentication failed, Auth token is not provided for the user_id: ${userId}.`);
     return;
   }
   const [user_name, user_pass] = Buffer.from(auth_header.replace('Basic ', ''), 'base64').toString('utf8').replace(':', ',').split(',');
   if(validator.validate(user_name) && user_pass)
   {
         let result = await get.getUserDetails(user_name);
         if(result)
         {
             result = result.dataValues;
              let same = await get.isPasswordSame(user_pass, result);
              if(same === true)
              {
                if(result.id == userId)
                {
                  delete result.password;
                  res.send(result);
                  logger.info(`User successfully accessed the data of userid: ${userId}.`);
                }
                else
                {
                    res.status(403);
                    res.send({"Status": 403, "Message": "You do not have access to view this data."});
                    logger.info(`Authorization failed, User does not have access to view the data of userid: ${userId}.`);
                }
              }
              else
              {
                  res.status(401);
                  res.send({"Status": 401, "Message": "Username or Password is Incorrect."});
                  logger.info(`Authentication failed , Username or Password is Incorrect for user_id: ${userId}.`);
              }
         }
         else
         {
             res.status(401);
             res.send({"Status": 401, "Message": "Username or Password is Incorrect."});
             logger.info(`Authentication failed , Username or Password is Incorrect for user_id: ${userId}.`);
         }
   }
   else
   {
       res.status(401);
       res.send({"Status": 401, "Message": "Username or Password is Incorrect."});
       logger.info(`Authentication failed , Username is not valid or Password field is empty for user_id: ${userId}.`);
   }
});

app.get("/v2/product/:productId", async function(req, res){
   client.increment('GET.v1.product.productId');
   let productId = req.params.productId;
   let result = await get.getProductDetails(productId);
   if(result)
   {
       res.status(200);
       res.send(result.dataValues);
       logger.info(`Product info with product_id: ${productId} is successfully accessed.`);
   }
   else
   {
       res.status(404);
       res.send({"Status": 404, "Message": "Product with the given Id does not exist."});
       logger.info(`Product info with product_id: ${productId} does not exist.`);
   }
});

app.get("/v2/product/:product_id/image", async function(req, res){
    client.increment('GET.v1.product.productId.image');
    let productId = req.params.product_id;
    let auth_header = req.headers.authorization;
    if(!auth_header)
    {
        res.status(401);
        res.send({"Status": 401, "Message": "Please provide an Auth token."});
        logger.info(`Authentication failed, Auth token is not provided to access the images of product (id: ${productId}).`);
        return;
    }
    const [username, password] = Buffer.from(auth_header.replace('Basic ', ''), 'base64').toString('utf8').replace(':', ',').split(',');
    if(username.trim() == '' && password == '')
    {
        res.status(401);
        res.send({"Status": 401, "Message": "Username or Password is Invalid."});
        logger.info(`Authentication failed, Username and password fields are empty to access the images of product (id: ${productId}).`);
        return;
    }
    let response = await get.getUserDetails(username);
    if(response)
    {
        response = response.dataValues;
        let same = await get.isPasswordSame(password, response);
        if(same === true)
        {
            let productExist = await del.productExists(productId);
            if(productExist)
            {
                let userProduct = await del.isUserProduct(productId, response.id);
                if(userProduct)
                {
                    let response = await get.getProductImages(productId);
                    res.status(200);
                    res.send(response);
                    logger.info(`User successfully accessed the images of product (id: ${productId}).`);
                }
                else
                {
                    res.status(403);
                    res.send({"Status": 403, "Message": "User doesn't have access rights to view this product images."});
                    logger.info(`Authorization failed, User doesn't have access to view the images of product (id: ${productId}).`);
                }
            }
            else
            {
                res.status(404);
                res.send({"Status": 404, "Message": "Product with the given Id does not exist."});
                logger.info(`Product with product_id: ${productId} does not exist.`);
            }
        }
        else
        {
            res.status(401);
            res.send({"Status": 401, "Message": "Username or Password is Incorrect."});
            logger.info(`Authentication failed , Username or Password is Incorrect to access the images of product (id: ${productId}).`);
        }
    }
    else
    {
        res.status(401);
        res.send({"Status": 401, "Message": "Username or Password is Incorrect."});
        logger.info(`Authentication failed , Username or Password is Incorrect to access the images of product (id: ${productId}).`);
    }
});

app.get("/v2/product/:product_id/image/:image_id", async function(req, res){
    client.increment('GET.v1.product.productId.image.image_id');
    let productId = req.params.product_id;
    let imageId = req.params.image_id;
    let auth_header = req.headers.authorization;
    if(!auth_header)
    {
        res.status(401);
        res.send({"Status": 401, "Message": "Please provide an Auth token."});
        logger.info(`Authentication failed, Auth token is not provided to access the image (id: ${imageId}) of product (id: ${productId}).`);
        return;
    }
    const [username, password] = Buffer.from(auth_header.replace('Basic ', ''), 'base64').toString('utf8').replace(':', ',').split(',');
    if(username.trim() == '' && password == '')
    {
        res.status(401);
        res.send({"Status": 401, "Message": "Username or Password is Invalid."});
        logger.info(`Authentication failed, Username and password fields are empty to access the image (id: ${imageId}) of product (id: ${productId}).`);
        return;
    }
    let response = await get.getUserDetails(username);
    if(response)
    {
        response = response.dataValues;
        let same = await get.isPasswordSame(password, response);
        if(same === true)
        {
            let productExist = await del.productExists(productId);
            if(productExist)
            {
                let userProduct = await del.isUserProduct(productId, response.id);
                if(userProduct)
                {                    
                    let imageExists = await get.getProductImage(imageId);
                    if(imageExists)
                    {
                        if(productId == imageExists.product_id)
                        {
                            res.status(200);
                            res.send(imageExists);
                            logger.info(`User successfully accessed the image (id: ${imageId}) of product (id: ${productId}).`);
                        }
                        else 
                        {
                            res.status(404);
                            res.send({"Status": 404, "Message": "Image not found for the given product."});
                            logger.info(`Image (id: ${imageId}) for product (id: ${productId}) does not exist.`);
                        }                        
                    }
                    else 
                    {
                        res.status(404);
                        res.send({"Status": 404, "Message": "Image with the given Id does not exist."});
                        logger.info(`Image (id: ${imageId}) does not exist for any product.`);
                    }                    
                }
                else
                {
                    res.status(403);
                    res.send({"Status": 403, "Message": "User doesn't have access to view this product's images."});
                    logger.info(`Authorization failed, User doesn't have access to view the image (id: ${imageId}) for product (id: ${productId}).`);
                }
            }
            else
            {
                res.status(404);
                res.send({"Status": 404, "Message": "Product with the given Id does not exist."});
                logger.info(`Product with product_id: ${productId} does not exist.`);
            }
        }
        else
        {
            res.status(401);
            res.send({"Status": 401, "Message": "Username or Password is Incorrect."});
            logger.info(`Authentication failed , Username or Password is Incorrect to access the image (id: ${imageId}) for product (id: ${productId}).`);
        }
    }
    else
    {
        res.status(401);
        res.send({"Status": 401, "Message": "Username or Password is Incorrect."});
        logger.info(`Authentication failed , Username or Password is Incorrect to access the image (id: ${imageId}) for product (id: ${productId}).`);
    }
});

//Make a POST call.
app.post("/v2/user", async function(req, res){
   client.increment('POST.v1.user');
   let username = req.body.username;
   let password = req.body.password;
   let first_name = req.body.first_name;
   let last_name = req.body.last_name;
   if(typeof username === "string" && typeof password === "string" && typeof first_name === "string" && typeof last_name === "string" && validator.validate(username))
   {
       let found = false;
       let result = await post.getAllUsers();
       for(let i = 0; i < result.length; i++)
       {
           if(result[i].username === username)
           {
               found = true;
               break;
           }
       }
       if(!found)
       {
           password = await post.hashPassword(password, saltRounds);
           let resp = await post.createNewUser(username, password, first_name, last_name);
           delete resp.dataValues.password;
           res.status(201);
           res.send(resp.dataValues);
           logger.info(`Created the user.`);
       }
       else
       {
         res.status(400);
         res.send({"Status": 400, "Message": "The given Username already exists."});
         logger.info(`User with the given username already exists.`);
       }
   }
   else
   {
       res.status(400);
       res.send({"Status": 400, "Message": "Username is not valid or not all the fields given."});
       logger.info(`Username is not valid or not all the mandatory fields were filled.`);
   }
});

app.post("/v2/product", async function(req, res){
   client.increment('POST.v1.product');
   let name =  req.body.name;
   let description = req.body.description;
   let sku = req.body.sku;
   let manufacturer = req.body.manufacturer;
   let quantity = req.body.quantity;
   let count = Object.keys(req.body).length;
   let auth_header = req.headers.authorization;

    if(typeof name !== "string" || typeof description !== "string" || typeof sku !== "string" || typeof manufacturer !== "string" || typeof quantity !== "number" || count !== 5)
    {
        res.status(400);
        res.send({"Status": 400, "Message": "Request body is not valid."});
        logger.info(`Request body is not valid.`);
        return;
    }

    sku = sku.trim().toUpperCase();

    if(sku === "")
    {
        res.status(400);
        res.send({"Status": 400, "Message": "SKU is not valid."});
        logger.info(`SKU is empty.`);
        return;
    }

    if(typeof quantity !== "number" || (quantity - Math.floor(quantity) !== 0))
    {
        res.status(400);
        res.send({"Status": 400, "Message": "Product quantity should be an Integer between 0 and 100."});
        logger.info(`Product quantity should be an Integer between 0 and 100 for the product.`);
        return;
    }

   if(!auth_header)
   {
       res.status(401);
       res.send({"Status": 401, "Message": "Please provide an Auth token."});
       logger.info(`Authentication failed, Auth token is not provided to create a new product.`);
       return;
   }
   const [username, password] = Buffer.from(auth_header.replace('Basic ', ''), 'base64').toString('utf8').replace(':', ',').split(',');
   if(validator.validate(username) && password)
   {

       let result = await get.getUserDetails(username);
       if(result)
       {
           result = result.dataValues;
           let same = await get.isPasswordSame(password, result);
           if(same === true)
           {
               let skuExists = await post.skuExists(sku);
               if(skuExists)
               {
                   res.status(400);
                   res.send({"Status": 400, "Message": "The given SKU is already taken."});
                   logger.info(`SKU: ${sku} is already taken.`);
               }
               else
               {
                   let resp = await post.createNewProduct(name, description, sku, manufacturer, quantity, result.id, res);
                   res.status(201);
                   res.send(resp.dataValues);
                   logger.info(`Created a new product with SKU: ${sku}.`);
               }
           }
           else
           {
               res.status(401);
               res.send({"Status": 401, "Message": "Username or Password is Incorrect."});
               logger.info(`Authentication failed , Username or Password is Incorrect to create a product.`);
           }
       }
       else
       {
           res.status(401);
           res.send({"Status": 401, "Message": "Username or Password is Incorrect."});
           logger.info(`Authentication failed , Username or Password is Incorrect to create a product.`);
       }
   }
   else
   {
       res.status(401);
       res.send({"Status": 401, "Message": "Username or Password is Incorrect."});
       logger.info(`Authentication failed , Username or Password is not valid to create a product.`);
   }
});

function uploadImage(image)
{
    return new Promise(async (resolve, reject) => {
        AWS.config.update({
            region: process.env.AWS_DEFAULT_REGION
        });
        const s3 = new AWS.S3();
        const fileContent = Buffer.from(image.data, 'binary');
        const params = {
            Bucket: process.env.S3_BUCKET,
            Key: uuid.v4() + "/" + image.name,
            Body: fileContent
        }
        s3.upload(params, (err, data) => {
            if(err)
            {
                logger.error(`${err}`);
                reject(err);
            }
            else 
            {
                resolve(data);
            }
        });
    });    
}

app.post("/v2/product/:product_id/image", async function(req, res){
    client.increment('POST.v1.product.product_id.image');
    let productId = req.params.product_id;
    let auth_header = req.headers.authorization;
    if(!auth_header)
    {
        res.status(401);
        res.send({"Status": 401, "Message": "Please provide an Auth token."});
        logger.info(`Authentication failed, Auth token is not provided to upload an image for the product (id: ${productId}).`);
        return;
    }
    const [username, password] = Buffer.from(auth_header.replace('Basic ', ''), 'base64').toString('utf8').replace(':', ',').split(',');
    if(username.trim() == '' && password == '')
    {
        res.status(401);
        res.send({"Status": 401, "Message": "Username or Password is Invalid."});
        logger.info(`Authentication failed, Username or password is empty to upload an image for the product (id: ${productId}).`);
        return;
    }
    let response = await get.getUserDetails(username);
    if(response)
    {
        response = response.dataValues;
        let same = await get.isPasswordSame(password, response);
        if(same === true)
        {
            let productExist = await del.productExists(productId);
            if(productExist)
            {
                let userProduct = await del.isUserProduct(productId, response.id);
                if(userProduct)
                {
                    if(req.files)
                    {
                        if(req.files.image)
                        {
                            // if(req.files.image instanceof Array)
                            // {
                            //     for(let i of req.files.image)
                            //     {
                            //         if(i.mimetype !== 'image/jpeg' && i.mimetype !== 'image/jpg' && i.mimetype === 'image/png')
                            //         {
                            //             res.status(400);
                            //             res.send({"Status": 400, "Message": "Only the file formats JPG, JPEG and PNG are allowed."});
                            //             return;
                            //         }                                        
                            //     }
                            //     for(let i of req.files.image)
                            //     {
                            //         uploadImage(res, i);
                            //     }
                            // } 
                            let isObject = function(a) {
                                return (!!a) && (a.constructor === Object);
                            };
                            if(isObject(req.files.image))
                            {
                                if(req.files.image.mimetype !== 'image/jpeg' && req.files.image.mimetype !== 'image/jpg' && req.files.image.mimetype === 'image/png')
                                {
                                    res.status(400);
                                    res.send({"Status": 400, "Message": "Only the file formats JPG, JPEG and PNG are allowed."});
                                    logger.info(`Only the file formats JPG, JPEG and PNG are allowed to upload an image for the product (id: ${productId}).`);
                                    return;
                                }
                                else
                                {
                                    let data = await uploadImage(req.files.image);
                                    let resp = await post.createNewProductImage(productId, req.files.image.name, data.key);
                                    res.status(201);
                                    res.send(resp.dataValues);
                                    logger.info(`Successfully uploaded an image for the product (id: ${productId})`);
                                }                
                            }
                            else
                            {
                                res.status(400);
                                res.send({"Status": 400, "Message": "Only one Image can be uploaded."});
                                logger.info(`Only one image can be uploaded for the product`);
                                return;
                            }                            
                        }
                        else 
                        {
                            res.status(400);
                            res.send({"Status": 400, "Message": "Please upload at least one image by using image key."});
                            logger.info(`At least one image with image key needs to be uploaded.`);
                        }     
                    }
                    else 
                    {
                        res.status(400);
                        res.send({"Status": 400, "Message": "Please upload at least one image."});
                        logger.info(`At least one image needs to be uploaded.`);
                    }
                }
                else
                {
                    res.status(403);
                    res.send({"Status": 403, "Message": "User doesn't have access to upload an image for this product."});
                    logger.info(`Authorization is failed, User does not have access to upload an image for the product (id: ${productId}).`);
                }
            }
            else
            {
                res.status(404);
                res.send({"Status": 404, "Message": "Product with the given Id does not exist."});
                logger.info(`Product with the given Id: ${productId} does not exist.`);
            }
        }
        else
        {
            res.status(401);
            res.send({"Status": 401, "Message": "Username or Password is Incorrect."});
            logger.info(`Authentication failed , Username or Password is Incorrect to upload an image for the product (id: ${productId}).`);
        }
    }
    else
    {
        res.status(401);
        res.send({"Status": 401, "Message": "Username or Password is Incorrect."});
        logger.info(`Authentication failed , Username or Password is Incorrect to upload an image for the product (id: ${productId}).`);
    }    
});

//Make a PUT call.
app.put("/v2/user/:userId", async function(req, res){
  client.increment('PUT.v1.user.userId');
  let userId = req.params.userId;
  let id = req.body.id;
  let username = req.body.username;
  let password = req.body.password;
  let first_name = req.body.first_name;
  let last_name = req.body.last_name;
  let account_created = req.body.account_created;
  let account_updated = req.body.account_updated;
  let auth_header = req.headers.authorization;
  let count = Object.keys(req.body).length;

  if(!auth_header)
  {
      res.status(401);
      res.send({"Status": 401, "Message": "Please provide an Auth token."});
      logger.info(`Authentication failed, Auth token is not provided to update the user data for the user (id: ${userId}).`);
      return;
  }

  const [user_name, user_pass] = Buffer.from(auth_header.replace('Basic ', ''), 'base64').toString('utf8').replace(':', ',').split(',');
  if(user_name.trim() == '' && user_pass == '')
  {
      res.status(401);
      res.send({"Status": 401, "Message": "Username or Password is Invalid."});
      logger.info(`Authentication failed, Username or Password is empty for the user (id: ${userId}).`);
      return;
  }
  if(typeof password === "string" && typeof first_name === "string" && typeof last_name === "string" && count === 3)
  {
      let response = await get.getUserDetails(user_name);
      if(response)
      {
          response = response.dataValues;
          let same = await get.isPasswordSame(user_pass, response);
          if(same === true)
          {
              if(response.id == userId)
              {
                  password = await post.hashPassword(password, saltRounds);
                  await put.updateUser(password, first_name, last_name, userId);
                  res.status(204);
                  res.send({"Status": 204, "Message": "Updated the user successfully."});
                  logger.info(`Successfully Updated the user data for the user (id: ${userId}).`);
              }
              else
              {
                  res.status(403);
                  res.send({"Status": 403, "Message": "You do not have access to update this user."});
                  logger.info(`Authorization failed, User does not have access to update the user data for the user (id: ${userId}).`);
              }
          }
          else
          {
              res.status(401);
              res.send({"Status": 401, "Message": "Username or Password is Incorrect."});
              logger.info(`Authentication failed , Username or Password is Incorrect to update the user data for the user (id: ${userId}).`);
          }
      }
      else
      {
          res.status(401);
          res.send({"Status": 401, "Message": "Username or Password is Incorrect."});
          logger.info(`Authentication failed , Username or Password is Incorrect to update the user data for the user (id: ${userId}).`);
      }
  }
  else
  {
      res.status(400);
      res.send({"Status": 400, "Message": "Request body is invalid."});
      logger.info(`Request body is invalid to update the user (id: ${userId}).`);
  }
});

app.put("/v2/product/:productId", async function(req, res){
    client.increment('PUT.v1.product.productId');
    let auth_header = req.headers.authorization;
    let productId = req.params.productId;
    let body = req.body;
    let productName = body.name;
    let productDescription = body.description;
    let productSku = body.sku;
    let productManufacturer = body.manufacturer;
    let productQuantity = body.quantity;
    let count = Object.keys(body).length;

    if(typeof productName !== "string" || typeof productDescription !== "string" || typeof productSku != "string" || typeof productManufacturer !== "string" || typeof productQuantity !== "number" || count !== 5)
    {
        res.status(400);
        res.send({"Status": 400, "Message": "Request body is not valid."});
        logger.info(`Request body is not valid.`);
        return;
    }

    body["sku"] = body["sku"].trim().toUpperCase();
    productSku = body.sku;

    if(productSku === "")
    {
        res.status(400);
        res.send({"Status": 400, "Message": "SKU is not valid."});
        logger.info(`SKU is empty.`);
        return;
    }

    if(typeof productQuantity !== "number" || (productQuantity - Math.floor(productQuantity) !== 0))
    {
        res.status(400);
        res.send({"Status": 400, "Message": "Product quantity should be an Integer between 0 and 100."});
        logger.info(`Product quantity should be an Integer between 0 and 100 for the product.`);
        return;
    }

    if(!auth_header)
    {
        res.status(401);
        res.send({"Status": 401, "Message": "Please provide an Auth token."});
        logger.info(`Authentication failed, Auth token is not provided to update the product data for the product (id: ${productId}).`);
        return;
    }

    const [user_name, user_pass] = Buffer.from(auth_header.replace('Basic ', ''), 'base64').toString('utf8').replace(':', ',').split(',');

    if(user_name.trim() == '' && user_pass == '')
    {
        res.status(401);
        res.send({"Status": 401, "Message": "Username or Password is Invalid."});
        logger.info(`Authentication failed, Username or password is empty to update the product (id: ${productId}).`);
        return;
    }
    let response = await get.getUserDetails(user_name);
    if(response)
    {
        response = response.dataValues;
        let same = await get.isPasswordSame(user_pass, response);
        if(same === true)
        {
                let productExist = await del.productExists(productId);
                if(productExist)
                {
                    let userProduct = await del.isUserProduct(productId, response.id);
                    if(userProduct)
                    {
                        let skuExists = await put.skuExists(productSku, productId);
                        if(skuExists)
                        {
                            res.status(400);
                            res.send({"Status": 400, "Message": "The given SKU is already taken."});
                            logger.info(`The sku ${productSku} is already taken.`);
                            return;
                        }
                        else
                        {
                            await put.updateProduct(body, productId, res);
                            res.status(204);
                            res.send({"Status": 204, "Message": "Updated the product successfully."});
                            logger.info(`Product (id: ${productId}) is updated successfully.`);
                        }
                    }
                    else
                    {
                        res.status(403);
                        res.send({"Status": 403, "Message": "User doesn't have access rights to update this product."});
                        logger.info(`Authorization failed, User doesn't have access rights to update this product (id: ${productId}).`);
                    }
                }
                else
                {
                    res.status(404);
                    res.send({"Status": 404, "Message": "Product with the given Id does not exist."});
                    logger.info(`product with the given (id: ${productId}) does not exist.`);
                }
        }
        else
        {
            res.status(401);
            res.send({"Status": 401, "Message": "Username or Password is Incorrect."});
            logger.info(`Authentication failed , Username or Password is Incorrect to update the product (${productId}) data.`);
        }
    }
    else
    {
        res.status(401);
        res.send({"Status": 401, "Message": "Username or Password is Incorrect."});
        logger.info(`Authentication failed , Username or Password is Incorrect to update the product (${productId}) data.`);
    }
});

app.patch("/v2/product/:productId", async function(req, res){
    client.increment('PATCH.v1.product.productId');
    let auth_header = req.headers.authorization;
    let productId = req.params.productId;
    let updateOptions = {"name":"", "description":"", "sku":"", "manufacturer":"", "quantity":""};
    let body = req.body;
    let count = Object.keys(body).length;
    if(count < 1)
    {
        res.status(400);
        res.send({"Status": 400, "Message": "Request body is not valid."});
        logger.info(`Request body is not valid.`);
        return;
    }
    if(body.hasOwnProperty("name"))
    {
        if(typeof body["name"] !== "string")
        {
            res.status(400);
            res.send({"Status": 400, "Message": "name is Invalid."});
            logger.info(`Product name: ${body["name"]} is not valid.`);
            return;
        }
    }
    if(body.hasOwnProperty("description"))
    {
        if(typeof body["description"] !== "string")
        {
            res.status(400);
            res.send({"Status": 400, "Message": "description is Invalid."});
            logger.info(`Product description: ${body["description"]} is not valid.`);
            return;
        }
    }
    if(body.hasOwnProperty("manufacturer"))
    {
        if(typeof body["manufacturer"] !== "string")
        {
            res.status(400);
            res.send({"Status": 400, "Message": "manufacturer is Invalid."});
            logger.info(`Product manufacturer: ${body["manufacturer"]} is not valid.`);
            return;
        }
    }
    if(body.hasOwnProperty("sku"))
    {
        if(typeof body["sku"] === "string" && body["sku"].trim() !== "")
        {
            body["sku"] = body["sku"].trim().toUpperCase();
        }
        else
        {
            res.status(400);
            res.send({"Status": 400, "Message": "SKU is Invalid."});
            logger.info(`Product sku: ${body["sku"]} is not valid.`);
            return;
        }
    }
    let sku = body.sku;

    if(body.hasOwnProperty("quantity"))
    {
        if(typeof body["quantity"] !== "number" || (body["quantity"] - Math.floor(body["quantity"]) !== 0))
        {
            res.status(400);
            res.send({"Status": 400, "Message": "Product quantity should be an Integer between 0 and 100."});
            logger.info(`Product quantity: ${body["quantity"]} is not valid, should be an Integer between 0 and 100.`);
            return;
        }
    }

    for(let i in body)
    {
        if(!updateOptions.hasOwnProperty(i))
        {
            res.status(400);
            res.send({"Status": 400, "Message": "Request body consists of unidentified fields."});
            logger.info(`Request body consists of unidentified fields.`);
            return;
        }
    }

    if(!auth_header)
    {
        res.status(401);
        res.send({"Status": 401, "Message": "Please provide an Auth token."});
        logger.info(`Authentication failed, Auth token is not provided to update the product data for the product (id: ${productId}).`);
        return;
    }

    const [user_name, user_pass] = Buffer.from(auth_header.replace('Basic ', ''), 'base64').toString('utf8').replace(':', ',').split(',');
    if(user_name.trim() == '' && user_pass == '')
    {
        res.status(401);
        res.send({"Status": 401, "Message": "Username or Password is Invalid."});
        logger.info(`Authentication failed, Username or password is empty to update the product (id: ${productId}).`);
        return;
    }
    let response = await get.getUserDetails(user_name);
    if(response)
    {
        response = response.dataValues;
        let same = await get.isPasswordSame(user_pass, response);
        if(same === true)
        {
            let productExist = await del.productExists(productId);
            if(productExist)
            {
                let userProduct = await del.isUserProduct(productId, response.id);
                if(userProduct)
                {
                    if(sku)
                    {
                        let skuExists = await put.skuExists(sku, productId);
                        if(skuExists)
                        {
                            res.status(400);
                            res.send({"Status": 400, "Message": "The given SKU is already taken."});
                            logger.info(`The sku: ${sku} is already taken.`);
                            return;
                        }
                    }
                    await put.updateProduct(body, productId, res);
                    res.status(204);
                    res.send({"Status": 204, "Message": "Updated the product successfully."});
                    logger.info(`Product (id: ${productId}) is updated successfully.`);
                }
                else
                {
                    res.status(403);
                    res.send({"Status": 403, "Message": "User doesn't have access rights to update this product."});
                    logger.info(`Authorization failed, User doesn't have access rights to update this product (id: ${productId}).`);
                }
            }
            else
            {
                res.status(404);
                res.send({"Status": 404, "Message": "Product with the given Id does not exist."});
                logger.info(`product (id: ${productId}) does not exist.`);
            }
        }
        else
        {
            res.status(401);
            res.send({"Status": 401, "Message": "Username or Password is Incorrect."});
            logger.info(`Authentication failed , Username or Password is Incorrect to update the product (${productId}) data.`);
        }
    }
    else
    {
        res.status(401);
        res.send({"Status": 401, "Message": "Username or Password is Incorrect."});
        logger.info(`Authentication failed , Username or Password is Incorrect to update the product (${productId}) data.`);
    }
});

app.delete("/v2/product/:productId", async function(req, res){
    client.increment('DELETE.v1.product.productId');
    let productId = req.params.productId;
    let auth_header = req.headers.authorization;

    if(!auth_header)
    {
        res.status(401);
        res.send({"Status": 401, "Message": "Please provide an Auth token."});
        logger.info(`Authentication failed, Auth token is not provided to delete the product data for the product (id: ${productId}).`);
        return;
    }

    const [user_name, user_pass] = Buffer.from(auth_header.replace('Basic ', ''), 'base64').toString('utf8').replace(':', ',').split(',');
    if(user_name.trim() == '' && user_pass == '')
    {
        res.status(401);
        res.send({"Status": 401, "Message": "Username or Password is Invalid."});
        logger.info(`Authentication failed, Username or password is empty to delete the product (id: ${productId}).`);
        return;
    }

    let response = await get.getUserDetails(user_name);
    if(response)
    {
        response = response.dataValues;
        let same = await get.isPasswordSame(user_pass, response);
        if(same === true)
        {
            let productExist = await del.productExists(productId);
            if(productExist)
            {
                let userProduct = await del.isUserProduct(productId, response.id);
                if(userProduct)
                {
                    let productImages = await get.getProductImages(productId);
                    for(let image of productImages)
                        await deleteImage(image.s3_bucket_path);
                    await del.deleteProductImages(productId);
                    await del.deleteProduct(productId);
                    res.status(204);
                    res.send({"Status": 204, "Message": "Deleted the product successfully."});
                    logger.info(`Deleted the product (id: ${productId}) successfully.`);
                }
                else
                {
                    res.status(403);
                    res.send({"Status": 403, "Message": "User doesn't have access rights to delete this product."});
                    logger.info(`Authorization failed, User doesn't have access rights to delete this product (id: ${productId}).`);
                }
            }
            else
            {
                res.status(404);
                res.send({"Status": 404, "Message": "Product with the given Id does not exist."});
                logger.info(`product (id: ${productId}) does not exist.`);
            }
        }
        else
        {
            res.status(401);
            res.send({"Status": 401, "Message": "Username or Password is Incorrect."});
            logger.info(`Authentication failed , Username or Password is Incorrect to delete the product (${productId}) data.`);
        }
    }
    else
    {
        res.status(401);
        res.send({"Status": 401, "Message": "Username or Password is Incorrect."});
        logger.info(`Authentication failed , Username or Password is Incorrect to delete the product (${productId}) data.`);
    }
});

function deleteImage(key)
{
    return new Promise(async (resolve, reject) => {
        AWS.config.update({
            region: process.env.AWS_DEFAULT_REGION
        });
        var s3 = new AWS.S3();
        var params = {  Bucket: process.env.S3_BUCKET, Key: key };

        s3.deleteObject(params, function(err, data) {
        if (err)
        {
            logger.error(`${err}`);
            reject(err);            
        }            
        else     
            resolve();
        });
    });
}

app.delete("/v2/product/:product_id/image/:image_id", async function(req, res){
    client.increment('DELETE.v1.product.product_id.image.image_id');
    let productId = req.params.product_id;
    let imageId = req.params.image_id;
    let auth_header = req.headers.authorization;
    if(!auth_header)
    {
        res.status(401);
        res.send({"Status": 401, "Message": "Please provide an Auth token."});
        logger.info(`Authentication failed, Auth token is not provided to delete the image (id: ${imageId}) for the product (id: ${productId}).`);
        return;
    }
    const [username, password] = Buffer.from(auth_header.replace('Basic ', ''), 'base64').toString('utf8').replace(':', ',').split(',');
    if(username.trim() == '' && password == '')
    {
        res.status(401);
        res.send({"Status": 401, "Message": "Username or Password is Invalid."});
        logger.info(`Authentication failed, Username or password is empty to delete the image (id: ${imageId}) for product (id: ${productId}).`);
        return;
    }
    let response = await get.getUserDetails(username);
    if(response)
    {
        response = response.dataValues;
        let same = await get.isPasswordSame(password, response);
        if(same === true)
        {
            let productExist = await del.productExists(productId);
            if(productExist)
            {
                let userProduct = await del.isUserProduct(productId, response.id);
                if(userProduct)
                {                    
                    let imageExists = await get.getProductImage(imageId);
                    if(imageExists)
                    {
                        if(productId == imageExists.product_id)
                        {
                            await del.deleteProductImage(imageId);
                            await deleteImage(imageExists.s3_bucket_path);
                            res.sendStatus(204);
                            logger.info(`Deleted the product (id: ${productId}) image (id: ${imageId}) successfully.`);
                        }
                        else 
                        {
                            res.status(404);
                            res.send({"Status": 404, "Message": "Image not found for the given product."});
                            logger.info(`product (id: ${productId}) image (id: ${imageId}) does not exist.`);
                        }                        
                    }
                    else 
                    {
                        res.status(404);
                        res.send({"Status": 404, "Message": "Image with the given Id does not exist."});
                        logger.info(`product (id: ${productId}) image (id: ${imageId}) does not exist.`);
                    }                    
                }
                else
                {
                    res.status(403);
                    res.send({"Status": 403, "Message": "User doesn't have access rights to delete this product's images."});
                    logger.info(`Authorization failed, User doesn't have access rights to delete this product (id: ${productId}) image (id: ${imageId}).`);
                }
            }
            else
            {
                res.status(404);
                res.send({"Status": 404, "Message": "Product with the given Id does not exist."});
                logger.info(`product (id: ${productId}) does not exist.`);
            }
        }
        else
        {
            res.status(401);
            res.send({"Status": 401, "Message": "Username or Password is Incorrect."});
            logger.info(`Authentication failed , Username or Password is Incorrect to delete the product (${productId}) image (id: ${imageId}).`);
        }
    }
    else
    {
        res.status(401);
        res.send({"Status": 401, "Message": "Username or Password is Incorrect."});
        logger.info(`Authentication failed , Username or Password is Incorrect to delete the product (${productId}) image (id: ${imageId}).`);
    }
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}

//Listening to client requests.
app.listen(port, function(){
  console.log("Server running on port 3000.");
});

module.exports = app;
