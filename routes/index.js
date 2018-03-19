const express = require('express');
const router = express.Router();
const SensorTag = require('sensortag');
const WebSocket = require('ws');
const iotPlatform = require('../integration/ibm-iot-platform');

const wss = new WebSocket.Server({port: 40510});

let sensorTag = null;
let threshold = 0.1;

let accelData = {};

router.get('/reset', function(req, res, next) {
  console.log("Clearing data");
  accelData = {};
  res.send({ status: 'Done' });
});

function accelChange(x,y,z) {
  let dimensions = {X:x, Y:y, Z:z};

  if(!accelData.hasOwnProperty("maxX")) {
    for(var key in dimensions) {
      if (dimensions.hasOwnProperty(key)) {
        accelData[`max${key}`] = dimensions[key];
        accelData[`min${key}`] = dimensions[key];
      }
    }
  }
  else {
    for(var key in dimensions) {
      if (dimensions.hasOwnProperty(key)) {
        accelData[`max${key}`] = Math.max(dimensions[key], accelData[`max${key}`]);
        accelData[`min${key}`] = Math.min(dimensions[key], accelData[`min${key}`]);
        accelData[`diff${key}`] = accelData[`current${key}`] - dimensions[key];
        accelData[`change${key}`] = accelData[`diff${key}`] > threshold;
      }
    }

    accelData.timestamp = new Date().getTime();
    accelData.dataFormat = "v1"; // In case I want to change data format and only select that type from DB
    accelData.changeDetected = accelData.changeX || accelData.changeY || accelData.changeZ;
  }

  // Only update current once all calculations have been completed
  for(var key in dimensions) {
    if (dimensions.hasOwnProperty(key)) {
      accelData[`current${key}`] = dimensions[key];
    }
  }

  if(accelData.changeDetected){
    console.log(`Publishing change detected.`);
    iotPlatform.postEvent(accelData);
  }

  if(wss && wss.broadcast) {
    wss.broadcast(JSON.stringify({
      type: 'accel',
      data: accelData
    }));
  }
}

function keyChange(left, right, reedRelay) {
  console.log(`Key change detected. Left: ${left}, Right: ${right}, ReedRelay: ${reedRelay}`);
}

console.log("Looking for devices.");

SensorTag.discoverAll(function(tag) {
  sensorTag = tag;
  console.log(`SensorTag discovered: ${sensorTag.id}`);

  sensorTag.connectAndSetUp(function(error) {
    debugger;
    if(!error) {
      sensorTag.enableAccelerometer(function () {
        console.log("accelerometer enabled");
      });

      sensorTag.notifyAccelerometer(function (error) {
        if (!error) {
          console.log(`notifyAccelerometer seems to be enabled`);
        }
        else {
          console.log(`notifyAccelerometer error: ${error}`);
        }
      });

      sensorTag.notifySimpleKey(function(error) {
        if(!error) {
          console.log(`notifySimpleKey seems to be enabled`);
        }
        else {
          console.log(`notifySimpleKey error: ${error}`);
        }
      });

      sensorTag.on('accelerometerChange', accelChange);
      sensorTag.on('simpleKeyChange', keyChange);
    }
    else {
      console.error(`Error connecting to sensortag: ${error}`);
    }
  });
});

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Iain\'s IoT control panel' });
});

wss.on('connection', function(ws) {
  ws.on('message', function (message) {
    console.log(`received: ${message}`);

    let inputObj = JSON.parse(message);

    if(inputObj.hasOwnProperty("threshold")) {
      threshold = inputObj.threshold;
      console.log(`Threshold changed to ${threshold}`);
    }
  });

  ws.send(JSON.stringify({msg: "Hello"}));

  //ws.send(JSON.stringify({sensorTagId: sensorTag.id}));

  //setInterval(() => ws.send(`${new Date()}`), 1000);
});

wss.broadcast = function broadcast(data) {
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};

module.exports = router;
