const request = require('supertest');
const app = require('./app');
const chai = require('chai');
const expect = chai.expect;

describe('Authentication Tests', function() {
    describe('Successes', function() {
        it('Return 400 if the username is not valid', function(done) {
            request(app).post('/v2/user').send({
              username: "Nag",
              password: "Nag",
              first_name: "Nag",
              last_name: "Nag"
  }).end(function(err, res) {
                expect(res.statusCode).to.be.equal(400);
                done();
            });
        });
    });
});

describe('Authentication Tests', function() {
    describe('Successes', function() {
        it('Return 400 if the payload is not valid', function(done) {
            request(app).post('/v2/product').send({
                name: "Iphone"
            }).end(function(err, res) {
                expect(res.statusCode).to.be.equal(400);
                done();
            });
        });
    });
});
