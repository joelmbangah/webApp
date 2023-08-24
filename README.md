## CSYE6225- Network Structures and Cloud Computing
## Assignment 1: Project description
Create a web application using a technology stack that meets Cloud-Native Web Application Requirements.
## Frameworks and third party libraries:
Packages required to run:
- Express
- Dotenv
- body-parser
- mysql
- bcrypt
- email-validator
- Chai
- Mocha
- Supertest
```
npm install Express Dotenv body-parser mysql bcrypt email-validator chai mocha supertest
```
## Prerequisites for building and deploying application locally:
```javascript
// install dependencies
npm install
// start the server script
npm start
// run test cases
npm test
```
## Endpoint URLs
```javascript
// 1. Route to check if the server is healthy
GET /healthz
// 2. GET route to retrieve user details
GET /v1/user/{userId}
// 3. POST route to add a new user to the database
POST /v1/user
// 4. PUT route to update user details
PUT /v1/user/{userId}
```
### Sample JSON Response for GET
```json
{
  "id": 1,
  "first_name": "Jane",
  "last_name": "Doe",
  "username": "jane.doe@example.com",
  "account_created": "2016-08-29T09:12:33.001Z",
  "account_updated": "2016-08-29T09:12:33.001Z"
}
```

### Sample JSON Request for POST
```json
{
  "username": "jane.doe@example.com",
  "password": "password",
  "first_name": "Jane",
  "last_name": "Doe",  
}
```

### Sample JSON Request for PUT
```json
{
  "password": "password",
  "first_name": "Jane",
  "last_name": "Doe",  
}
```

## Assignment 2:
Extra packages required to run:
- sequelize
- mysql2

## Endpoint URLs
```javascript
// 1. GET route to retrieve product details
GET /v1/product/{productId}
// 2. POST route to add a new product to the database
POST /v1/product
// 3. PUT route to update product details
PUT /v1/product/{productId}
// 4. PATCH route to update product details partially
PUT /v1/product/{productId}
// 5. DELETE route to delete product details
PUT /v1/product/{productId}
```

### Sample JSON Response for GET
```json
{
  "id": 1,
  "name": null,
  "description": null,
  "sku": null,
  "manufacturer": null,
  "quantity": 1,
  "date_added": "2016-08-29T09:12:33.001Z",
  "date_last_updated": "2016-09-29T09:12:33.001Z",
  "owner_user_id": 1
}
```

### Sample JSON Request for POST
```json
{
  "name": null,
  "description": null,
  "sku": null,
  "manufacturer": null,
  "quantity": 1
}
```

### Sample JSON Request for PUT
```json
{
  "name": null,
  "description": null,
  "sku": null,
  "manufacturer": null,
  "quantity": 1
}
```

### Sample JSON Request for PATCH
```json
{
  "name": null,
  "description": null,
  "sku": null,
  "manufacturer": null,
  "quantity": 1
}
```

### No request/response body for DELETE

## Assignment 4: Project description
Created a packer script which deploys custom AMI with all the required libraries that are needed to run the application using AMAZON LINUX 2 source image and shares the AMI with the demo account.

# Setting up Packer

The packer fmt command formats the packer script:
```
packer fmt filename
```

The packer validate command validates the syntax of the packer script::
```
packer validate filename
```

The packer build command builds the AMI:
```
packer build filename
```

## Assignment 7: Project description
Updated the packer script to download amazon-cloudwatch-agent and configured to send statsd metrics and application logs to AWS cloudwatch service.
Updated the application code with logs.

## Assignment 9: Project description
Updated the CI/CD actions workflow to get the latest AMI from the AWS and create a new launch template version of the latest AMI and refresh the instances of the target group using Auto Scaling Group.

Developer - Nagendra babu Shakamuri <br>
NUID - 002771584 </br>
Email - shakamuri.n@northeastern.edu
