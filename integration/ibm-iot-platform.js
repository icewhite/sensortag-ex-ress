const Client = require('ibmiotf');
const config = require('config');

let iotPlatform = module.exports = {};

const MQTT_QOS_LEVEL = 2;

const ibmIotConfig = config.get('ibmIot.config');

let connected = false;

const deviceClient = new Client.IotfDevice(ibmIotConfig);

deviceClient.log.setLevel('trace');

deviceClient.connect();

deviceClient.on("connect", function () {
  console.log("Connected to IBM IOT Platform");
  connected = true;
});

iotPlatform.postEvent = function(data) {
  if(!connected) {
    return false;
  }

  let payload = {
    d: data
  };

  deviceClient.publish("status", "json", JSON.stringify(payload), MQTT_QOS_LEVEL);
  /*
  deviceClient.publishHTTPS("status", "json", JSON.stringify(payload)).then(function onSuccess (argument) {
    console.log("Success");
    console.log(argument);
  }, function onError (argument) {

    console.log("Fail");
    console.log(argument);
  });
  */
};

