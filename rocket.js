/*
 * Basic rocket object (7 dynamic states) evolved with classic 4th order RK explicit stepper.
 * 
 */

function createDefaultRocketParameters()
{
    return { 
             Isp : [100.0, 50.0, 50.0],
             mdotmax : [20.0, 1.00, 1.00],
             L : 10.0,
             d : 1.0,
             drymass : 250.0,  // no-propellant dry rocket mass
             wetmass : 250.0,  // maximum amount of propellant
             g0 : 9.82,
             cdrag_fw : 0.40,
             cdrag_bw : 2.00,
             clift : 1.17,
             S : Number.NaN,
             A : Number.NaN,
             delta_cp : Number.NaN,
             delta_u : Number.NaN,
             updateDerived : function() {
                this.S = this.L * this.d;
                const R = this.d / 2.0;
                this.A = Math.PI * R * R;
                this.delta_cp = this.d * 1.0;
                this.delta_u = this.L * 0.5;
             },
           };
} 

function createDefaultRocket()
{
    let P = createDefaultRocketParameters()
    P.updateDerived()

    return { 
             prop  : P,
             mass  : P.drymass + P.wetmass,
             x     : 0.0,
             y     : P.L / 2.0 + 0.05,
             vx    : 0.0,
             vy    : 0.0,
             theta : Math.PI / 2.0,
             omega : 0.0,

             umain : 0.0,  // all elements: 0 <= u <= 1
             uleft : 0.0,
             uright : 0.0,

             isOutOfFuel : function() {
                return (this.mass <= this.prop.drymass);
             },

             isIntoGround : function() {
                const yhead = this.y + Math.sin(this.theta) * this.prop.L / 2.0;
                const ybutt = this.y - Math.sin(this.theta) * this.prop.L / 2.0; 
                const vabs = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                //const depth = (this.prop.d) / (1 + Math.exp(-vabs));
                var depth = (this.prop.L / 2) * (1.0 - Math.exp(-vabs / 100.0));
                if (yhead < ybutt) depth += this.prop.d / 2;
                depth *= Math.abs(Math.sin(this.theta));
                return (yhead < -depth || ybutt < -depth);
             },

             isLanded : function() {
                const vabs = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                return this.y > this.prop.L / 2.0
                       && this.y - this.prop.L / 2.0 < 0.025 
                       && Math.abs(Math.cos(this.theta)) < 0.05   
                       && (vabs < 2.00)
                       && Math.abs(this.omega) < 0.10;
             },

             state : function() {
                return [this.mass, 
                        this.x, 
                        this.y, 
                        this.vx, 
                        this.vy, 
                        this.theta, 
                        this.omega];
             },

             setState : function(s) {
                this.mass = s[0];
                this.x = s[1];
                this.y = s[2];
                this.vx = s[3];
                this.vy = s[4];
                this.theta = s[5];
                this.omega = s[6];
             },

             thrust : function() {
                return [this.umain, 
                        this.uleft, 
                        this.uright]
             },

             setThrust : function(u) {
                this.umain = u[0];
                this.uleft = u[1];
                this.uright = u[2];
             },

             balanceMainThrust : function() {
                ubal = this.mass / (this.prop.Isp[0] * this.prop.mdotmax[0]);
                if (ubal > 1.0) ubal = 1.0;
                this.umain = ubal;
             },

             mainThrustInc : function(du) {
                this.umain += du;
                if (this.umain > 1.0) this.umain = 1.0;
                if (this.umain < 0.0) this.umain = 0.0;
             },

             leftThrustInc : function(du) {
                this.uleft += du;
                if (this.uleft > 1.0) this.uleft = 1.0;
                if (this.uleft < 0.0) this.uleft = 0.0;
             },

             rightThrustInc : function(du) {
                this.uright += du;
                if (this.uright > 1.0) this.uright = 1.0;
                if (this.uright < 0.0) this.uright = 0.0;
             },

             resetLeftRight : function() {
                this.uleft = 0.0;
                this.uright = 0.0;
             },

             dotstate : function(t, s, u) {
                const mass = s[0];
                const x = s[1];
                const y = s[2];
                const vx = s[3];
                const vy = s[4];
                const theta = s[5];
                const omega = s[6];

                if (this.isIntoGround() || this.isLanded()) {
                    this.setThrust([0.0, 0.0, 0.0]);
                    return [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
                }

                const wx = 0.0;
                const wy = 0.0;
                const npar = [Math.cos(theta), Math.sin(theta)];
                const nprp = [-1.0 * Math.sin(theta), Math.cos(theta)];
                const vrel = [wx - vx, wy - vy];
                const vrel_cosa = -1.0 * (npar[0] * vrel[0] + npar[1] * vrel[1])
                const vrel_sina = -1.0 * (nprp[0] * vrel[0] + nprp[1] * vrel[1])
                const Lsq = this.prop.L * this.prop.L;
                const dsq = this.prop.d * this.prop.d;
                const Icm = mass * (Lsq / 12 + dsq / 16);

                const Hn = 10.4e3;
                const rho0 = 1.225; 
                const rho = rho0 * Math.exp(-1.0 * y / Hn);

                let mdot = -1.0 * (this.prop.mdotmax[0] * u[0] + this.prop.mdotmax[1] * u[1] + this.prop.mdotmax[2] * u[2]);
                let Fmain  = this.prop.g0 * this.prop.Isp[0] * this.prop.mdotmax[0] * u[0];
                let Fleft  = this.prop.g0 * this.prop.Isp[1] * this.prop.mdotmax[1] * u[1];
                let Fright = this.prop.g0 * this.prop.Isp[2] * this.prop.mdotmax[2] * u[2];

                if (mass <= this.prop.drymass) {
                    mdot = 0.0;
                    Fmain = 0.0;
                    Fleft = 0.0;
                    Fright = 0.0;
                }

                const z1 = vrel_cosa;
                const z2 = vrel_sina;
                const alfa = this.prop.cdrag_bw / this.prop.cdrag_fw;
                const c1 = (1.0 + alfa) / 2.0;
                const c2 = (-1.0 + alfa) / 2.0;
                const zabs = Math.sqrt(z1 * z1 + z2 * z2);
                const v2CD = this.prop.cdrag_fw * (c1 * zabs - c2 * z1) * z1;
                const v2CL = this.prop.clift * zabs * z2;

                const Fdrag = 0.5 * rho * v2CD * this.prop.A;
                const Flift = 0.5 * rho * v2CL * this.prop.S;

                // thrust & gravity
                const Fdiff = Fright - Fleft; 
                let Fx = npar[0] * Fmain + nprp[0] * Fdiff;
                let Fy = npar[1] * Fmain + nprp[1] * Fdiff - mass * this.prop.g0;
                let Tz = -1.0 * Fdiff * this.prop.delta_u;

                // aerodynamics
                Fx = Fx - npar[0] * Fdrag - Flift * nprp[0];
                Fy = Fy - npar[1] * Fdrag - Flift * nprp[1];
                Tz = Tz + this.prop.delta_cp * Flift;

                return [mdot, vx, vy, Fx / mass, Fy / mass, omega, Tz / Icm];
             },

             evolve : function(t, dt) {
                // https://en.wikipedia.org/wiki/List_of_Runge%E2%80%93Kutta_methods#Explicit_methods
                let xk = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
                const u = this.thrust();
                const x = this.state();
                const nx = x.length;
                const k1 = this.dotstate(t, x, u);
                for (let i = 0; i < nx; i++) xk[i] = x[i] + dt * 0.5 * k1[i];
                const k2 = this.dotstate(t + 0.5 * dt, xk, u);
                for (let i = 0; i < nx; i++) xk[i] = x[i] + dt * 0.5 * k2[i];
                const k3 = this.dotstate(t + 0.5 * dt, xk, u);
                for (let i = 0; i < nx; i++) xk[i] = x[i] + dt * k3[i];
                const k4 = this.dotstate(t + dt, xk, u);
                for (let i = 0; i < nx; i++) {
                    xk[i] = x[i] + dt * (k1[i] / 6.0 + k2[i] / 3.0 + k3[i] / 3.0 + k4[i] / 6.0);
                }
                this.setState(xk);
             },

             bbox_loose : function() {
               const xa = this.x + this.prop.L / 2.0 + this.prop.d / 2.0;
               const xb = this.x - this.prop.L / 2.0 - this.prop.d / 2.0;
               const ya = this.y + this.prop.L / 2.0 + this.prop.d / 2.0;
               const yb = this.y - this.prop.L / 2.0 - this.prop.d / 2.0;
               return [xb, xa, yb, ya];
             },
             
           };
}

function rocketTestLog() {
    let testRocket = createDefaultRocket();
    let time = 0.0;
    const stopTime = 1.00;
    const deltaTime = 0.05;
    while (true) {
        console.log(time);
        console.log(testRocket.state());
        if (time >= stopTime) break;
        testRocket.evolve(time, deltaTime);
        time += deltaTime;
    }
}

function autoStabilizeOmega(rkt, 
                            theta_ref,
                            umagn = 0.50, 
                            theta_guard = 0.010 * 2.0 * Math.PI / 360.0,
                            omega_guard = 0.030)
{
  const theta_error = rkt.theta - theta_ref;
  if (Math.abs(theta_error) > theta_guard) {
    if (rkt.omega > omega_guard) {
        rkt.rightThrustInc(umagn);
        rkt.leftThrustInc(-umagn);
    }
    else if (rkt.omega < -omega_guard) {
        rkt.leftThrustInc(umagn);
        rkt.rightThrustInc(-umagn);
    }
  } 
}

function drawRocket(ctx, rkt, thrusterGraphics = true) {
   const dh = rkt.prop.d / 2.0;
   const lh = rkt.prop.L / 2.0;
   const cx = rkt.x;
   const cy = rkt.y;
   const theta = rkt.theta;
   const along = [Math.cos(theta), Math.sin(theta)];
   const across = [-Math.sin(theta), Math.cos(theta)];

   ctx.fillStyle = "rgba(255,200,255,0.50)";
   ctx.strokeStyle = "black";
   ctx.lineWidth = 4.0 / PV.m11;

   ctx.beginPath();
   ctx.moveTo(cx + lh * along[0] + dh * across[0], cy + lh * along[1] + dh * across[1]);
   ctx.lineTo(cx + lh * along[0] - dh * across[0], cy + lh * along[1] - dh * across[1]);
   ctx.lineTo(cx - lh * along[0] - dh * across[0], cy - lh * along[1] - dh * across[1]);
   ctx.lineTo(cx - lh * along[0] + dh * across[0], cy - lh * along[1] + dh * across[1]);
   ctx.lineTo(cx + lh * along[0] + dh * across[0], cy + lh * along[1] + dh * across[1]);
   ctx.stroke();
   ctx.closePath();
   ctx.fill();

   // Nose cone
   ctx.beginPath();
   ctx.moveTo(cx + lh * along[0] + dh * across[0], cy + lh * along[1] + dh * across[1]);
   ctx.lineTo(cx + (lh + dh) * along[0], cy + (lh + dh) * along[1]);
   ctx.lineTo(cx + lh * along[0] - dh * across[0], cy + lh * along[1] - dh * across[1]);
   ctx.moveTo(cx + lh * along[0] + dh * across[0], cy + lh * along[1] + dh * across[1]);
   ctx.stroke();
   ctx.closePath();
   ctx.fill();

   // Pair of tail fins
   ctx.beginPath();
   ctx.moveTo(cx - lh * along[0] + dh * across[0], cy - lh * along[1] + dh * across[1]);
   ctx.lineTo(cx - lh * along[0] + 1.50 * dh * across[0], cy - lh * along[1] + 1.50 * dh * across[1]);
   ctx.lineTo(cx - (lh - 2 * dh) * along[0] + dh * across[0], cy - (lh - 2 * dh) * along[1] + dh * across[1]);
   ctx.moveTo(cx - lh * along[0] + dh * across[0], cy - lh * along[1] + dh * across[1]);
   ctx.stroke();
   ctx.closePath();
   ctx.fill();

   ctx.beginPath();
   ctx.moveTo(cx - lh * along[0] - dh * across[0], cy - lh * along[1] - dh * across[1]);
   ctx.lineTo(cx - lh * along[0] - 1.50 * dh * across[0], cy - lh * along[1] - 1.50 * dh * across[1]);
   ctx.lineTo(cx - (lh - 2 * dh) * along[0] - dh * across[0], cy - (lh - 2 * dh) * along[1] - dh * across[1]);
   ctx.moveTo(cx - lh * along[0] - dh * across[0], cy - lh * along[1] - dh * across[1]);
   ctx.stroke();
   ctx.closePath();
   ctx.fill();

   if (!thrusterGraphics) return;
   if (rkt.isOutOfFuel()) return;

   ctx.fillStyle = "rgba(255,127,0,0.75)";
   ctx.strokeStyle = "yellow";
   ctx.lineWidth = 1.0 / PV.m11;

   if (rkt.umain > 0.0) {
       const flameScale = 6.0 * rkt.umain * dh;
       ctx.beginPath();
       ctx.moveTo(cx - lh * along[0] + dh * across[0], cy - lh * along[1] + dh * across[1]);
       ctx.lineTo(cx - (lh + flameScale) * along[0], cy - (lh + flameScale) * along[1]);
       ctx.lineTo(cx - lh * along[0] - dh * across[0], cy - lh * along[1] - dh * across[1]);
       ctx.lineTo(cx - lh * along[0] + dh * across[0], cy - lh * along[1] + dh * across[1]);
       ctx.stroke();
       ctx.closePath();
       ctx.fill();
   }

   if (rkt.uleft > 0.0) {
       const flameScale = 4.0 * rkt.uleft * dh;
       ctx.beginPath();
       ctx.moveTo(cx - lh * along[0] + dh * across[0], cy - lh * along[1] + dh * across[1]);
       ctx.lineTo(cx - lh * along[0] + flameScale * across[0], cy - lh * along[1] + flameScale * across[1]);
       ctx.lineTo(cx - (lh - 0.5 * dh) * along[0] + dh * across[0], cy - (lh - 0.5 * dh) * along[1] + dh * across[1]);
       ctx.moveTo(cx - lh * along[0] + dh * across[0], cy - lh * along[1] + dh * across[1]);
       ctx.stroke();
       ctx.closePath();
       ctx.fill();
   }

   if (rkt.uright > 0.0) {
       const flameScale = 4.0 * rkt.uright * dh;
       ctx.beginPath();
       ctx.moveTo(cx - lh * along[0] - dh * across[0], cy - lh * along[1] - dh * across[1]);
       ctx.lineTo(cx - lh * along[0] - flameScale * across[0], cy - lh * along[1] - flameScale * across[1]);
       ctx.lineTo(cx - (lh - 0.5 * dh) * along[0] - dh * across[0], cy - (lh - 0.5 * dh) * along[1] - dh * across[1]);
       ctx.moveTo(cx - lh * along[0] - dh * across[0], cy - lh * along[1] - dh * across[1]);
       ctx.stroke();
       ctx.closePath();
       ctx.fill();
   }
}
