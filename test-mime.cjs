const express = require('express');
const request = require('supertest');
const path = require('path');
const app = express();
app.use('/models', express.static(path.join(__dirname, 'public/models')));
request(app).get('/models/face_recognition_model-shard1').end((err, res) => {
  console.log(res.headers);
});
