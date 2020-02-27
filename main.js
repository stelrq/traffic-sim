
const GO_BOARD = "./img/960px-Blank_Go_board.png";
const MAP_FILES = ["map1.txt", "map2.txt", "map3.txt","map4.txt"];
const RADIUS = 5;
const STOP_RADIUS = 10;
const SQUARE_SIZE = 25;
const SQUARE_COUNT = 36;
const CIRCLE_COUNT = 50;
const SIDE = 15;
// const TOP_OFF = 30;
const SIDE_OFF = 15 + SQUARE_SIZE/2;
const STOP_COUNT = 6;
const ERROR = 1;
const SLOW_RADIUS = RADIUS * 4;
const CALL_LIMIT = 10000000;
const CAR_LIMIT = 200;
const SPAWN_DELAY = 100;
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

function distanceXY(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
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
        this.updateTimer = 0;
        this.updateCycle = 0;
    }
    draw(ctx) {
        ctx.drawImage(this.spriteSheet, this.srcX, this.srcY, 
            this.srcW, this.srcH, this.x, this.y, this.srcW * this.scale, this.srcH * this.scale);
    }
    update(){
        this.updateTimer++;
        if(this.updateTimer > SPAWN_DELAY) {
            let car;
            let cars = [];
            let numEnts = this.game.entities.length;
            let botLim = numEnts/4 * this.updateCycle;
            let topLim = numEnts/4 * (this.updateCycle + 1)
            if (numEnts < CAR_LIMIT) {
                for (let i = botLim; i < topLim; i++) {
                    let ent = this.game.entities[i];
                    if (ent instanceof Car) {
                        if (!this.game.board[ent.startI][ent.startJ]) {
                            car = new Car(this.game, ent.startI, ent.startJ);
                            this.game.addEntity(car);
                            cars.push(car);
                        }
                    }
                }
            }
            for (const car of cars) {
                car.findPath();
            }
            this.updateCycle = this.updateCycle < 4 ? this.updateCycle++:0;
            this.updateTimer = 0;
        }
    }
}

class Car extends Circle {

    constructor(game, i, j) {
        super(game, SIDE + SQUARE_SIZE/2 + i * SQUARE_SIZE,SIDE + SQUARE_SIZE/2 + j * SQUARE_SIZE);
        this.i = i;
        this.j = j;
        this.startI = i;
        this.startJ = j;
        this.colors = ["Purple", "Green"];
        this.color = 0;
        this.radius = RADIUS;
        this.visualRadius = 500;
        this.speed = 100;
        this.path = null;
        this.slowRadius = SLOW_RADIUS;
        this.pathIndex = -1;
        this.moving = {left:false, right:false, up:false, down:false};
        this.collision = {left:false, right:false, up:false, down:false};
    }

    respawn() {
        console.log(this.startX, this.startY, "start coordinates");
        this.x = this.startI * SQUARE_SIZE + SQUARE_SIZE/2 + SIDE;
        this.y = this.startJ * SQUARE_SIZE + SQUARE_SIZE/2 + SIDE;
        this.pathIndex = this.path.length - 1;
        this.currentMove = {'direction':this.path[this.pathIndex--], 'amountLeft':SQUARE_SIZE};
    }

    collisionEntities(ents) {
        let keys = Object.keys(this.collision);
        keys.forEach(key => this.collision[key] = false);
        ents.forEach(ent => {
            if (!(ent instanceof Home))
                this.collisionSingle(ent)
        });
    }

    collisionSingle(ent) {
        let distance = distanceXY(this, ent);
        if (distance < this.radius + ent.radius) {
            let measurements = {left:this.x - ent.x, right:ent.x - this.x, up:this.y - ent.y, down:ent.y - this.y};
            let keys = Object.keys(measurements);
            let max = 0;
            let maxKey;
            keys.forEach(key => {
                if(measurements[key] > max){
                    max = measurements[key];
                    maxKey = key;
                }
            });
            this.collision[maxKey] = true;
        } 
    }

    update() {
        this.collisionEntities(this.game.entities);
        let movement = this.pathFind();
        if (!movement) {
            this.color = 1;
        }
        // this.game.board[this.i][this.j] = false;
        this.i = Math.round((this.x - SIDE - SQUARE_SIZE/2)/SQUARE_SIZE);
        this.j = Math.round((this.y - SIDE - SQUARE_SIZE/2)/SQUARE_SIZE);
        // this.game.board[this.i][this.j] = true;
        if (this.i === this.home.i && this.j === this.home.j) {
            // console.log(this, "made it home");
            this.respawn();
            // console.log(this.x, this.y, this.pathIndex);
        }
        // if (this.i !== newI || this.j !== newJ) {
        //     this.i = newI;
        //     this.j = newJ;
        //     this.pathIndex--;
        // }
    }


    move(currentMove) {
        let moves = Object.keys(this.moving);
        moves.forEach(move => this.moving[move] = false);
        let amountMoved = this.game.clockTick * this.speed;
        // console.log(currentMove.direction);
        //all movement is backwards here because of how the path is built
        if (currentMove.direction === 'right' && !this.collision.left) {
                this.x -= amountMoved;
                currentMove.amountLeft -= amountMoved;
                this.moving[currentMove.direction] = true;
        } else if (currentMove.direction ===  'left' && !this.collision.right) {
            this.x += amountMoved;
            currentMove.amountLeft -= amountMoved;
            this.moving[currentMove.direction] = true;
        } else if (currentMove.direction ===  'up' && !this.collision.down) {
            this.y += amountMoved;
            currentMove.amountLeft -= amountMoved;
            this.moving[currentMove.direction] = true;
        } else if(currentMove.direction ===  'down' && !this.collision.up) {
            this.y -= amountMoved;
            currentMove.amountLeft -= amountMoved;
            this.moving[currentMove.direction] = true;
        }
                
    }

    pathFind() {
        let moved = false;
        if(this.currentMove) {
            if (this.currentMove.amountLeft > SQUARE_SIZE/35) {
                this.move(this.currentMove)
                this.moved = true;
            } else if (this.pathIndex >= 0) {
                this.currentMove = {'direction':this.path[this.pathIndex--], 'amountLeft':SQUARE_SIZE};
                this.move(this.currentMove);
                this.moved = true;
            }

        }

        return moved;
    }
    findPath() {
        let board = copyBoard(this.game.board);
        let choice = Math.round(Math.random() * (this.game.homes.length - 1));
        this.home = this.game.homes[choice];
        let dfs = new dfsCall(this.i, this.j, board, 'start', this.home, 0);
        let found = dfs.dfs();
        // if (found) {
            this.path = this.recover(dfs.board);
            this.pathIndex = this.path.length - 1;
            if (this.pathIndex > 0)
                this.currentMove = {'direction':this.path[this.pathIndex--], 'amountLeft':SQUARE_SIZE};
        // }
        
    }

    recover(completedBoard) {
        if (completedBoard.length > 0) {
            let coordinates = {i:this.home.i, j:this.home.j};
            let path = [];
            while(coordinates.i !== this.i || coordinates.j !== this.j) {
                // console.log(this, coordinates);
                console.log(completedBoard[coordinates.i][coordinates.j]);
                path.push(completedBoard[coordinates.i][coordinates.j]);
                if(MOVE[completedBoard[coordinates.i][coordinates.j]])
                    coordinates = MOVE[completedBoard[coordinates.i][coordinates.j]](coordinates);
                else {
                    return [];
                }
                // console.log(coordinates);
            }
            return path;
        }
    }
}

class dfsCall{
    constructor(i, j, board, recoverMove, home, calls) {
        this.i = i;
        this.j = j;
        this.home = home;
        this.board = board;
        this.recoverMove = recoverMove;
        this.calls = calls;
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
        } else if (this.calls > CALL_LIMIT) {
            return false;
        }
        let options = [];
        if (this.j % 2 === 0){
            options.push(new dfsCall(this.i - 1, this.j, this.board, 'right', this.home, ++this.calls));
        } else {
            options.push(new dfsCall(this.i + 1, this.j, this.board, 'left', this.home, ++this.calls));
        }
        if (this.i % 2 === 0) {
            options.push(new dfsCall(this.i, this.j + 1, this.board, 'up', this.home, ++this.calls));
        } else {
            options.push(new dfsCall(this.i, this.j - 1, this.board, 'down', this.home, ++this.calls));
        }
        options.sort((a, b) => {
            if(a.i < 0 || a.j < 0 || a.i >= SQUARE_COUNT || a.j >= SQUARE_COUNT) {
                return 1;
            } else {
                return distance(a, a.home) - distance(b, b.home);
            }
        });
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
        super(game, SIDE + i * SQUARE_SIZE + SQUARE_SIZE/2, SIDE + j * SQUARE_SIZE + SQUARE_SIZE/2);
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
for (const file of MAP_FILES)
    ASSET_MANAGER.queueServerDownload(file);
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
    // gameEngine.addHome(new Home(gameEngine, 0, 0));
    // gameEngine.addHome(new Home(gameEngine, SQUARE_COUNT - 1, SQUARE_COUNT - 1));
    // gameEngine.addHome(new Home(gameEngine, Math.floor(SQUARE_COUNT/2), Math.floor(SQUARE_COUNT - 1)));
    let cars = [];
    let circle;

    cars = cars.concat(buildMapFromFile(gameEngine, ASSET_MANAGER.getServerAsset(MAP_FILES[3]), 0, 0));
    cars = cars.concat(buildMapFromFile(gameEngine, ASSET_MANAGER.getServerAsset(MAP_FILES[3]), 0, 18));
    cars = cars.concat(buildMapFromFile(gameEngine, ASSET_MANAGER.getServerAsset(MAP_FILES[3]), 18, 0));
    cars = cars.concat(buildMapFromFile(gameEngine, ASSET_MANAGER.getServerAsset(MAP_FILES[3]), 18, 18));
    //top row
    // for (var i = 0; i < STOP_COUNT; i++) {
    //     for (var j = 0; j < STOP_COUNT; j++) {
    //         stoplight = new Stoplight(gameEngine, SIDE + SQUARE_SIZE * 3 + j * SQUARE_SIZE * STOP_COUNT, 
    //             SIDE + SQUARE_SIZE * 3 + SQUARE_SIZE * STOP_COUNT * i);
    //         gameEngine.addEntity(stoplight);
    //     }
    // }

    for (const car of cars) {
        car.findPath();
        // console.log(car);
    }
    // console.log(gameEngine.board);
    gameEngine.init(ctx);
    gameEngine.draw();
});

function generateCarsCenter(cars, game){
    let circle;
    for (var j = 6; j > 0; j--) {
        for (var i = SQUARE_COUNT/2 - j; i < SQUARE_COUNT/2 + j; i++) {
            circle = new Car(gameEngine, i, SQUARE_COUNT/2 - j);
            gameEngine.addEntity(circle);
            cars.push(circle);
        }
        for (var i = SQUARE_COUNT/2 - j; i < SQUARE_COUNT/2 + j; i++) {
            circle = new Car(gameEngine, SQUARE_COUNT/2 - j, i);
            gameEngine.addEntity(circle);
            cars.push(circle);
        }
        for (var i = SQUARE_COUNT/2 - j; i < SQUARE_COUNT/2 + j; i++) {
            circle = new Car(gameEngine, i, SQUARE_COUNT/2 + j);
            gameEngine.addEntity(circle);
            cars.push(circle);
        }
        for (var i = SQUARE_COUNT/2 - j; i <= SQUARE_COUNT/2 + j; i++) {
            circle = new Car(gameEngine, SQUARE_COUNT/2 + j, i);
            gameEngine.addEntity(circle);
            cars.push(circle);
        }
    }
    return cars;
}

function generateObstacles(gameEngine, tries) {

    for (var i = 0; i < tries; i++) {
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
}

function buildMapFromFile (game, file, startI, startJ) {
    const mapInfo = file;
    let startX = startJ * SQUARE_SIZE + SIDE;
    let startY = startI * SQUARE_SIZE + SIDE;
    let cars = [];
    let car;
    if (!mapInfo) {
        console.log("error with map file");
        return;
    }
    let bottomRow = mapInfo.length - 1;
    let i;
    for (i = bottomRow; i >= 0; i--) {
        for (let j = 0; j < mapInfo[i].length; j++ ) {
            let current = mapInfo[i][j];
            if (current === '.') { //lol this is dumb but I don't know why the right way doesn't work
                continue;
            } else if (current === '-') {
                game.addObstacle(new Obstacle(game, startX + j * SQUARE_SIZE, startY + i * SQUARE_SIZE, SQUARE_SIZE, SQUARE_SIZE));
            } else if (current === 'h') {
                game.addHome(new Home(game, startJ + j, startI + i));
            } else if (current === 'c') {
                car = new Car(game, startJ + j, startI + i);
                game.addEntity(car);
                cars.push(car);
            }
        }
    }
    return cars;
}
