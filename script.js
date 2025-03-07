const mode_images = {
    "skills": "assets/"
}

const _scale = 4.5;

var botWidth = 16;
var botLength = 17.625;

var botCommands = [];

var botStates = [];

var showProcessWarnings = false;

var imgOver = "";

var currentDrawField = "skills";

var matchField;

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

var showRoute = true;

function processBotCommands(botCommandsString) {
    botCommands = [];

    let botMovementsSplit = botCommandsString.split("\n");
    for (let i = 0; i < botMovementsSplit.length; i++) {
        if (i > 500) {
            alert("too big");
        }
        let originalCommand = botMovementsSplit[i].trim();
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
                type: command[0],
                index: i,
                originalCommand
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
                    console.warn("warning: couldn't find matching command param list:", newMovement.type, originalCommand);
                }
                if (originalCommand != "") {
                    botCommands.push({"unknown": originalCommand, index: i});
                }
            }
        } else {
            if (showProcessWarnings) {
                console.warn("warning: command with no params:", botMovementsSplit[i], originalCommand);
            }

            if (originalCommand != "") {
                botCommands.push({"unknown": originalCommand, index: i});
            }
        }
    }

    // console.log(`finished processing ${botCommands.length} bot commands`);
}

function processBotStates() {
    botStates = [];

    let botState = {
        x: NaN,
        y: NaN,
        theta: NaN,
        color: "",
        noDraw: true,
        index: -1,
    }

    for (let c in botCommands) {
        let command = botCommands[c];
        botState.index = command.index;
        if (command.unknown) {
            botState.unknown = command.unknown;
        }
        else {
            botState.noDraw = false;
            botState.unknown = undefined;
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
        }
        botStates.push({...botState});
    }

    // console.log(`finished processing ${botStates.length} bot states`);
}

function process() {
    let codeTextAreaValue = getTypedCode();
    processBotCommands(codeTextAreaValue);
    processBotStates();
    document.getElementById("botPosIndexSlider").setAttribute("max", botStates.length);
    document.getElementById("statesAmtText").innerText = botStates.length;
}

function easeOut(x) {
    return 1 - Math.pow(Math.min(Math.max(0, x), 1) - 1, 2)
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
    init: (progress = undefined) => {
        botAnimation.startTime = Date.now();
        if (progress != undefined) {
            botAnimation.processAndSetProgress(progress);
        }
    },
    shiftTime: t => {
        botAnimation.startTime = Math.min(botAnimation.startTime + 1000 * t, Date.now());
    },
    processAndSetProgress: (progress) => {
        let now = Date.now();
        let timePer = botAnimation.timePerStep;

        let newTime = Math.round(now - timePer * progress * botStates.length);

        botAnimation.startTime = newTime;
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

        lerpFactor = easeOut(lerpFactor);

        let x = lerpFactor * (statePre.f.x - statePre.i.x) + statePre.i.x;
        let y = lerpFactor * (statePre.f.y - statePre.i.y) + statePre.i.y;
        let theta = lerpFactor * (statePre.f.theta - statePre.i.theta) + statePre.i.theta;


        let state = {x, y, theta, lerpFactor};
        if (statePre.i.noDraw || statePre.f.noDraw) {
            state.noDraw = true;
        }
        state.originalCommand = statePre.i.originalCommand;
        state.nextCommand = statePre.f.originalCommand;
        return state;
    },
    draw: () => {
        let state = botAnimation.updateState();
        if (!state.noDraw) {
            push();

            strokeWeight(0.5 * _scale);
            stroke(0);
            fill(0, 0, 0, 100);

            let pos = fieldPosToCanvasPos(state.x, state.y);
            translate(pos.x, pos.y);
            rotate(state.theta);

            rectMode(CENTER);
            rect(0, 0, botWidth * _scale, botLength * _scale);

            line(0, 0, 0, -botLength/2 * _scale);

            pop();
        }

        // draw text
        push();
        textAlign(LEFT, BASELINE);
        translate(0, height);
        noStroke();

        fill(0, 0, 0);

        let l = Math.pow(state.lerpFactor, 2);

        let smallTextPosI = -10 - 5 * _scale;
        let smallTextPosF = -10 - 10 * _scale;
        let smallTextPos = l * (smallTextPosF - smallTextPosI) + smallTextPosI;

        let bigTextPosI = -10;
        let bigTextPosF = -10 - 5 * _scale;
        let bigTextPos = l * (bigTextPosF - bigTextPosI) + bigTextPosI;

        textSize(3 * _scale);
        textFont("monospace");

        if (state.nextCommand) {
            push();
            fill(0, 0, 0, 255 - l * 255);
            text(state.originalCommand, _scale, smallTextPos);
            pop();

            text(state.nextCommand, _scale, bigTextPos);
        }
        else {
            text(state.originalCommand, _scale, bigTextPos);
        }

        pop();
    },
    updateProgressElements: (visible) => {
        if (visible) {
            document.getElementById("progress-indicators-container").style.display = "block";

            let proportion = botAnimation.time / botAnimation.totalTime;
            document.querySelector(".anim-progress-bar .progress").style.width = `${proportion*100}%`
            let stateIndex = Math.floor(botAnimation.time / botAnimation.timePerStep);
            document.getElementById("anim-progress-numerator").innerText = stateIndex;
            document.getElementById("anim-progress-denominator").innerText = botStates.length;
        }
        else {
            // document.getElementById("progress-indicators-container").style.display = "none";
        }
    }
}

function fieldPosToCanvasPos(x, y) {
    return {
        x: (144/2 + x) * _scale,
        y: (144/2 - y) * _scale
    }
}

//TODO: make this function's code less messy
function drawFieldBase() {
    push();
        noStroke();
        let x = 0;
        let fillDark = true;
        for (x = 0; x < width; x+=24*_scale) {
            for (let y = 0; y < height; y+=24*_scale) {
                fill(fillDark ? 140 : 154);
                rect(x, y, 24 * _scale, 24 * _scale);
                fillDark = !fillDark
            }
            fillDark = !fillDark
        }
        strokeWeight(4/5 * _scale);
        stroke(255);

        // middle
        x = (24 * 3) * _scale;
        line(x - 1 * _scale, 0, x - 1 * _scale, 144 * _scale);
        line(x + 1 * _scale, 0, x + 1 * _scale, 144 * _scale);

        // left
        line(12 * _scale, 0, 12 * _scale, 144 * _scale); // up down
        line(12 * _scale, 0, 0, 12 * _scale); // top slant
        line(12 * _scale, 144 * _scale, 0, (144 - 12) * _scale); // bottom slant

        // right
        line((144 - 12) * _scale, 0, (144 - 12) * _scale, 144 * _scale); // up down
        line((144 - 12) * _scale, 0, 144 * _scale, 12 * _scale); // top slant
        line(144 * _scale, (144 - 12) * _scale, (144 - 12) * _scale, 144 * _scale); // bottom slant
    pop();
}

var fieldElementsDrawer = {
    skills: () => {
        // ladder
        push();
            translate(72 * _scale, 72 * _scale);
            scale(_scale, -_scale);
            ellipseMode(CENTER);
            fill(30);
            noStroke();
            ellipse(24, 0, 8, 8);
            ellipse(-24, 0, 8, 8);
            ellipse(0, 24, 8, 8);
            ellipse(0, -24, 8, 8);
        pop();

        stroke("yellow");
        strokeWeight(2 * _scale);

        push();
            translate(width / 2, height / 2);
            rotate(45);
            noFill();
            rectMode(CENTER);
            rect(0, 0, sqrt(2) * 24 * _scale, sqrt(2) * 24 * _scale, 1 * _scale);
        pop();


        // return;
        push();

            translate(72 * _scale, 72 * _scale);

            noFill();
            ellipseMode(CENTER);
            strokeWeight(2);

            let stackDist = 0.5;

            let _stake = (x, y, includeSmallStake=true) => {
                push();
                    strokeWeight(2.5/2);
                    stroke("yellow");
                    fill("#555555");
                    translate(x, y);
                    beginShape();
                    let vertexDist = 5.13386443749;
                    for (let i = 0; i <= 360 + 60; i += 60) {
                        vertex(vertexDist * Math.cos(i * Math.PI / 180), vertexDist * Math.sin(i * Math.PI / 180));
                    }
                    endShape();
                pop();
                if (includeSmallStake) _smallStake(x, y);
            }

            let _smallStake = (x, y, color="yellow") => {
                push();
                    translate(x, y);
                    let vertexDist2 = 2.25;
                    fill(color);
                    noStroke();
                    beginShape();
                    let t = false;
                    for (let i = 0; i <= 360 + 30; i += 30) {
                        vertex((t ? 0.5 : 1) * vertexDist2 * Math.cos(i * Math.PI / 180), (t ? 0.5 : 1) * vertexDist2 * Math.sin(i * Math.PI / 180));
                        t = !t;
                    }
                    endShape();
                pop();
            }

            let _ = () => {
                // left side
                stroke("red");
                ellipse(-48, 48, 5, 5);
                ellipse(-60, 48, 5, 5);
                ellipse(-48, 60, 5, 5);
                ellipse(-24, 48, 5, 5);
                ellipse(-24, 24, 5, 5);
                _stake(-48, 24);

                // right side
                stroke("red");
                ellipse(24, 48, 5, 5);
                ellipse(24, 24, 5, 5);

                stroke("red");
                ellipse(48, 48 - stackDist, 5, 5);
                stroke("skyblue");
                ellipse(48, 48, 5, 5);

                stroke("red");
                ellipse(48, 60 - stackDist, 5, 5);
                stroke("skyblue");
                ellipse(48, 60, 5, 5);

                stroke("red");
                ellipse(60, 48 - stackDist, 5, 5);
                stroke("skyblue");
                ellipse(60, 48, 5, 5);

                ellipse(68.25, 68.25, 5, 5);

                _stake(60, 24, false);
                ellipse(60, 24, 5, 5);
                _smallStake(60, 24);

                // middle
                stroke("red");
                ellipse(0, 60, 5, 5);
            }

            push();
                scale(_scale, -_scale);
                _();
            pop();

            push();
                scale(_scale, _scale);
                _();
                _stake(48, 0);

                push();
                    translate(71, 0);
                    rotate(30);
                    _smallStake(0, 0, "skyblue");
                pop();

                push();
                    translate(-71, 0);
                    rotate(30);
                    _smallStake(0, 0, "red");
                pop();

                _smallStake(0, 71);
                _smallStake(0, -71);

                stroke("red");
                ellipse(0, 0, 5, 5);
            pop();
        pop();

        // // draw image
        // push();
        //     tint(255, 255, 255, 255/2 + Math.sin(Date.now() / 200) * 255/2);
        //     image(skillsField, 0, 0, 144 * _scale, 144 * _scale);
        // pop();
    }
}

function runAndDrawBotStates() {
    if (!showRoute) return;
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
        strokeWeight(0.5 * _scale);
        stroke(colDraw);
        translate(xDraw, yDraw);
        rotate(rotDraw);
        rectMode(CENTER);

        if (p == sliderValue - 1) {
            strokeWeight(_scale);
            stroke(100, 255, 100);
            fill(100, 255, 100, 100);
        }

        rect(0, 0, botWidth * _scale, botLength * _scale);
        line(0, 0, 0, - botLength/2 * _scale);
        pop();
    }
}

let allowProcessing = false;

function myDraw() {
    drawFieldBase();
    switch (currentDrawField) {
        case "skills":
            fieldElementsDrawer.skills();
            break;
        case "match img":
            image(matchField, 0, 0, width, height);
            break;
        case "skills img":
            image(skillsField, 0, 0, width, height);
            break;
        default:
            break;
    }
    if (imgOver) {
        image(imgOver, 0, 0, width, height);
    }
    try {
        runAndDrawBotStates();
    } catch (error) {
        console.error("couldn't draw", error)
    }
}

function getFieldMousePos() {
    let x = Math.round((mouseX / _scale - 72) * 100) / 100;
    let y = Math.round(((144 * _scale - mouseY) / _scale - 72) * 100) / 100;
    return [x, y];
}

// p5

var skillsField;

function preload() {
    skillsField = loadImage("assets/vex/skills.png");
    matchField = loadImage("assets/vex/match.jpeg");
}

function setup() {
    createCanvas(24 * 6 * _scale, 24 * 6 * _scale);
    angleMode(DEGREES);
    document.addEventListener("mousemove", () => {
        mouseFieldPos = getFieldMousePos();
        let inside = Math.abs(mouseFieldPos[0]) <= 72 && Math.abs(mouseFieldPos[1]) <= 72;

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
        document.getElementById("mouseFieldX").innerText = inside ? mouseFieldPos[0] : "-";
        document.getElementById("mouseFieldY").innerText = inside ? mouseFieldPos[1] : "-";
    });
    document.addEventListener("mousedown", () => {
        if (mouseFieldPos[0] >= -72 && mouseFieldPos[0] <= 72 && mouseFieldPos[1] >= -72 && mouseFieldPos[1] <= 72 && keyIsDown(OPTION)) {
            setTypedCode(getTypedCode() + `\nchassis.moveToPoint(${mouseFieldPos[0]}, ${mouseFieldPos[1]}, 3000); // mouse click added point`);
            onBtn();
            document.getElementById("#codeTextArea").focus();
        }
    });
    document.addEventListener("keydown", function (event) {
        if ((event.ctrlKey || event.metaKey) && event.key === "s") {
            event.preventDefault();
            saveCodeToFile();
        }
    });
    botAnimation.init();
    onBtn();
}

function saveCodeToFile() {
    const textContent = "// Visualized with the-akze.github.io/Route-Visualizer-for-LemLib\n" + getTypedCode();
    const blob = new Blob([textContent], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    let d = new Date();
    link.download = `auton-route-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}--${d.getHours()}-${d.getMinutes()}-${d.getSeconds()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function draw() {
    myDraw();
    if (document.getElementById("animToggle").checked) {
        botAnimation.draw();
        botAnimation.updateProgressElements(true);
    }
    else {
        botAnimation.updateProgressElements(false);
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

function getTypedCode() {
    return document.getElementById("codeTextArea").innerText;
}

function setTypedCode(c) {
    document.getElementById("codeTextArea").innerHTML = c;
    Prism.highlightAll();
}

function mobileCheck() {
  let check = false;
  (function (a) {
    if (
      /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(
        a
      ) ||
      /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(
        a.substr(0, 4)
      )
    )
      check = true;
  })(navigator.userAgent || navigator.vendor || window.opera);
  return check;
};

document.addEventListener("DOMContentLoaded", () => {
    allowProcessing = true;
    setTypedCode(sampleCode);
    if (localStorage.getItem("routecode")) {
        setTypedCode(localStorage.getItem("routecode"));
        setTimeout(onBtn, 50);
    }

    document.getElementById("codeTextArea").contentEditable = true;

    let progressBar = document.getElementById("animProgressBar");

    let updateAnimBtn = val => {
        document.getElementById("animToggle").checked = val;
    }

    let progressBarUpdate = ev => {
        if (mouseIsPressed) {
            const rect = ev.currentTarget.getBoundingClientRect();
            let x = (ev.clientX - rect.x) / rect.width;
            x = Math.max(0, Math.min(1, x));
            botAnimation.init(x);
            updateAnimBtn(true);
        }
    }
    progressBar.addEventListener("mousemove", progressBarUpdate);
    progressBar.addEventListener("mousedown", progressBarUpdate);
    progressBar.addEventListener("wheel", ev => {
        let scrollAmt = Math.pow(ev.deltaX-ev.deltaY, 3) / 10000;
        const maxMag = 5;
        scrollAmt = Math.min(maxMag, Math.max(scrollAmt, -maxMag));
        botAnimation.shiftTime(scrollAmt);
        updateAnimBtn(true);
    });

    if (mobileCheck()) {
        let mobilePopup = document.getElementById("mobile-popup");
        mobilePopup.style.display = "block";

        let mobilePopupCloseBtn = document.getElementById("mobile-popup-close-btn");
        mobilePopupCloseBtn.addEventListener("click", () => {
            mobilePopup.style.top="-100%"
            mobilePopup.style.transform="translate(-50%, -50%) scale(0.25)"
            mobilePopup.style.filter="blur(10px)"
            setTimeout(() => {
                mobilePopup.style.display = "none";
            }, 500);
        });
    }
});

document.addEventListener("keydown", ev => {
    let t = document.getElementById("codeTextArea");
    let c = document.querySelector("canvas");
    switch (ev.key) {
        case "/":
            setTimeout(() => {t.focus()}, 50); // without timeout, it types the slash, which is unwanted
            break;
        case "Escape":
            c.focus();
            break;
        case "Enter":
            if (keyIsDown(91) || keyIsDown(17)) {
                onBtn();
            }
            break;
        default:
            break;
    }
})

// window.addEventListener("resize", () => {
//     // onResize();
// })

function onSliderChange() {
    document.getElementById("currStatesText").innerText = document.getElementById("botPosIndexSlider").value;
}

function onBtn(doNotResetSlider = false) {
    try {
        process();
    } catch (error) {
        console.error("couldn't process", error)
    }
    if (!doNotResetSlider) document.getElementById("botPosIndexSlider").value = document.getElementById("botPosIndexSlider").getAttribute("max");
    onSliderChange();
}

function onTextAreaInput() {
    onBtn(true);
    localStorage.setItem("routecode", getTypedCode());
}


function formatTextArea() {
    let currentText = getTypedCode();
    currentText = currentText.split("\n").map(value => value.trim()).join("\n");
    setTypedCode(currentText);
    onTextAreaInput();
}

function onAnimToggle() {
    botAnimation.init();
    onBtn(true);
}

function updateTimePerStep(amount) {
    botAnimation.timePerStep = Math.max(1, amount);
}

var swapped = false;

function swapEditorSides() {
    swapped = !swapped;

    if (swapped) {
        document.getElementById("controlpanel").style.left = "unset";
        document.getElementById("controlpanel").style.right = "2px";
        document.querySelector("canvas").style.left = "0";
    }
    else {
        document.getElementById("controlpanel").style.left = "";
        document.getElementById("controlpanel").style.right = "";
        document.querySelector("canvas").style.left = "";
    }
}