const mode_images = {
    "skills": "assets/"
}

const scale = 4.5;

var botWidth = 16;
var botLength = 17.625;

var botCommands = [];

var botStates = [];

var showProcessWarnings = false;

/*
all possible:

setPose         (x, y, theta, radians)
moveToPoint     (x, y, timeout, params, async)
moveToPose      (x, y, theta, timeout, params, async)
turnToPoint     (x, y, timeout, params)
turnToHeading   (theta, timeout, params)
*/

// commandTypeParamNames = {
//     "setPose":          ["x", "y", "theta", "radians"],
//     "moveToPoint":      ["x", "y", "timeout", "params", "async"],
//     "moveToPose":       ["x", "y", "theta", "timeout", "params", "async"],
//     "turnToPoint":      ["x", "y", "timeout", "params", "async"],
//     "turnToHeading":    ["theta", "timeout", "params", "async"],
// }
commandTypeParamNames = {
    "setPose":          ["x", "y", "theta"],
    "moveToPoint":      ["x", "y"],
    "moveToPose":       ["x", "y", "theta"],
    "turnToPoint":      ["x", "y"],
    "turnToHeading":    ["theta"],
}

const botMovementTypeColors = {
    "setPose":          "green",
    "moveToPoint":      "red",
    "moveToPose":       "orange",
    "turnToPoint":      "skyblue",
    "turnToHeading":    "lightblue",
}

var mouseFieldPos = [0, 0];

function processBotCommands(botCommandsString) {
    botCommands = [];

    let botMovementsSplit = botCommandsString.split("\n");
    for (let i = 0; i < botMovementsSplit.length; i++) {
        if (i > 500) {
            alert("too big");
        }
        botMovementsSplit[i] = botMovementsSplit[i].trim().replace(";", "").replace("chassis.", "").replace(")", "").split("(");
        if (botMovementsSplit[i].length > 1) {
            botMovementsSplit[i][1] = botMovementsSplit[i][1].split(",");
            for (let t = 0; t < botMovementsSplit[i][1].length; t++) {
                let parsed = parseFloat(botMovementsSplit[i][1][t]);
                if (!isNaN(parsed)) {
                    botMovementsSplit[i][1][t] = parsed;
                }
                else {
                    let firstChar = botMovementsSplit[i][1][t].trim().charAt(0);
                    if (firstChar == "{") {
                        // console.log("param list", botMovementsSplit[i][1][t]);
                    }
                    else if (botMovementsSplit[i][1][t].trim() == "true" || botMovementsSplit[i][1][t].trim() == "false") {
                        // console.log("bool", botMovementsSplit[i][1][t]);
                    }
                    else {
                        if (showProcessWarnings) {
                            console.warn("warning: found not num, param list, or bool", botMovementsSplit[i][1][t]);
                        }
                    }
                }
            }

            let command = botMovementsSplit[i];
            let params = command[1];

            let newMovement = {
                type: command[0]
            };

            let paramNames = commandTypeParamNames[newMovement.type];

            if (paramNames) {
                for (let e = 0; e < paramNames.length; e++) {
                    let currentParamName = paramNames[e];
                    let currentParam = params[e];
                    // console.log("PARAM CORR", currentParamName, currentParam);
                    newMovement[currentParamName] = currentParam;
                }

                botCommands.push(newMovement);
            }
            else {
                if (showProcessWarnings) {
                    console.warn("warning: couldn't find matching command param list:", newMovement.type);
                }
            }
        } else {
            if (showProcessWarnings) {
                console.warn("warning: command with no params:", botMovementsSplit[i]);
            }
        }
    }

    // console.log(`finished processing ${botCommands.length} bot commands`);
}

function processBotStates() {
    botStates = [];

    let botState = {
        x: 0,
        y: 0,
        theta: 0,
        color: ""
    }

    for (let c in botCommands) {
        let command = botCommands[c];
        if (command.type == "turnToPoint") {
            let yDiff = command.y - botState.y;
            let xDiff = command.x - botState.x;
            let angle = 90 - 180 / Math.PI * Math.atan2(yDiff, xDiff);
            botState.theta = angle;
        }
        else {
            for (let i in command) {
                if (i == "type") {
                    botState.color = botMovementTypeColors[command[i]];
                }
                else {
                    botState[i] = command[i];
                }
            }
        }
        botStates.push({...botState});
    }

    // console.log(`finished processing ${botStates.length} bot states`);
}

function process() {
    let codeTextAreaValue = document.getElementById("codeTextArea").value;
    processBotCommands(codeTextAreaValue);
    processBotStates();
    document.getElementById("botPosIndexSlider").setAttribute("max", botStates.length);
    document.getElementById("statesAmtText").innerText = botStates.length;
}

var botAnimation = {
    timePerStep: 500,
    get totalTime() {
        return botAnimation.timePerStep * botStates.length;
    },
    startTime: 0,
    get time() {
        return Date.now() - botAnimation.startTime;
    },
    init: () => {
        botAnimation.startTime = Date.now();
    },
    updateState() {
        if (!botStates.length) {
            return {x: 0, y: 0, theta: 0};
        }
        if (botStates.length == 1) {
            return {...botStates[0]};
        }
        let stateIndex = Math.floor(botAnimation.time / botAnimation.timePerStep);

        if (stateIndex >= botStates.length - 1) {
            botAnimation.init();
            return {...botStates[stateIndex]};
        }

        let statePre = {
            i: botStates[stateIndex],
            f: botStates[stateIndex + 1]
        };

        let lerpFactor = (botAnimation.time % botAnimation.timePerStep) / botAnimation.timePerStep;

        let x = lerpFactor * (statePre.f.x - statePre.i.x) + statePre.i.x;
        let y = lerpFactor * (statePre.f.y - statePre.i.y) + statePre.i.y;
        let theta = lerpFactor * (statePre.f.theta - statePre.i.theta) + statePre.i.theta;


        let state = {x, y, theta};
        return state;
    },
    draw: () => {
        let state = botAnimation.updateState();
        push();

        strokeWeight(0.5 * scale);
        stroke(0);
        fill(0, 0, 0, 100);

        let pos = fieldPosToCanvasPos(state.x, state.y);
        translate(pos.x, pos.y);
        rotate(state.theta);

        rectMode(CENTER);
        rect(0, 0, botWidth * scale, botLength * scale);

        line(0, 0, 0, -botLength/2 * scale);

        pop();
    },
}


function drawFieldBase() {
    push();
    noStroke();
    let x = 0;
    let fillDark = true;
    for (x = 0; x < width; x+=24*scale) {
        for (let y = 0; y < height; y+=24*scale) {
            fill(fillDark ? 140 : 154);
            rect(x, y, 24 * scale, 24 * scale);
            fillDark = !fillDark
        }
        fillDark = !fillDark
    }
    strokeWeight(4/5 * scale);
    stroke(255);

    // middle
    x = (24 * 3) * scale;
    line(x - 1 * scale, 0, x - 1 * scale, 144 * scale);
    line(x + 1 * scale, 0, x + 1 * scale, 144 * scale);

    // left
    line(12 * scale, 0, 12 * scale, 144 * scale); // up down
    line(12 * scale, 0, 0, 12 * scale); // top slant
    line(12 * scale, 144 * scale, 0, (144 - 12) * scale); // bottom slant

    // right
    line((144 - 12) * scale, 0, (144 - 12) * scale, 144 * scale); // up down
    line((144 - 12) * scale, 0, 144 * scale, 12 * scale); // top slant
    line(144 * scale, (144 - 12) * scale, (144 - 12) * scale, 144 * scale); // bottom slant

    // ladder
    stroke("yellow");
    strokeWeight(2 * scale);

    push();
    translate(width / 2, height / 2);
    rotate(45);
    fill(0, 0, 0, 0);
    rectMode(CENTER);
    rect(0, 0, sqrt(2) * 24 * scale, sqrt(2) * 24 * scale, 1 * scale);

    pop();
}

function drawFieldElements() {

}

function fieldPosToCanvasPos(x, y) {
    return {
        x: (144/2 + x) * scale,
        y: (144/2 - y) * scale
    }
}

function runAndDrawBotStates() {
    if (botStates.length == 0) {
        return;
    }
    let sliderValue = document.getElementById("botPosIndexSlider").value;
    // console.log(sliderValue);
    for (let p = 0; p < sliderValue; p++) {
        let currentBotState = botStates[p];
        let {x: xDraw, y: yDraw} = fieldPosToCanvasPos(currentBotState.x, currentBotState.y);
        let rotDraw = currentBotState.theta;
        let colDraw = currentBotState.color;
        push();
        noFill();
        strokeWeight(0.5 * scale);
        stroke(colDraw);
        translate(xDraw, yDraw);
        rotate(rotDraw);
        rectMode(CENTER);

        if (p == sliderValue - 1) {
            strokeWeight(scale);
            stroke(100, 255, 100);
            fill(100, 255, 100, 100);
        }

        rect(0, 0, botWidth * scale, botLength * scale);
        line(0, 0, 0, - botLength/2 * scale);
        pop();
    }
}

let allowProcessing = false;

function myDraw() {
    // console.log("drawing route");
    drawFieldBase();
    try {
        runAndDrawBotStates();
    } catch (error) {
        console.error("couldn't draw", error)
    }
}

function getFieldMousePos() {
    let x = Math.round((mouseX / scale - 72) * 100) / 100;
    let y = Math.round(((144 * scale - mouseY) / scale - 72) * 100) / 100;
    return [x, y];
}

// p5

function setup() {
    createCanvas(24 * 6 * scale, 24 * 6 * scale);
    document.addEventListener("mousemove", () => {
        mouseFieldPos = getFieldMousePos();
        if (keyIsDown(SHIFT)) {
            mouseFieldPos = [
                Math.round(mouseFieldPos[0]),
                Math.round(mouseFieldPos[1])
            ];
            document.getElementById("mouseFieldXYLabel").style.outline = "solid 3px black";
        }
        else {
            document.getElementById("mouseFieldXYLabel").style.outline = "";
        }
        document.getElementById("mouseFieldX").innerText = mouseFieldPos[0];
        document.getElementById("mouseFieldY").innerText = mouseFieldPos[1];
    });
    document.addEventListener("mousedown", () => {
        if (mouseFieldPos[0] >= -72 && mouseFieldPos[0] <= 72 && mouseFieldPos[1] >= -72 && mouseFieldPos[1] <= 72 && keyIsDown(OPTION)) {
            let textArea = document.getElementById("codeTextArea");
            textArea.value += `\nchassis.moveToPoint(${mouseFieldPos[0]}, ${mouseFieldPos[1]}, 3000); // mouse click added point`;
            textArea.focus();
            onBtn();
        }
    });
    botAnimation.init();
}

function draw() {
    myDraw();
    if (document.getElementById("animToggle").checked) {
        botAnimation.draw();
    }
}


// DOM

//TODO: fix
// function onResize() {
//     let small = Math.min(windowWidth, windowHeight);
//     let big = Math.max(windowWidth, windowHeight);
//     let size = small;
//     size = min(size, big / 1.5);
//     scale = size / 144;
//     if (this.canvas) { canvas = createCanvas(24 * 6 * scale, 24 * 6 * scale); }
//     else { createCanvas(24 * 6 * scale, 24 * 6 * scale); }
// }

document.addEventListener("DOMContentLoaded", () => {
    allowProcessing = true;
    document.getElementById("codeTextArea").value = sampleCode;
    if (localStorage.getItem("routecode")) {
        document.getElementById("codeTextArea").value = localStorage.getItem("routecode");
        setTimeout(onBtn, 50);
    }
});

// window.addEventListener("resize", () => {
//     // onResize();
// })

function onSliderChange() {
    document.getElementById("currStatesText").innerText = document.getElementById("botPosIndexSlider").value;
}

function onBtn() {
    try {
        process();
    } catch (error) {
        console.error("couldn't process", error)
    }
    document.getElementById("botPosIndexSlider").value = document.getElementById("botPosIndexSlider").getAttribute("max");
    onSliderChange();
}

function formatTextArea() {
    let currentText = document.getElementById("codeTextArea").value;
    currentText = currentText.split("\n").map(value => value.trim()).join("\n");
    document.getElementById("codeTextArea").value = currentText;
}

function onTextAreaInput() {
    onBtn();
    localStorage.setItem("routecode", document.getElementById("codeTextArea").value);
}

function onAnimToggle() {
    botAnimation.init();
    onBtn();
}