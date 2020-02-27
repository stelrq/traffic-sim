// This game shell was happily copied from Googler Seth Ladd's "Bad Aliens" game and his Google IO talk in 2011

window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.oRequestAnimationFrame ||
            window.msRequestAnimationFrame ||
            function (/* function */ callback, /* DOMElement */ element) {
                window.setTimeout(callback, 1000 / 60);
            };
})();


class Timer {
    constructor() {
        this.gameTime = 0;
        this.maxStep = 0.05;
        this.wallLastTimestamp = 0;
    }
    tick() {
        var wallCurrent = Date.now();
        var wallDelta = (wallCurrent - this.wallLastTimestamp) / 1000;
        this.wallLastTimestamp = wallCurrent;
        var gameDelta = Math.min(wallDelta, this.maxStep);
        this.gameTime += gameDelta;
        return gameDelta;
    }
}


class GameEngine {
    constructor() {
        this.entities = [];
        this.background = [];
        this.obstacles = [];
        this.showOutlines = false;
        this.ctx = null;
        this.click = null;
        this.mouse = null;
        this.wheel = null;
        this.surfaceWidth = null;
        this.surfaceHeight = null;
        this.board = [];
        this.homes = [];
        this.testBoard = [];
        for (let i = 0; i < SQUARE_COUNT; i++) {
            this.board[i] = [];
            this.testBoard[i] = [];
            for (let j = 0; j < SQUARE_COUNT; j++) {
                this.board[i][j] = false;
                this.testBoard[i][j] = new Stoplight(this, i * SQUARE_SIZE + SIDE, j * SQUARE_SIZE + SIDE);
            }
        }
        
    }
    init(ctx) {
        this.ctx = ctx;
        this.surfaceWidth = this.ctx.canvas.width;
        this.surfaceHeight = this.ctx.canvas.height;
        this.startInput();
        this.timer = new Timer();
        console.log('game initialized');
    }
    start() {
        console.log("starting game");
        var that = this;
        (function gameLoop() {
            that.loop();
            requestAnimFrame(gameLoop, that.ctx.canvas);
        })();
    }
    startInput() {
        console.log('Starting input');
        var that = this;
        var getXandY = function (e) {
            var x = e.clientX - that.ctx.canvas.getBoundingClientRect().left;
            var y = e.clientY - that.ctx.canvas.getBoundingClientRect().top;
            return { x: x, y: y };
        };
        this.ctx.canvas.addEventListener("mousemove", function (e) {
            //console.log(getXandY(e));
            that.mouse = getXandY(e);
        }, false);
        this.ctx.canvas.addEventListener("click", function (e) {
            that.start();
            that.click = getXandY(e);
        }, false);
        this.ctx.canvas.addEventListener("wheel", function (e) {
            //console.log(getXandY(e));
            that.wheel = e;
            //       console.log(e.wheelDelta);
            e.preventDefault();
        }, false);
        this.ctx.canvas.addEventListener("contextmenu", function (e) {
            //console.log(getXandY(e));
            that.rightclick = getXandY(e);
            e.preventDefault();
        }, false);
        console.log('Input started');
    }
    addEntity(entity) {
        console.log('added entity');
        this.entities.push(entity);
        // this.board[Math.floor((entity.x - SIDE)/SQUARE_COUNT)][Math.floor((entity.y - SIDE)/SQUARE_COUNT)] = true;
    }
    addObstacle(entity) {
        this.obstacles.push(entity);
        let sqW = entity.dW/SQUARE_SIZE;
        let sqH = entity.dH/SQUARE_SIZE;
        for (let i = 0; i < sqW; i++) {
            for (let j = 0; j < sqH; j++) {
                this.board[Math.floor((entity.x - SIDE)/SQUARE_SIZE + i)]
                [Math.floor((entity.y - SIDE)/SQUARE_SIZE) + j] = true;
            }
        }
    }
    addHome(entity) {
        this.homes.push(entity);
        this.entities.push(entity);
    }
    addStop(entity) {
        this.stoplights.push(entity);
        this.entities.push(entity);
    }
    draw() {
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
        this.ctx.save();
        this.background.forEach(bg => bg.draw(this.ctx));
        this.obstacles.forEach(obs => obs.draw(this.ctx));
        for (var i = 0; i < this.entities.length; i++) {
            // console.log(this.entities[i]);
            this.entities[i].draw(this.ctx);
        }
        // this.testBoard.forEach(tS => tS.draw(this.ctx));
        for (let i = 0; i < SQUARE_COUNT; i++) {
            for (let j = 0; j < SQUARE_COUNT; j++) {
                if(this.board[i][j])
                    this.testBoard[i][j].draw(this.ctx);
            }
        }
        this.ctx.restore();
    }
    update() {
        var entitiesCount = this.entities.length;
        for (var i = 0; i < entitiesCount; i++) {
            var entity = this.entities[i];
            // console.log(entity);
            if (!entity.removeFromWorld) {
                entity.update();
            }
        }
        for (var i = this.entities.length - 1; i >= 0; --i) {
            if (this.entities[i].removeFromWorld) {
                this.entities.splice(i, 1);
            }
        }
        this.background.forEach(bg => bg.update());
    }
    loop() {
        this.clockTick = this.timer.tick();
        this.update();
        this.draw();
        this.click = null;
        this.rightclick = null;
        this.wheel = null;
    }
}








class Entity {
    constructor(game, x, y) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.removeFromWorld = false;
    }
    update() {
    }
    draw(ctx) {
        if (this.game.showOutlines && this.radius) {
            this.game.ctx.beginPath();
            this.game.ctx.strokeStyle = "green";
            this.game.ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
            this.game.ctx.stroke();
            this.game.ctx.closePath();
        }
    }
    rotateAndCache(image, angle) {
        var offscreenCanvas = document.createElement('canvas');
        var size = Math.max(image.width, image.height);
        offscreenCanvas.width = size;
        offscreenCanvas.height = size;
        var offscreenCtx = offscreenCanvas.getContext('2d');
        offscreenCtx.save();
        offscreenCtx.translate(size / 2, size / 2);
        offscreenCtx.rotate(angle);
        offscreenCtx.translate(0, 0);
        offscreenCtx.drawImage(image, -(image.width / 2), -(image.height / 2));
        offscreenCtx.restore();
        //offscreenCtx.strokeStyle = "red";
        //offscreenCtx.strokeRect(0,0,size,size);
        return offscreenCanvas;
    }
}




