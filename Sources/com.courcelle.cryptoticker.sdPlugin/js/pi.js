// this is our global websocket, used to communicate from/to Stream Deck software
// and some info about our plugin, as sent by Stream Deck software
var websocket = null,
    uuid = null,
    actionInfo = {},
    inInfo = {};

function getValueMultiselect(ms) {
    const selected = [];
    for (var i = 0; i < ms.length; i++) {
        const option = ms.options[i];
        if (option.selected) {
            selected.push(option.value);
        }
    }

    return selected.join(",");
}
function setValueMultiselect(ms, val) {
    const selected = val.split(",");
    for (var i = 0; i < ms.length; i++) {
        const option = ms.options[i];
        option.selected = (selected.indexOf(option.value)>=0);
    }
}

const loggingEnabled = false;
const settingsConfig = {
    "title": {
        "default": "Reminder",
        "value": document.getElementById("input-title")
    },
    "dow": {
        "default": "*",
        "value": document.getElementById("select-dow"),
        "getValue": function() {
            return getValueMultiselect(this.value);
        },
        "setValue": function(val) {
            setValueMultiselect(this.value, val);
        }
    },
    "dom": {
        "default": "*",
        "value": document.getElementById("input-dom")
    },
    "month": {
        "default": "*",
        "value": document.getElementById("select-month"),
        "getValue": function() {
            return getValueMultiselect(this.value);
        },
        "setValue": function(val) {
            setValueMultiselect(this.value, val);
        }
    },
    "hour": {
        "default": "21",
        "value": document.getElementById("input-hour")
    },
    "minute": {
        "default": "0",
        "value": document.getElementById("input-minute")
    },
    "lastAck": {
        "default": new Date().getTime()
    },
    "lastAlarmCheck": {
        "default": new Date().getTime()
    },
    "isInAlarm": {
        "default": "off"
    },
};

const currentSettings = {};
const cache = {};

let pi = {
    log: function(...data) {
        if (loggingEnabled) {
            console.log(...data);
        }
    },

    initDom: function() {
        const jThis = this;
        const callback = function() {
            jThis.checkNewSettings();
        }

        for(const k in settingsConfig) {
            const setting = settingsConfig[k];
            if (setting["value"]) {
                setting["value"].onchange = callback;
                setting["value"].onkeyup = callback;
            }
        }
    },

    extractSettings: function(settings) {
        this.log("extractSettings", settings);

        for (const k in settingsConfig) {
            currentSettings[k] = settings[k] || settingsConfig[k]["default"];
        }

        this.refreshValues();
    },
    checkNewSettings: function() {
        this.log("checkNewSettings");

        // Retrieve values from HTML to put them to the current settings
        for (const k in settingsConfig) {
            const settingConfig = settingsConfig[k];
            if (settingConfig["getValue"]) {
                currentSettings[k] = settingConfig["getValue"]() || settingConfig["default"];
            } else if (settingConfig["value"]) {
                currentSettings[k] = settingConfig["value"].value || settingConfig["default"];
            }
        }

        this.saveSettings();
    },
    refreshValues: function() {
        this.log("refreshValues");

        // Set values to the HTML
        for (const k in settingsConfig) {
            const settingConfig = settingsConfig[k];
            if (settingConfig["setValue"]) {
                settingConfig["setValue"](currentSettings[k]);
            } else if (settingConfig["value"]) {
                settingConfig["value"].value = currentSettings[k];
            }
        }
    },
    saveSettings: function() {
        this.log("saveSettings", currentSettings);

        if (websocket && (websocket.readyState === 1)) {
            const jsonSetSettings = {
                "event": "setSettings",
                "context": uuid,
                "payload": currentSettings
            };
            websocket.send(JSON.stringify(jsonSetSettings));

            const jsonPlugin = {
                "action": actionInfo["action"],
                "event": "sendToPlugin",
                "context": uuid,
                "payload": currentSettings
            };
            websocket.send(JSON.stringify(jsonPlugin));
        }
    }
}

pi.initDom();

function connectElgatoStreamDeckSocket(inPort, inUUID, inRegisterEvent, inInfo, inActionInfo) {
    uuid = inUUID;
    // please note: the incoming arguments are of type STRING, so
    // in case of the inActionInfo, we must parse it into JSON first
    actionInfo = JSON.parse(inActionInfo); // cache the info
    inInfo = JSON.parse(inInfo);
    websocket = new WebSocket('ws://127.0.0.1:' + inPort);

    /** let's see, if we have some settings */
    pi.extractSettings(actionInfo.payload.settings);
    // console.log(actionInfo.payload.settings);

    // if connection was established, the websocket sends
    // an 'onopen' event, where we need to register our PI
    websocket.onopen = function () {
        var json = {
            event: inRegisterEvent,
            uuid: inUUID
        };
        // register property inspector to Stream Deck
        websocket.send(JSON.stringify(json));
    };

    websocket.onmessage = function (evt) {
        // Received message from Stream Deck
        var jsonObj = JSON.parse(evt.data);
        var event = jsonObj['event'];
        // console.log("Received message", jsonObj);
    };
}