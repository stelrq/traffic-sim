
const GO_BOARD = "./img/960px-Blank_Go_board.png";
const RADIUS = 5;
const STOP_RADIUS = 10;
const SQUARE_SIZE = 25;
const SQUARE_COUNT = 36;
const SIDE = 15;
// const TOP_OFF = 30;
const SIDE_OFF = 15 + SQUARE_SIZE/2;
const STOP_COUNT = 6;
const ERROR = 1;
const MOVE = {left:function(coordinates) {
                return {i:coordinates.i - 1, j:coordinates.j};},
        right:function(coordinates) {
            return {i:coordinates.i + 1, j:coordinates.j};},
        up:function(coordinates) {
            return {i:coordinates.i, j:coordinates.j - 1};},
        down:function(coordinates) {
            return {i:coordinates.i, j:coordinates.j + 1};}};



// const HOMES = [{x:SIDE_OFF, y:SIDE_OFF}, 
//     {x:SIDE_OFF + SQUARE_SIZE * (SQUARE_COUNT - 1),
//     y:SIDE_OFF + SQUARE_SIZE * (SQUARE_COUNT - 1)},
//         {x:SIDE_OFF + SQUARE_SIZE * (SQUARE_COUNT/2 - 1),
//         y:SIDE_OFF + SQUARE_SIZE * (SQUARE_COUNT/2 - 1)}];
const RIGHT_EDGE = SIDE + SQUARE_COUNT * SQUARE_SIZE;
const BOT_EDGE = SIDE + SQUARE_COUNT * SQUARE_SIZE;
// GameBoard code below

function copyBoard(board) {
    let newBoard = [];
    for (let i = 0; i < SQUARE_COUNT; i++) {
        newBoard[i] = [];
        for (let j = 0; j < SQUARE_COUNT; j++) {
            if (board[i][j]) {
                newBoard[i][j] = 'full';
            } else {
                newBoard[i][j] = 'empty';
            }
        }
    }
    return newBoard;
}
function distance(a, b) {
    var dx = a.i - b.i;
    var dy = a.j - b.j;
    return Math.sqrt(dx * dx + dy * dy);
}

class Circle extends Entity {
    constructor(game, x, y) {
        super(game, x, y);
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.fillStyle = this.colors[this.color];
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fill();
        ctx.closePath();
    }
}

class Background extends Entity {
    constructor(game, AM, srcX, srcY, srcW, srcH, x, y) {
        super(game, x, y);
        this.spriteSheet = AM.getAsset(GO_BOARD);
        this.scale = .5;
        this.srcX = srcX;
        this.srcY = srcY;
        this.srcW = srcW;
        this.srcH = srcH;
    }
    draw(ctx) {
        ctx.drawImage(this.spriteSheet, this.srcX, this.srcY, 
            this.srcW, this.srcH, this.x, this.y, this.srcW * this.scale, this.srcH * this.scale);
    }
    update(){}
}

class Car extends Circle {

    constructor(game, i, j) {
        super(game, SIDE + SQUARE_SIZE/2 + i * SQUARE_SIZE,SIDE + SQUARE_SIZE + j * SQUARE_SIZE);
        this.i = i;
        this.j = j;
        this.colors = ["Purple", "Green"];
        this.color = 0;
        this.radius = RADIUS;
        this.visualRadius = 500;
        let choice = Math.round(Math.random() * (this.game.homes.length - 1));
        this.home = this.game.homes[choice];
        console.log(choice);
        this.speed = 100;
        this.path = null;
        this.pathIndex = -1;
    }

    update() {
        let newI = Math.floor((this.x - SIDE)/SQUARE_SIZE);
        let newJ = Math.floor((this.y - SIDE)/SQUARE_SIZE);
        if (this.i !== newI || this.j !== newJ) {
            this.i = newI;
            this.j = newJ;
            this.pathIndex--;
        }
        let movement = this.pathFind();
        if (!movement) {
            this.color = 1;
        }
    }

    pathFind() {
        let curDest = this.path[this.pathIndex];
        let moved = false;
        if(curDest) {
            console.log(curDest, this.i, this.j);
            if (this.i < curDest.i) {
                this.x += this.game.clockTick * this.speed;
                moved = true;
            } else if (this.i > curDest.i) {
                this.x -= this.game.clockTick * this.speed;
                moved = true;
            }
            else if (this.j < curDest.j) {
                this.y += this.game.clockTick * this.speed;
                moved = true;
            } else if (this.j > curDest.j) {
                this.y -= this.game.clockTick * this.speed;
                moved = true;
            }
        }
        return moved;
    }
    findPath() {
        let board = copyBoard(this.game.board);
        let dfs = new dfsCall(this.i, this.j, board, 'start', this.home);
        let found = dfs.dfs();
        console.log(found);
        // if (found) {
            this.path = this.recover(dfs.board);
            this.pathIndex = this.path.length - 1;
        // }
        
    }

    recover(completedBoard) {
        let coordinates = {i:this.home.i, j:this.home.j};
        let path = [];
        while(coordinates.i !== this.i || coordinates.j !== this.j) {
            // console.log(this, coordinates);
            path.push(coordinates);
            console.log(completedBoard[coordinates.i][coordinates.j]);
            coordinates = MOVE[completedBoard[coordinates.i][coordinates.j]](coordinates);
            console.log(coordinates);
        }
        return path;
    }
}

class dfsCall{
    constructor(i, j, board, recoverMove, home) {
        this.i = i;
        this.j = j;
        this.home = home;
        this.board = board;
        this.recoverMove = recoverMove;
    }

    dfs() {
        // console.log(i, j);
        // console.log(board);
        if (this.i >= SQUARE_COUNT || this.j >= SQUARE_COUNT || 
            this.i < 0 || this.j < 0 || 
            this.board[this.i][this.j] != 'empty') {
            return false;
        } else {
            this.board[this.i][this.j] = this.recoverMove;
        }
        if (this.i === this.home.i && this.j === this.home.j) {
            return true;
        }
        let options = [new dfsCall(this.i + 1, this.j, this.board, 'left', this.home),
        new dfsCall(this.i - 1, this.j, this.board, 'right', this.home),
        new dfsCall(this.i, this.j - 1, this.board, 'down', this.home),
        new dfsCall(this.i, this.j + 1, this.board, 'up', this.home)];
        options.sort((a, b) => distance(a, a.home) - distance(b, b.home));
        let found = false;
        for (const opt of options)
            found = opt.dfs();
        return found;
    }
    

}
class Stoplight extends Circle{
    constructor(game, x, y) {
        super(game, x, y);
        this.radius = 2;
        this.colors = ["Green", "Yellow", "Red"];
        this.colorTime = 0;
        this.color = 2;
    }
    update(){
        // this.colorTime += this.game.clockTick/2;
        // console.log(this.colorTime);
        // this.color = Math.floor((this.colorTime) % 3);
    }
}

class Home extends Circle {
    constructor(game, i, j) {
        super(game, SIDE + i * SQUARE_SIZE, SIDE + j * SQUARE_SIZE);
        this.i = i;
        this.j = j;
        this.radius = STOP_RADIUS;
        this.colors = ["Green", "Yellow"];
        this.colorTime = 0;
        this.color = 1;
    }
    update(){}
}

class Obstacle extends Entity {
    constructor(game, x, y, dW, dH) {
        super(game, x, y);
        this.colorTime = 0;
        this.color = "Cyan";
        this.dW = dW;
        this.dH = dH;
    }
    update(){}
    draw(ctx) {
        ctx.fillStyle = this.color
        ctx.fillRect(this.x,this.y, this.dW, this.dH);
    }
}
// the "main" code begins here
var friction = 1;
var acceleration = 1000000;
var maxSpeed = 200;

var ASSET_MANAGER = new AssetManager();

ASSET_MANAGER.queueDownload(GO_BOARD);
// ASSET_MANAGER.queueDownload("./img/black.png");
// ASSET_MANAGER.queueDownload("./img/white.png");


ASSET_MANAGER.downloadAll(function () {
    console.log("starting up da sheild");
    var canvas = document.getElementById('gameWorld');
    var ctx = canvas.getContext('2d');
    var gameEngine = new GameEngine();
    var background = new Background(gameEngine, ASSET_MANAGER, 0, 0, 930, 930, 0, 0);
    gameEngine.background.push(background);
    background = new Background(gameEngine, ASSET_MANAGER, 30, 0, 930, 930, 465, 0);
    gameEngine.background.push(background);
    background = new Background(gameEngine, ASSET_MANAGER, 0, 30, 930, 930, 0, 465);
    gameEngine.background.push(background);
    background = new Background(gameEngine, ASSET_MANAGER, 30, 30, 930, 930, 465, 465);
    gameEngine.background.push(background);
    gameEngine.addHome(new Home(gameEngine, 0, 0));
    gameEngine.addHome(new Home(gameEngine, SQUARE_COUNT - 1, SQUARE_COUNT - 1));
    gameEngine.addHome(new Home(gameEngine, Math.floor(SQUARE_COUNT/2), Math.floor(SQUARE_COUNT - 1)));
    let cars = [];
    let circle;
    for (var i = 0; i < STOP_COUNT; i++) {
        circle = new Car(gameEngine, i * STOP_COUNT, 0);
        gameEngine.addEntity(circle);
        cars.push(circle);
    }
    for (var i = 0; i < STOP_COUNT; i++) {
        circle = new Car(gameEngine, 0, 3 + i * STOP_COUNT);
        gameEngine.addEntity(circle);
        cars.push(circle);
    }
    for (var i = 0; i < STOP_COUNT; i++) {
        circle = new Car(gameEngine, 3 + i * STOP_COUNT, SQUARE_COUNT - 1);
        gameEngine.addEntity(circle);
        cars.push(circle);
    }
    for (var i = 0; i < STOP_COUNT; i++) {
        circle = new Car(gameEngine, SQUARE_COUNT - 1, 2 + i * STOP_COUNT);
        gameEngine.addEntity(circle);
        cars.push(circle);
    }
    //top row
    // for (var i = 0; i < STOP_COUNT; i++) {
    //     for (var j = 0; j < STOP_COUNT; j++) {
    //         stoplight = new Stoplight(gameEngine, SIDE + SQUARE_SIZE * 3 + j * SQUARE_SIZE * STOP_COUNT, 
    //             SIDE + SQUARE_SIZE * 3 + SQUARE_SIZE * STOP_COUNT * i);
    //         gameEngine.addEntity(stoplight);
    //     }
    // }
    for (var i = 0; i < 100; i++) {
        let x = SIDE + SQUARE_SIZE * Math.round(Math.random() * (SQUARE_COUNT - 1));
        let y = SIDE + SQUARE_SIZE * Math.round(Math.random() * (SQUARE_COUNT - 1));
        let dW = Math.round(Math.random() * 5)  * SQUARE_SIZE;
        let dH = Math.round(Math.random() * 5) * SQUARE_SIZE;
        let valid = true;
        gameEngine.entities.forEach(tS => {
            let rejectX = (tS.x > x - 2 * SQUARE_SIZE && 
                tS.x < x + dW + 2 * SQUARE_SIZE);
            let rejectY = (tS.y > y - 2 * SQUARE_SIZE &&
                tS.y < y + dH + 2 * SQUARE_SIZE);
            let overX = x + dW > BOT_EDGE;
            let overY = y + dH > BOT_EDGE;
            if (rejectX && rejectY || overX || overY)
                valid = false;
        });
        if (valid) {
            let obs = new Obstacle(gameEngine, x, y, dW, dH);
            gameEngine.addObstacle(obs);
        }
    }
    for (const car of cars) {
        car.findPath();
        // console.log(car);
    }
    // console.log(gameEngine.board);
    gameEngine.init(ctx);
    gameEngine.draw();
});
