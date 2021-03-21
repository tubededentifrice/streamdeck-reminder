const DestinationEnum = Object.freeze({
    "HARDWARE_AND_SOFTWARE": 0,
    "HARDWARE_ONLY": 1,
    "SOFTWARE_ONLY": 2
});

const loggingEnabled = false;
let websocket = null;
let canvas;
let canvasContext;
const contextDetails = {};
const contextIntervals = {};
const parsedCrons = {};

const defaultSettings = {
    "title": "Reminder",
    "fontSize": "30",
    "dow": "*",
    "dom": "*",
    "month": "*",
    "hour": "21",
    "minute": "0",
    "lastAck": new Date().getTime(),
    "lastAlarmCheck": new Date().getTime(),
    "isInAlarm": "off",
};

const reminderAction = {
    type: "com.courcelle.reminder.remind",
    log: function(...data) {
        if (loggingEnabled) {
            console.log(...data);
        }
    },

    onKeyDown: async function (context, settings, coordinates, userDesiredState) {
        settings["lastAck"] = new Date().getTime();
        settings["lastAlarmCheck"] = settings["lastAck"];
        settings["isInAlarm"] = "off";

        this.updateSettings(context, settings);
        this.updateCanvas(context, settings);
    },
    onKeyUp: function (context, settings, coordinates, userDesiredState) {
    },
    onWillAppear: async function (context, settings, coordinates) {
        this.initCanvas();

        this.refreshSettings(context, settings);
        this.updateCanvas(context, settings);
    },
    updateSettings: function(context, settings) {
        this.log("updateSettings", context, settings);

        this.refreshSettings(context, settings);
        websocket.send(JSON.stringify({
            "event": "setSettings",
            "context": context,
            "payload": settings
        }));
    },
    refreshSettings: function(context, settings) {
        this.log("refreshSettings", context, settings);

        contextDetails[context] = {
            "context": context,
            "settings": settings
        };

        this.parseCron(context, settings);
        this.updateCanvas(context, settings);
    },
    parseCron: function(context, settings) {
        this.log("parseCron", context, settings);

        const cron = {
            "month": this.parseItem(settings["month"]),
            "dow": this.parseItem(settings["dow"]),
            "dom": this.parseItem(settings["dom"]),
            "hour": this.parseItem(settings["hour"]),
            "minute": this.parseItem(settings["minute"]),
        };

        this.log(cron);
        parsedCrons[context] = cron;
    },
    parseItem: function(item) {
        const items = item.split(",");
        if (items.indexOf("*")>=0) {
            return "*";
        }

        const parsed = [];
        items.forEach((_v, _k) => parsed.push(parseInt(_v)));
        parsed.sort();

        return parsed;
    },
    cronMatches: function(date, cron) {
        if (cron["minute"]!="*" && cron["minute"].indexOf(date.getMinutes())<0) {
            //console.log("minute doesn't match", cron["minute"], date.getMinutes());
            return false;
        }
        if (cron["hour"]!="*" && cron["hour"].indexOf(date.getHours())<0) {
            //console.log("hour doesn't match", cron["hour"], date.getHours());
            return false;
        }
        if (cron["month"]!="*" && cron["month"].indexOf(date.getMonth()+1)<0) {
            //console.log("month doesn't match", cron["month"], date.getMonth()+1);
            return false;
        }
        if (cron["dom"]!="*" && cron["dom"].indexOf(date.getDate())<0) {
            //console.log("dom doesn't match", cron["dom"], date.getDate());
            return false;
        }
        if (cron["dow"]!="*" && cron["dow"].indexOf(date.getDay())<0) {
            //console.log("dow doesn't match", cron["dow"], date.getDay());
            return false;
        }

        return true;
    },
    hasMatches: function(fromTime, toTime, cron) {
        const getOrDefault = function(val, def) {
            if (val=="*") {
                return def;
            }
            return val;
        };

        const fromDate = new Date();
        fromDate.setTime(fromTime);
        const toDate = new Date();
        toDate.setTime(toTime);

        const minutes = getOrDefault(cron["minute"], [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59]);
        const hours = getOrDefault(cron["hour"], [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23]);
        const days = getOrDefault(cron["dom"], [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31]);
        const months = getOrDefault(cron["month"], [0,1,2,3,4,5,6,7,8,9,10,11]);
        const years = [];

        for (i = fromDate.getFullYear(); i<=toDate.getFullYear(); i++) {
            years.push(i);
        }

        let checksCount = 0;
        let totalCounts = 0;
        const outOfRange = function(date, upToFuture) {
            totalCounts++;
            const t = date.getTime();
            if ((t + upToFuture*1000)<fromTime || t>toTime) {
                //console.log("Out of range", date, upToFuture);
                return true;
            }
            return false;
        };

        //console.log("years", years);
        for (let y in years) {
            const year = years[y];
            fromDate.setFullYear(year);
            fromDate.setMonth(0);
            fromDate.setDate(1);
            fromDate.setHours(0);
            fromDate.setMinutes(0);
            fromDate.setSeconds(0);
            fromDate.setMilliseconds(0);
            if (outOfRange(fromDate, 366*3600*24)) {
                continue;
            }

            //console.log("months", months);
            for (let mo in months) {
                const month = months[mo];
                fromDate.setMonth(month);
                if (outOfRange(fromDate, 31*3600*24)) {
                    continue;
                }

                //console.log("days", days);
                for (let d in days) {
                    const day = days[d];
                    fromDate.setDate(day);
                    if (outOfRange(fromDate, 3600*24)) {
                        continue;
                    }

                    //console.log("hours", hours);
                    for (let h in hours) {
                        const hour = hours[h];
                        fromDate.setHours(hour);
                        if (outOfRange(fromDate, 3600)) {
                            continue;
                        }

                        //console.log("minutes", minutes);
                        for (let m in minutes) {
                            const minute = minutes[m];
                            fromDate.setMinutes(minute);
                            if (outOfRange(fromDate, 0)) {
                                continue;
                            }

                            //console.log("Checking", fromDate);
                            checksCount++;
                            if (this.cronMatches(fromDate, cron)) {
                                console.log("Performed "+checksCount+" checks before successful, and " + totalCounts + " loops");
                                return true;
                            }

                            fromDate.setMinutes(0);
                        }

                        fromDate.setHours(0);
                    }

                    fromDate.setDate(1);
                }

                fromDate.setMonth(0);
            }
        }

        console.log("Performed "+checksCount+" unsuccessful checks and " + totalCounts + " loops");
        return false;
    },

    initCanvas: function() {
        canvas = document.getElementById("reminder");
        canvasContext = canvas.getContext("2d");
    },
    updateAllCanvas: async function() {
        this.log("updateAllCanvas");

        for (let ctx in contextDetails) {
            const details = contextDetails[ctx];
            this.updateCanvas(
                details["context"],
                details["settings"]
            );
        }
    },
    updateCanvas: async function(context, settings) {
        this.log("updateCanvas", context, settings);

        if (this.isInAlarm(context, settings)) {
            this.drawCanvasAlarm(context, settings);
        } else {
            this.drawCanvasNormal(context, settings);
        }
    },
    drawCanvasNormal: async function(context, settings) {
        this.log("drawCanvasNormal", context, settings);

        // Remove the alarm refresher
        if (contextIntervals[context]) {
            clearInterval(contextIntervals[context]["interval"]);
            delete contextIntervals[context];
        }

        this.drawCanvas("#000000", "#333333", context, settings);
    },
    drawCanvasAlarm: async function(context, settings) {
        this.log("drawCanvasAlarm", context, settings);


        // Create the alarm refresher
        if (!contextIntervals[context]) {
            const ctx = {};
            contextIntervals[context] = ctx;
            ctx["themes"] = [
                { "bg": "#ffffff", "txt": "#000000" },
                { "bg": "#000000", "txt": "#ffffff" }
            ];
            ctx["index"] = 0;

            const jThis = this;
            const alternateDraw = function() {
                const theme = ctx["themes"][ctx["index"]%ctx["themes"].length];
                jThis.drawCanvas(theme["bg"], theme["txt"], context, settings);

                ctx["index"]++;
            };

            ctx["interval"] = setInterval(function() {
                alternateDraw();
            }, 1000);
            alternateDraw();
        }
    },
    drawCanvas: async function(backgroundColor, textColor, context, settings) {
        this.log("drawCanvas", context, settings);

        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;

        canvasContext.clearRect(0, 0, canvasWidth, canvasHeight);
        canvasContext.fillStyle = backgroundColor;
        canvasContext.fillRect(0, 0, canvasWidth, canvasHeight);

        fontSize = parseInt(settings["fontSize"]);
        lineHeight = fontSize + 5;

        var font = settings["font"] || "Lato";
        canvasContext.font = "bold "+fontSize+"px "+font;
        canvasContext.fillStyle = textColor;

        canvasContext.textAlign = "center";
        const lines = settings["title"].split("\n");

        let topIndex = Math.round(canvasHeight/2 - lines.length/2*lineHeight + fontSize*0.88);
        for (var i = 0; i<lines.length; i++) {
            canvasContext.fillText(lines[i], canvasWidth/2, topIndex);
            topIndex += lineHeight;
        }

        this.sendCanvas(context);
    },
    sendCanvas: function(context) {
        var json = {
            "event": "setImage",
            "context": context,
            "payload": {
                "image": canvas.toDataURL(),
                "target": DestinationEnum.HARDWARE_AND_SOFTWARE
            }
        }

        websocket.send(JSON.stringify(json));
    },

    isInAlarm: function(context, settings) {
        if (settings["isInAlarm"]=="on") {
            return true;
        }

        const nowTime = new Date().getTime();
        const sinceTime = settings["lastAlarmCheck"];

        if (this.hasMatches(sinceTime, nowTime, parsedCrons[context])) {
            settings["isInAlarm"] = "on";
            settings["lastAlarmCheck"] = nowTime;

            this.updateSettings(context, settings);
            return true;
        }

        return false;
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
            await reminderAction.onKeyDown(context, settings, coordinates, userDesiredState);
        } else if (event == "keyUp") {
            await reminderAction.onKeyUp(context, settings, coordinates, userDesiredState);
        } else if (event == "willAppear") {
            await reminderAction.onWillAppear(context, settings, coordinates);
        } else if (settings!=null) {
            // console.log("Received settings", settings);
            reminderAction.refreshSettings(context, settings);
        }
    };

    websocket.onclose = function () {
        // Websocket is closed
    };

    setInterval(async function() {
        await reminderAction.updateAllCanvas();
    }, 60000);
};