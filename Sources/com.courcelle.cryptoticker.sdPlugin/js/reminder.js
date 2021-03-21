const DestinationEnum = Object.freeze({
    "HARDWARE_AND_SOFTWARE": 0,
    "HARDWARE_ONLY": 1,
    "SOFTWARE_ONLY": 2
});

const loggingEnabled = false;
let websocket = null;
let canvas;
let canvasContext;

const defaultSettings = {
    "lastAck": null
};

const tickerAction = {
    type: "com.courcelle.reminder.remind",
    log: function(...data) {
        if (loggingEnabled) {
            console.log(...data);
        }
    },

    onKeyDown: async function (context, settings, coordinates, userDesiredState) {
        settings["lastAck"] = new Date().getTime();

        // Update settings with current mode
        websocket.send(JSON.stringify({
            "event": "setSettings",
            "context": context,
            "payload": settings
        }));
    },
    onKeyUp: function (context, settings, coordinates, userDesiredState) {
    },
    onWillAppear: async function (context, settings, coordinates) {
        this.initCanvas();
    },
    refreshSettings: function(context, settings) {
        contextDetails[context] = {
            "context": context,
            "settings": settings
        };
    },

    initCanvas: function() {
        canvas = document.getElementById("reminder");
        canvasContext = canvas.getContext("2d");
    },
    updateCanvas: async function(context, settings, tickerValues) {
        this.log("updateCanvas", context, settings, tickerValues);


    },
};

function connectElgatoStreamDeckSocket(inPort, pluginUUID, inRegisterEvent, inApplicationInfo, inActionInfo) {
    // Open the web socket
    websocket = new WebSocket("ws://127.0.0.1:" + inPort);

    function registerPlugin(inPluginUUID) {
        var json = {
            "event": inRegisterEvent,
            "uuid": inPluginUUID
        };

        websocket.send(JSON.stringify(json));
    };

    websocket.onopen = function () {
        // WebSocket is connected, send message
        registerPlugin(pluginUUID);
    };

    websocket.onmessage = async function (evt) {
        //console.log("Message received", evt);

        // Received message from Stream Deck
        var jsonObj = JSON.parse(evt.data);
        const event = jsonObj["event"];
        const action = jsonObj["action"];
        const context = jsonObj["context"];

        const jsonPayload = jsonObj["payload"] || {};
        const settings = jsonPayload["settings"];
        const coordinates = jsonPayload["coordinates"];
        const userDesiredState = jsonPayload["userDesiredState"];
        // const title = jsonPayload["title"];
        // console.log("event", event);

        const ignoredEvents = [
            "deviceDidConnect",
            "titleParametersDidChange"
        ];

        if (ignoredEvents.indexOf(event) >= 0) {
            // Ignore
            return;
        }

        if (settings!=null) {
            for (k in defaultSettings) {
                if (!settings[k]) {
                    settings[k] = defaultSettings[k];
                }
            }
        }

        if (event == "keyDown") {
            await tickerAction.onKeyDown(context, settings, coordinates, userDesiredState);
        } else if (event == "keyUp") {
            await tickerAction.onKeyUp(context, settings, coordinates, userDesiredState);
        } else if (event == "willAppear") {
            await tickerAction.onWillAppear(context, settings, coordinates);
        } else if (settings!=null) {
            //console.log("Received settings", settings);
            tickerAction.refreshSettings(context, settings);
        }
    };

    websocket.onclose = function () {
        // Websocket is closed
    };

    setInterval(async function() {
        await tickerAction.refreshTimers();
    }, 60000);
};