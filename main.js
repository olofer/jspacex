//
// Game objective: reach as high as possible and then land like a Falcon booster!
//
// Base score is your highpoint (meters) iff you land the rocket softly, otherwise zero.
// The horizontal distance from the origin at landing or crash is subtracted from the base score,
// giving the final score: (landed) * MAXY - |FINALX|.
//
// Switch to manual control by pressing 'M' at any time.
// Toggle automatic angular velocity suppression feedback control with 'A'.
// Set (current) main thrust balance value with 'B'.
// Reset game state with 'R'.
// Cycle through open loop thruster programs with 'P'.
// Engage landing burn auto-pilot with 'L'.
//

function printSimulatorStats(ctx, timestamp, fpsval) {
    ctx.font = "15px Arial";
    ctx.fillStyle = "white";
    ctx.fillText("time: " + timestamp.toFixed(3) + " sec" + " [" + fpsval.toFixed(1) + " fps]", 5, 15);
}

function printRocketStats(ctx, rkt, highpoint, brakeBurn) {
    ctx.font = "15px Arial";
    ctx.fillStyle = "white";
    ctx.fillText("elevation: " + rkt.y.toFixed(2) + " m", 5, 45);
    ctx.fillText("vert. vel: " + rkt.vy.toFixed(2) + " m/s", 5, 60);
    ctx.fillText("horz. pos: " + rkt.x.toFixed(2) + " m", 5, 75);
    ctx.fillText("ang. vel: " + rkt.omega.toFixed(2) + " rad/s", 5, 90);

    ctx.fillText("auto-burn: " + (brakeBurn ? "ON" : "OFF"), 5, 575);

    ctx.font = "25px Arial";
    ctx.fillText("highpoint: " + highpoint.toFixed(2) + " m", 600, 30);

    if (rkt.isIntoGround()) {
        ctx.fillStyle = "red";
        ctx.fillText("crash score: " + (-Math.abs(rkt.x)).toFixed(2), 600, 60);
    } else if (rkt.isLanded()) {
        ctx.fillStyle = "yellow";
        ctx.fillText("landing score: " + (highpoint - Math.abs(rkt.x)).toFixed(2), 600, 60);
    }
}

function addOriginToBbox(bbox) {
    return [bbox[0] < 0.0 ? bbox[0] : 0.0,
            bbox[1] > 0.0 ? bbox[1] : 0.0,
            bbox[2] < 0.0 ? bbox[2] : 0.0,
            bbox[3] > 0.0 ? bbox[3] : 0.0];
}

function getPreprogrammedThrust1(t) {
    u = [0.0, 0.0, 0.0];
    if (t < 7.0) u[0] = 0.50;
    if (t > 5.0 && t < 5.5) u[1] = 1.0;
    if (t > 7.0 && t < 9.0) u[2] = 1.0;
    if (t > 10.0 && t < 10.5) u[2] = 1.0;
    return u;
}

function getPreprogrammedThrust2(t) {
    u = [0.0, 0.0, 0.0];
    if (t < 1.0) u[0] = 0.50;
    if (t > 1.0 && t < 2.0) u[0] = 0.75;
    if (t > 6.0 && t < 6.5) u[2] = 1.0;
    if (t > 7.0 && t < 7.5) u[1] = 1.0;
    return u;
}

function getPreprogrammedThrust3(t) {
    u = [0.0, 0.0, 0.0];
    if (t < 7.0) u[0] = 0.50 + t / 7.0;
    if (t > 3.0 && t < 5.0) u[1] = 1.0;
    if (t > 5.0 && t < 9.0) u[2] = 1.0;
    if (t > 9.0 && t < 11.0) u[1] = 1.0;
    if (t > 20.0 && t < 22.0) u[2] = 1.0;
    return u;
}

var input_fuel = document.getElementById("fuel");
var input_umain = document.getElementById("umain");
var input_uleft = document.getElementById("uleft");
var input_uright = document.getElementById("uright");
var input_mode = document.getElementById("mode");

var MyRocket = createDefaultRocket();
const initState = MyRocket.state();

console.log(MyRocket);

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
console.log(ctx);

let PV = createDefaultPlaneView(canvas.width, canvas.height);
PV.xtick = 5.0;
PV.ytick = 5.0;
console.log(PV);

let autoBraking = false;
let controlMode = 2;
input_mode.selectedIndex = controlMode;
const controlPreprograms = [getPreprogrammedThrust1, 
                            getPreprogrammedThrust2, 
                            getPreprogrammedThrust3];

if (input_mode.options.length != controlPreprograms.length + 2) {
    console.log("html mode element has incorrect number of options");
}

var viewZoom = 2.50;
var viewEta = 0.25;

let FPS = 50.0;  // 20ms refresh intervals
let dt = 0.005;  // 5ms timestep; expect 4 calls to rocket.evolve per refresh()

let filtered_fpsval = 0.0;
const filter_beta = 0.990;

let theta_ref = MyRocket.theta;
let tsim = 0.0;
let frame = 0;
let maxh = 0.0;
var startTime = Date.now();

function reset_state() {
    MyRocket.setState(initState);
    MyRocket.resetLeftRight();
    MyRocket.balanceMainThrust();
    autoBraking = false;
    theta_ref = MyRocket.theta;
    tsim = 0.0;
    frame = 0;
    maxh = 0.0;
    startTime = Date.now();
}

function refresh() { 

    var currentTime = Date.now();
    var elapsedTime = currentTime - startTime;
    startTime = currentTime;

    if (elapsedTime == 0.0) return;

    var elapsedSec = elapsedTime / 1000.0;

    if (controlMode >= 2) {
        MyRocket.setThrust(controlPreprograms[controlMode - 2](tsim));
    } else if (controlMode == 1) {
        autoStabilizeOmega(MyRocket, theta_ref);
    } 

    if ((controlMode == 0 || controlMode == 1) && autoBraking) {
        landingProgram(MyRocket);
    }

    usim = MyRocket.thrust();

    while (elapsedSec > 0.0) {
        MyRocket.evolve(tsim, dt);
        tsim += dt;
        elapsedSec -= dt;
        if (MyRocket.y > maxh) maxh = MyRocket.y;
    }

    bbox = MyRocket.bbox_loose();
    //bbox = addOriginToBbox(bbox);
    PV.autoZoom(bbox[0], bbox[1], bbox[2], bbox[3], viewZoom, viewEta); 

    //if (!PV.containsBox(bbox)) {
    //    viewZoom *= 1.25;
    //}

    PV.drawGrid(ctx);
    PV.setTransform(ctx);

    drawRocket(ctx, MyRocket);
    PV.unitTransform(ctx);   
    filtered_fpsval = filter_beta * filtered_fpsval + (1.0 - filter_beta) * (1000.0 / elapsedTime);
    printSimulatorStats(ctx, tsim, filtered_fpsval); 
    printRocketStats(ctx, MyRocket, maxh, autoBraking);
    PV.setTransform(ctx);

    input_fuel.value = (MyRocket.mass - MyRocket.prop.drymass) / (MyRocket.prop.wetmass);
    input_umain.value = usim[0];
    input_uleft.value = usim[1];
    input_uright.value = usim[2];

    frame ++;
}

function keyDownEvent(e)
{
    var code = e.keyCode;
    var key = e.key;

    if (key == '+') {
        viewZoom *= 0.80;
        return;
    }

    if (key == '-') {
        viewZoom *= 1.25;
        return;
    }

    if (key == 'r' || key == 'R')
    {
        reset_state();
        return;
    }

    if (key == 'a' || key == 'A')
    {
        if (controlMode == 1) {
            controlMode = 0; // go to manual if already in auto
            MyRocket.resetLeftRight();
        } else {
            controlMode = 1;
            theta_ref = MyRocket.theta;
            MyRocket.resetLeftRight();
        }
        input_mode.selectedIndex = controlMode;
        return;
    }

    if (key == 'p' || key == 'P')
    {
        if (controlMode < 2) controlMode = 2; else controlMode++;
        if (controlMode == input_mode.options.length) controlMode = 2;
        input_mode.selectedIndex = controlMode;
        reset_state();
        return;
    }

    if (key == 'm' || key == 'M') // toggle manual mode
    {
        controlMode = 0;
        input_mode.selectedIndex = controlMode;
        MyRocket.resetLeftRight();
        return;
    }

    if (key == 'b' || key == 'B') {
        MyRocket.balanceMainThrust();
        return;
    }

    if (key == 'l' || key == 'L') {
        autoBraking = !autoBraking; // toggle landing program
        return;
    }

    if (controlMode != 0 && controlMode != 1) return;

    if (code === 39) // right
    {
        MyRocket.rightThrustInc(1.0);
    }
    else if (code === 37) // left
    {
        MyRocket.leftThrustInc(1.0);
    }
    else if (code === 38) // up
    {
        MyRocket.mainThrustInc(0.10);
    }
    else if (code === 40) // down
    {
        MyRocket.mainThrustInc(-0.10);
    } 
}

function keyUpEvent(e)
{
    var code = e.keyCode;
    var key = e.key;

    if (controlMode != 0 && controlMode != 1) return;

    if (code === 39) // right
    {
        MyRocket.rightThrustInc(-1.0);
    }
    else if (code === 37) // left
    {
        MyRocket.leftThrustInc(-1.0);
    }
    else if (code === 38) // up
    {
    }
    else if (code === 40) // down
    {
    }
}

window.addEventListener('keydown', keyDownEvent);
window.addEventListener('keyup', keyUpEvent);

function controlModeChangeViaUI() {
    //var e = input_mode;
    //var selected = e.options[e.selectedIndex].text;
    controlMode = input_mode.selectedIndex;
    if (controlMode != 0 && controlMode != 1) reset_state();
}

input_mode.addEventListener("change", controlModeChangeViaUI);

reset_state();

let refresher_id = setInterval(refresh, 1000 / FPS);

/*

WISHLIST/TASKS: 

- implement stochastic disturbances or at least a height dependent fluctuating windfield
- implement a more complete autopilot; feedback path following feasible open-loop trajectory
- allow editable rocket parameters via edit boxes UI html elements like so:

    <label for="val1">value1:</label>
    <input type="number" id="val1" name="quantity A" min="0" max="100" step="10" value="30" size="20">

    <label for="val2">value2:</label>
    <input type="number" id="val2" name="quantity B" min="1" max="5" value="1.25" step="0.01" size="20">

 */
