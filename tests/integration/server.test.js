const request = require('supertest');
const app = require('../../server');

describe('Basic server', function() {
  it('GET / should return running message', function(done) {
    request(app)
      .get('/')
      .expect(200)
      .expect('HealthPal API is running', done);
  });
});
