'use strict';

const express = require('express');
const PORT = process.env.PORT || 8080;
const server = express()
  .use(express.static('public'))
  .listen(PORT, () => console.log(`Listening on ${ PORT }`));
