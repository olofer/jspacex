// refactored from: https://github.com/olofer/yasph/blob/main/browser/frame-player.html

function createDefaultPlaneView(W, H) {

    const ASP = W / H;

    let obj = {

        W : W,
        H : H,
        ASP : ASP,

        xmin : -10.0,
        xmax : 10.0,
        ymin : -10.0 / ASP,
        ymax : 10.0 / ASP,

        m11 : Number.NaN,
        m12 : Number.NaN,
        m21 : Number.NaN,
        m22 : Number.NaN,
        tx : Number.NaN,
        ty : Number.NaN,

        xtick : 1.0,
        ytick : 1.0,
        maxgpp : 0.20,  // maximum number of gridlines per pixel = 1/5
        showxgrid : true,
        showygrid : true,
        showaxes : true,

        recalcTransform : function() {
            this.m11 = this.W / (this.xmax - this.xmin);
            this.m21 = 0.0;
            this.m12 = 0.0;
            this.m22 = -this.H / (this.ymax - this.ymin);
            this.tx = -this.xmin * this.W / (this.xmax - this.xmin);
            this.ty = this.ymax * this.H / (this.ymax - this.ymin);  
        },

        resizeViewAndKeepXrange : function(NW, NH) {
            this.W = NW;
            this.H = NH;
            this.ASP = this.W / this.H;
            const yc_ = (this.ymin + this.ymax) / 2.0;
            const dx_ = (this.xmax - this.xmin);
            const newdy_ = dx_ / this.ASP;
            this.ymin = yc_ - newdy_ / 2.0;
            this.ymax = yc_ + newdy_ / 2.0;
            this.recalcTransform();
        },

        setTransform : function(ctx) {
            ctx.setTransform(this.m11, this.m12, this.m21, this.m22, this.tx, this.ty);
        },

        unitTransform : function(ctx) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
        },

        calc_pos_w : function(x) {
            return (x * this.m11 + this.tx);
        },
          
        calc_pos_h : function(y) {
            return (y * this.m22 + this.ty);
        },

        containsBox : function(bbox) {
            const containsXrange = bbox[0] > this.xmin && bbox[1] < this.xmax;
            const containsYrange = bbox[2] > this.ymin && bbox[3] < this.ymax;
            return containsXrange && containsYrange;
        },

        autoZoom : function(xmin_, 
                            xmax_, 
                            ymin_, 
                            ymax_, 
                            scaleMult = 1.025, 
                            eta = 1.0) {
            const current_xc = (this.xmin + this.xmax) / 2.0;
            const current_yc = (this.ymin + this.ymax) / 2.0;
            const xc_ = (xmin_ + xmax_) / 2.0;
            const yc_ = (ymin_ + ymax_) / 2.0;
            const dx_ = (xmax_ - xmin_);
            const dy_ = (ymax_ - ymin_);
            const current_dx = (this.xmax - this.xmin);
            const current_dy = (this.ymax - this.ymin);
            const scale_x = dx_ / current_dx;
            const scale_y = dy_ / current_dy;
            const scale_asp = scaleMult * (scale_x >= scale_y ? scale_x : scale_y);
            const xc__ = eta * xc_ + (1.0 - eta) * current_xc;
            const yc__ = eta * yc_ + (1.0 - eta) * current_yc;
            this.xmin = xc__ - scale_asp * current_dx / 2.0;
            this.xmax = xc__ + scale_asp * current_dx / 2.0;
            this.ymin = yc__ - scale_asp * current_dy / 2.0;
            this.ymax = yc__ + scale_asp * current_dy / 2.0;
            this.recalcTransform();
        },

        drawGrid : function(ctx) {
            const bkgd_color = 'rgb(100, 100, 200)';
            const axis_color = 'rgb(200, 200, 255)';
            const axis_width = 2.0 / this.m11;
            const grid_color = 'rgb(150, 150, 255)';
            const grid_width = 1.0 / this.m11;
            const tickmark = 6.0 / this.m11;

            ctx.font = "12px Arial";
            ctx.fillStyle = "white"; // for the text
            ctx.globalAlpha = 1.0;
            //ctx.setTransform(m11, m12, m21, m22, tx, ty);
            this.setTransform(ctx);

            ctx.fillStyle = bkgd_color;
            ctx.fillRect(this.xmin, this.ymin, this.xmax - this.xmin, this.ymax - this.ymin);
            //ctx.clearRect(this.xmin, this.ymin, this.xmax - this.xmin, this.ymax - this.ymin);

            if (this.showaxes) {
                ctx.lineWidth = axis_width;
                ctx.strokeStyle = axis_color;

                ctx.beginPath();
                ctx.moveTo(this.xmin, 0.0);
                ctx.lineTo(this.xmax, 0.0);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(0.0, this.ymin);
                ctx.lineTo(0.0, this.ymax);
                ctx.stroke();
            }

            if (this.showxgrid) {
                const xgmin = Math.ceil(this.xmin / this.xtick);
                const xgmax = Math.floor(this.xmax / this.xtick);
                const xgpp = (xgmax - xgmin + 1) / this.W;
                //const xq = Math.ceil(xgpp / MARKSPP);
                for (var g = xgmin; g <= xgmax; g++) {
                    if (g == 0) continue;
                    if (xgpp <= this.maxgpp) {
                        ctx.lineWidth = grid_width;
                        ctx.strokeStyle = grid_color;
                        ctx.beginPath();
                        ctx.moveTo(g * this.xtick, this.ymin);
                        ctx.lineTo(g * this.xtick, this.ymax);
                        ctx.stroke();
                    }
                    /*if (g % xq == 0) {
                        ctx.lineWidth = axis_width;
                        ctx.strokeStyle = axis_color;
                        ctx.beginPath();
                        ctx.moveTo(g * xtick, -tickmark);
                        ctx.lineTo(g * xtick, tickmark);
                        ctx.stroke();
                        if (SHOWLABEL) {
                          ctx.setTransform(1, 0, 0, 1, 0, 0);
                          ctx.fillText((g * xtick).toFixed(3), calc_pos_w(g * xtick), calc_pos_h(-2*tickmark));
                          ctx.setTransform(m11, m12, m21, m22, tx, ty);
                        }
                    }*/
                }
            }

            if (this.showygrid) {
                const ygmin = Math.ceil(this.ymin / this.ytick);
                const ygmax = Math.floor(this.ymax / this.ytick);
                const ygpp = (ygmax - ygmin + 1) / H;
                //const yq = Math.ceil(ygpp / MARKSPP);
                for (var g = ygmin; g <= ygmax; g++) {
                    if (g == 0) continue;
                    if (ygpp <= this.maxgpp) {
                        ctx.lineWidth = grid_width;
                        ctx.strokeStyle = grid_color;
                        ctx.beginPath();
                        ctx.moveTo(this.xmin, g * this.ytick);
                        ctx.lineTo(this.xmax, g * this.ytick);
                        ctx.stroke();
                    }
                    /*if (g % yq == 0) {
                      ctx.lineWidth = axis_width;
                      ctx.strokeStyle = axis_color;
                      ctx.beginPath();
                      ctx.moveTo(-tickmark, g * ytick);
                      ctx.lineTo(tickmark, g * ytick);
                      ctx.stroke();
                      if (SHOWLABEL) {
                        ctx.setTransform(1, 0, 0, 1, 0, 0);
                        ctx.fillText((g * ytick).toFixed(3), calc_pos_w(-6*tickmark), calc_pos_h(g * ytick));
                        ctx.setTransform(m11, m12, m21, m22, tx, ty);
                      }
                    }*/
                }
            }
        },

    };

    obj.recalcTransform();
    return obj;
}
