const socket = io.connect("http://24.16.255.56:8888");
const GO_BOARD = "./img/960px-Blank_Go_board.png";
const MAP_FILES = ["map1.txt", "map2.txt", "map3.txt","map4.txt", "map5.txt"];
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
const SLOW_RADIUS = RADIUS * 2;
const CALL_LIMIT = 10000000;
const CAR_LIMIT = 100;
const SPAWN_DELAY = 50;
const MOVEMENT_DELAY = 100;
const COLORS = ["Green", "Yellow", "Red", "Purple", "White", "Black", "Pink"];
let colorIndex = 0;
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
        ctx.fillStyle = COLORS[this.color];
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
        this.updateIndex = 0;
    }
    draw(ctx) {
        ctx.drawImage(this.spriteSheet, this.srcX, this.srcY, 
            this.srcW, this.srcH, this.x, this.y, this.srcW * this.scale, this.srcH * this.scale);
    }
    update(){
        this.updateTimer++;
        if(this.updateTimer > SPAWN_DELAY) {
            let ent = this.game.entities[this.updateIndex];
            if (ent instanceof Car) {
                let car = new Car(this.game, ent.startI, ent.startJ);
                this.game.addEntity(car);
                car.chooseHome();
                car.findPath();
            }

            this.updateTimer = 0;
            this.updateIndex++;
            // console.log(this.game.trafficBoard);
        }
        for (let i = 0; i < SQUARE_COUNT; i++) {
            for (let j = 0; j < SQUARE_COUNT; j++) {
                if (this.game.trafficBoard[i][j] > 0)
                    this.game.trafficBoard[i][j] -= .1;
            }
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
        this.color = 0;
        this.radius = RADIUS;
        this.baseSpeed = 75;
        this.speed = 75;
        this.path = null;
        this.pathLength = 0;//not currently used
        this.pathDifference = 0;//not currently used
        this.movementTimer = 0;
        this.slowRadius = SLOW_RADIUS;
        this.pathIndex = -1;
        this.moving = {left:false, right:false, up:false, down:false};
        this.collision = {left:false, right:false, up:false, down:false};
        this.historyBoard = game.trafficBoardDeepCopy();
    }

    respawn() {
        // console.log(this.startX, this.startY, "start coordinates");
        this.x = this.startI * SQUARE_SIZE + SQUARE_SIZE/2 + SIDE;
        this.y = this.startJ * SQUARE_SIZE + SQUARE_SIZE/2 + SIDE;
        this.i = Math.round((this.x - SIDE - SQUARE_SIZE/2)/SQUARE_SIZE);
        this.j = Math.round((this.y - SIDE - SQUARE_SIZE/2)/SQUARE_SIZE);
        // this.pathIndex = this.path.length - 1;
        // this.currentMove = {'direction':this.path[this.pathIndex--], 'amountLeft':SQUARE_SIZE};
        this.findPath();
        this.color = this.home.color;
    }

    collisionEntities(ents) {
        let keys = Object.keys(this.collision);
        keys.forEach(key => this.collision[key] = false);
        this.speed = this.baseSpeed;
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
            // this.speed -= measurements[maxKey];
        } 
    }

    update() {
        this.collisionEntities(this.game.entities);
        let movement = this.pathFind();
        if (!movement) {
            this.movementTimer++;
        } else {
            this.movementTimer = 0;
        }
        if (this.movementTimer > MOVEMENT_DELAY) {
            this.movementTimer = 0;
            let moves = Object.keys(this.moving);
            moves = moves.filter(move => this.moving[move]);
            let currentMove = moves[0];
            // console.log(moves);
            this.findPath(currentMove);
            // this.color++;
        }
        // this.game.board[this.i][this.j] = false;
        // console.log(this.i, this.j);
        this.i = Math.round((this.x - SIDE - SQUARE_SIZE/2)/SQUARE_SIZE);
        this.j = Math.round((this.y - SIDE - SQUARE_SIZE/2)/SQUARE_SIZE);
        // this.historyBoard[this.i][this.j] = this.pathDifference;
        // this.game.board[this.i][this.j] = true;
        if ((this.i === this.home.i && this.j === this.home.j)) {
            // console.log(this, "made it home");
            this.respawn();
            // console.log(this.x, this.y, this.pathIndex);
        }
        this.effectSquare(this.i, this.j);
        // if (this.i !== newI || this.j !== newJ) {
        //     this.i = newI;
        //     this.j = newJ;
        //     this.pathIndex--;
        // }
    }

    effectSquare(i, j) {
        let effectRatio = .15;
        let effectDistance = 1;
        let effectLimit = 100;
        // (SQUARE_COUNT - distance(this, this.home)) * 
        if (validateIJ({i:i, j:j})) {
            if(this.game.trafficBoard[i][j] < effectLimit) {
                // console.log(this.game.trafficBoard, this.i, this.j);
                this.game.trafficBoard[i][j] += effectRatio;
            }
            let newI = i;
            let newJ = j;
            effectDistance = 1;
            while (validateIJ({i:newI, j:newJ}) && !this.game.board[newI][newJ] && this.game.trafficBoard[newI][newJ] >= effectLimit) {
                newI++;
                effectDistance += effectDistance;
                if(validateIJ({i:newI, j:newJ}))
                    this.game.trafficBoard[newI][newJ] += effectRatio/effectDistance;
            }
            newI = i;
            newJ = j;
            effectDistance = 1;
            while (validateIJ({i:newI, j:newJ})  && !this.game.board[newI][newJ] && this.game.trafficBoard[newI][newJ] >= effectLimit) {
                newI--;
                effectDistance += effectDistance;
                if(validateIJ({i:newI, j:newJ}))
                    this.game.trafficBoard[newI][newJ] += effectRatio/effectDistance;
            }
            newI = i;
            newJ = j;
            effectDistance = 1;
            while (validateIJ({i:newI, j:newJ})  && !this.game.board[newI][newJ] && this.game.trafficBoard[newI][newJ] >= effectLimit) {
                newJ++;
                effectDistance += effectDistance;
                if(validateIJ({i:newI, j:newJ}))
                    this.game.trafficBoard[newI][newJ] += effectRatio/effectDistance;
            }
            newI = i;
            newJ = j;
            effectDistance = 1;
            while (validateIJ({i:newI, j:newJ}) && !this.game.board[newI][newJ] && this.game.trafficBoard[newI][newJ] >= effectLimit) {
                newJ--;
                effectDistance += effectDistance;
                if(validateIJ({i:newI, j:newJ}))
                    this.game.trafficBoard[newI][newJ] += effectRatio/effectDistance;
            }
        }
    }

    move(currentMove) {
        let moves = Object.keys(this.moving);
        moves.forEach(move => this.moving[move] = false);
        let amountMoved = this.game.clockTick * this.speed;
        let moved = false;
        // console.log(currentMove.direction);
        //all movement is backwards here because of how the path is built
        if (currentMove.direction === 'right') {
            if (!this.collision.left) {
                this.x -= amountMoved;
                currentMove.amountLeft -= amountMoved;
                moved = true;
            }
            this.moving[currentMove.direction] = true;
        } else if (currentMove.direction ===  'left') {
            if (!this.collision.right) {
                if (this.x + amountMoved < SQUARE_SIZE * SQUARE_COUNT + SIDE) {
                    this.x += amountMoved;
                    currentMove.amountLeft -= amountMoved;
                } else {
                    this.x = SQUARE_SIZE * SQUARE_COUNT + SIDE - SQUARE_SIZE/2
                    currentMove.amountLeft = 0;
                }
                moved = true;
            }
            this.moving[currentMove.direction] = true;
        } else if (currentMove.direction ===  'up') {
            if ( !this.collision.down) {
                this.y += amountMoved;
                currentMove.amountLeft -= amountMoved;
                moved = true;
            }
            this.moving[currentMove.direction] = true;
        } else if(currentMove.direction ===  'down') {
            if (!this.collision.up) {
                this.y -= amountMoved;
                currentMove.amountLeft -= amountMoved;
                moved = true;
            }
            this.moving[currentMove.direction] = true;
        }
        return moved;      
    }

    pathFind() {
        let moved = false;
        if(this.currentMove) {
            if (this.currentMove.amountLeft > SQUARE_SIZE/35) {
                moved = this.move(this.currentMove)
                // this.moved = true;
            } else if (this.pathIndex >= 0) {
                this.currentMove = {'direction':this.path[this.pathIndex--], 'amountLeft':SQUARE_SIZE};
                moved = this.move(this.currentMove);
                // this.moved = true;
            }

        }

        return moved;
    }

    chooseHome() {
        let choice = Math.round(Math.random() * (this.game.homes.length - 1));
        this.home = this.game.homes[choice];
        this.color = this.home.color;
    }
    findPath(notThisWay) {
        let board = copyBoard(this.game.board);
        let dfs, found;
        this.x = this.i * SQUARE_SIZE + SIDE + SQUARE_SIZE/2;
        this.y = this.j * SQUARE_SIZE + SIDE + SQUARE_SIZE/2;
        dfs = new dfsCall(this.i, this.j, board, this.game, 'start', this.home, 0);
        found = dfs.dfs(notThisWay);
        // if (found) {
            console.log(this.home);
            console.log(dfs.board);
            this.path = this.recover(dfs.board);
            this.pathIndex = this.path.length - 1;
            this.pathDifference = this.path.length - this.pathLength;
            this.pathLength = this.path.length;
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
                // console.log(completedBoard[coordinates.i][coordinates.j]);
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
    constructor(i, j, board, game, recoverMove, home, calls) {
        this.i = i;
        this.j = j;
        this.home = home;
        this.board = board;
        // this.historyBoard = historyBoard;
        this.game = game;
        this.recoverMove = recoverMove;
        this.calls = calls;
    }

    dfs(notThisWay) {
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
            if(notThisWay !== 'right')
                options.push(new dfsCall(this.i - 1, this.j, this.board, this.game, 'right', this.home, ++this.calls));
        } else {
            if(notThisWay !== 'left')
                options.push(new dfsCall(this.i + 1, this.j, this.board, this.game, 'left', this.home, ++this.calls));
        }
        if (this.i % 2 === 0) {
            if(notThisWay !== 'up')
                options.push(new dfsCall(this.i, this.j + 1, this.board, this.game, 'up', this.home, ++this.calls));
        } else {
            if (notThisWay !== 'down')
                options.push(new dfsCall(this.i, this.j - 1, this.board, this.game, 'down', this.home, ++this.calls));
        }
        options.sort((a, b) => {
            if(!validateIJ(a)) {
                return 1;
            } else if (!validateIJ(b)) {
                return -1;
            }
            if (this.game.trafficBoard[a.i][a.j] === 100) {
                return 1;
            }
            if (this.game.trafficBoard[b.i][b.j] === 100) {
                return -1;
            }
            let trafficCostDif = this.game.trafficBoard[a.i][a.j] - this.game.trafficBoard[b.i][b.j];
            let distA = distance(a, a.home); 
            let distB = distance(b, b.home);
            let mapDistDif = distance(a, a.home) - distance(b, b.home);
            // console.log(mapDistDif * 11, trafficCostDif);
            // if (Math.abs(trafficCostDif) < 10)
            return mapDistDif * 10 + trafficCostDif;
            // else
            //     return trafficCostDif;
            // let roll = Math.floor(Math.random() * 8);
            // if (roll == 1)
            //     return 1;
            // if (this.historyBoard[a.i][a.j] < 0) {
            //     return -1
            // } else if (this.historyBoard[b.i][b.j] < 0) {
            //     return 1;
            // }

        });
        let found = false;
        for (const opt of options)
            found = opt.dfs();
        return found;
    }
    

}

function validateIJ(ent) {
    return ent.i >= 0 && ent.j >= 0 && ent.i < SQUARE_COUNT && ent.j < SQUARE_COUNT;
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
    constructor(game, i, j, colorIndex) {
        super(game, SIDE + i * SQUARE_SIZE + SQUARE_SIZE/2, SIDE + j * SQUARE_SIZE + SQUARE_SIZE/2);
        this.i = i;
        this.j = j;
        this.radius = STOP_RADIUS;
        this.colorTime = 0;
        this.color = colorIndex;
    }
    update(){}
}

class Obstacle extends Entity {
    constructor(game, i, j, dW, dH) {
        super(game, i * SQUARE_SIZE + SIDE, j * SQUARE_SIZE + SIDE);
        this.i = i;
        this.j = j;
        this.colorTime = 0;
        this.color = "Cyan";
        this.dW = dW;
        this.dH = dH;
    }
    setBoard() {
        // console.log('setting board');
        let sqW = this.dW/SQUARE_SIZE;
        let sqH = this.dH/SQUARE_SIZE;
        for (let i = 0; i < sqW; i++) {
            for (let j = 0; j < sqH; j++) {
                this.game.trafficBoard[this.i + i][this.j + j] = 100;
                this.game.board[this.i + i][this.j + j] = true;
            }
        }
    }
    update(){
        this.setBoard();
    }

    draw(ctx) {
        ctx.fillStyle = this.color
        ctx.fillRect(this.x,this.y, this.dW, this.dH);
    }
}

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
    let saveButton = document.getElementById("save");
    let loadButton = document.getElementById("load");
    saveButton.onclick = function (e) {
        console.log('save pressed');
        let message = gameEngine.save();
        // console.log(message);
        socket.emit("save", message);
    };
    loadButton.onclick = function (e) {
        console.log('load pressed');
        console.log(socket);
        socket.emit("load", {studentname:"Sterling Quinn", statename:"aState"});
    };
    socket.on("load", function(data) {
        console.log(data);
        let saveState = data.data;
        gameEngine.load(saveState);
    });
    socket.on("connect", function () {
        console.log("Socket connected.")
    });
    socket.on("disconnect", function () {
        console.log("Socket disconnected.")
    });
    socket.on("reconnect", function () {
        console.log("Socket reconnected.")
    });
    
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
    let car;
    // car = new Car(gameEngine, 0, 0);
    // gameEngine.addEntity(car);
    // cars.push(car);
    cars = cars.concat(buildMapFromFile(gameEngine, ASSET_MANAGER.getServerAsset(MAP_FILES[3]), 0, 0));
    cars = cars.concat(buildMapFromFile(gameEngine, ASSET_MANAGER.getServerAsset(MAP_FILES[4]), 0, 18));
    cars = cars.concat(buildMapFromFile(gameEngine, ASSET_MANAGER.getServerAsset(MAP_FILES[3]), 18, 0));
    cars = cars.concat(buildMapFromFile(gameEngine, ASSET_MANAGER.getServerAsset(MAP_FILES[4]), 18, 18));
    //top row
    // for (var i = 0; i < STOP_COUNT; i++) {
    //     for (var j = 0; j < STOP_COUNT; j++) {
    //         stoplight = new Stoplight(gameEngine, SIDE + SQUARE_SIZE * 3 + j * SQUARE_SIZE * STOP_COUNT, 
    //             SIDE + SQUARE_SIZE * 3 + SQUARE_SIZE * STOP_COUNT * i);
    //         gameEngine.addEntity(stoplight);
    //     }
    // }

    for (const car of cars) {
        car.chooseHome();
        // for (let i = 0; i < SQUARE_COUNT - 1; i++) {
        //     for(let j = 0; j < SQUARE_COUNT - 1; j++) {
        //         console.log(i, j, (distance({i:i, j:j}, car.home) - distance({i:i+1, j:j}, car.home)));
        //         console.log(i, j, (distance({i:i, j:j}, car.home) - distance({i:i, j:j + 1}, car.home)));
                
        //     }
        // }
        car.findPath('start');
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
    // let startX = startJ * SQUARE_SIZE + SIDE;
    // let startY = startI * SQUARE_SIZE + SIDE;
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
                game.addObstacle(new Obstacle(game, startJ + j, startI + i, SQUARE_SIZE, SQUARE_SIZE));
            } else if (current === 'h') {
                colorIndex = colorIndex > COLORS.length - 1 ? 0 : colorIndex;
                game.addHome(new Home(game, startJ + j, startI + i, colorIndex++));
            } else if (current === 'c') {
                car = new Car(game, startJ + j, startI + i);
                game.addEntity(car);
                cars.push(car);
            }
        }
    }
    return cars;
}


